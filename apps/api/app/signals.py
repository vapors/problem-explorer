"""v0.9.0 social discussion signals. No scraping and no claims of empirical evidence.

Neo4j is the sole home for configuration, provenance, audit, and observations.
The only automatic score calculation in this release is a transparent arithmetic
summary of administrator-reviewed, manually entered observations. It never
fills unrated concept factors and never overwrites an active human override.
"""
import os
import uuid
import ipaddress
from urllib.parse import urlsplit
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from . import auth
from .db import query, execute, driver
from .targets import accessible

router = APIRouter(prefix='/api/targets/{tid}/signals', tags=['social-signals'])
Kind = Literal['target', 'stream', 'problem']
Factor = Literal['desirability', 'feasibility', 'viability', 'impact', 'coverage']


def require_admin(request: Request):
    user = auth.session_user(request)
    if not user or user['role'] != 'admin':
        raise HTTPException(403, 'Administrator access required to configure social signals')
    return user


def valid_url(value: str) -> str:
    """Validate a *reference* URL; no server-side retrieval is performed."""
    try:
        url = urlsplit(value.strip())
        host = (url.hostname or '').lower().rstrip('.')
        if (url.scheme != 'https' or not host or not '.' in host or
            url.username or url.password or any(ch.isspace() for ch in value) or
            len(value) > 1800 or host in ('localhost', 'localhost.localdomain') or
            host.endswith(('.local', '.internal', '.localhost', '.test', '.invalid'))):
            raise ValueError('Public HTTPS URL required')
        try:
            address = ipaddress.ip_address(host.strip('[]'))
            if not address.is_global:
                raise ValueError('Private or reserved IP addresses are not allowed')
        except ValueError as e:
            if 'not allowed' in str(e):
                raise
            # Public DNS names are allowed. Do not resolve or fetch from the API.
            pass
        return value.strip()
    except (TypeError, ValueError) as exc:
        raise ValueError('Use a public HTTPS URL without credentials or local addresses') from exc


class NodeConfig(BaseModel):
    enabled: Literal['inherit', 'on', 'off'] = 'inherit'
    sourceMode: Literal['inherit', 'custom'] = 'inherit'
    sourceUrls: list[str] = Field(default_factory=list, max_length=25)

    @field_validator('sourceUrls')
    @classmethod
    def check_sources(cls, values: list[str]):
        clean = [valid_url(value) for value in values]
        if len(set(clean)) != len(clean):
            raise ValueError('Duplicate source URLs')
        return clean


class OverrideInput(BaseModel):
    active: bool = False
    score: float | None = Field(default=None, ge=1, le=10)
    reason: str = Field(default='', max_length=500)

    @model_validator(mode='after')
    def ensure_score(self):
        if self.active and self.score is None:
            raise ValueError('An active override requires a 1–10 score')
        return self


class ObservationInput(BaseModel):
    sourceUrl: str
    sourceTitle: str = Field(min_length=3, max_length=220)
    summary: str = Field(min_length=15, max_length=1500)
    context: str = Field(default='', max_length=500)
    metric: Literal['unmet_need', 'polarity'] = 'unmet_need'
    factor: Factor | None = None
    score: float = Field(ge=1, le=10)
    sampleSize: int | None = Field(default=None, ge=1, le=1000000)
    reviewStatus: Literal['needs_review', 'reviewed'] = 'needs_review'

    @field_validator('sourceUrl')
    @classmethod
    def url(cls, value: str):
        return valid_url(value)


class ReviewInput(BaseModel):
    status: Literal['reviewed', 'needs_review']


def node_path(kind: Kind) -> str:
    return {
        'target': '(t)',
        'stream': '(t)-[:HAS_STREAM]->(n:Stream {id:$nodeId})',
        'problem': '(t)-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(n:Problem {id:$problemId})',
    }[kind]


def node_match(kind: Kind) -> str:
    if kind == 'target':
        return 'MATCH (t:Target {id:$tid}) WITH t,t AS n'
    return f'MATCH {node_path(kind).replace("(t)", "(t:Target {id:$tid})", 1)}'


def params(tid: str, kind: Kind, node_id: str) -> dict:
    if kind == 'target' and node_id != tid:
        raise HTTPException(404, 'Target node identifier mismatch')
    if kind == 'problem':
        try:
            problem_id = int(node_id)
        except ValueError as exc:
            raise HTTPException(422, 'Problem requires its numeric record ID') from exc
        return {'tid': tid, 'nodeId': node_id, 'problemId': problem_id}
    return {'tid': tid, 'nodeId': node_id, 'problemId': -1}


def flatten(tid: str) -> list[dict]:
    """One target-scoped hierarchy read; results include unsaved default config."""
    rows = query('''MATCH (t:Target {id:$tid})
        OPTIONAL MATCH (t)-[:HAS_STREAM]->(s:Stream)
        OPTIONAL MATCH (s)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem)
        WITH t,collect(DISTINCT s) AS streams,collect(DISTINCT p) AS problems
        UNWIND [t] + streams + problems AS n
        WITH t,n WHERE n IS NOT NULL
        OPTIONAL MATCH (n)<-[:ABOUT_SIGNAL]-(o:SocialSignalObservation {targetId:$tid,reviewStatus:'reviewed'})
        RETURN elementId(n) AS graphId,n.id AS id,labels(n) AS labels,
          coalesce(n.name,n.description,'') AS name,
          n.streamId AS streamId,
          n.sentimentEnabled AS enabled,n.sentimentSourceMode AS sourceMode,
          n.sentimentSourceUrls AS sourceUrls,
          n.automatedSentiment AS automatedSentiment,
          n.userOverriddenSentiment AS userOverriddenSentiment,
          coalesce(n.isOverrideActive,false) AS isOverrideActive,
          count(DISTINCT o) AS observationCount''', tid=tid)
    target = next((r for r in rows if 'Target' in r['labels']), None)
    if target is None:
        return []
    streams = {str(r['id']): r for r in rows if 'Stream' in r['labels']}
    def mapped(row: dict) -> dict:
        kind = ('target' if 'Target' in row['labels'] else
                'stream' if 'Stream' in row['labels'] else 'problem')
        parent = (None if kind == 'target' else target if kind == 'stream'
                  else streams.get(str(row.get('streamId'))))
        if kind == 'problem' and parent is None:
            # Legacy records may lack streamId; compute only from scoped hierarchy.
            pass
        enabled = row['enabled']
        if kind == 'target':
            effective_enabled = enabled == 'on'
            sources = row.get('sourceUrls') or []
        else:
            effective_enabled = ((enabled == 'on') if enabled in ('on','off')
                                 else bool(parent and parent.get('effectiveEnabled')))
            sources = ((parent or {}).get('effectiveSourceUrls') or [])
            if row.get('sourceMode') == 'custom':
                sources = row.get('sourceUrls') or []
        override = bool(row['isOverrideActive']) and row['userOverriddenSentiment'] is not None
        effective = (row['userOverriddenSentiment'] if override else row['automatedSentiment'])
        result = {**row,'type':kind,'id':str(row['id']),
                  'enabled':row['enabled'] or ('off' if kind=='target' else 'inherit'),
                  'sourceMode':row['sourceMode'] or ('custom' if kind=='target' else 'inherit'),
                  'sourceUrls':row['sourceUrls'] or [],
                  'effectiveEnabled':effective_enabled,
                  'effectiveSourceUrls':sources,'effectiveScore':effective,
                  'effectiveSource':('manual_override' if override else 'reviewed_social_observations') if effective is not None else 'no_data'}
        return result
    output = []
    target_result = mapped(target)
    target = target_result
    output.append(target_result)
    for row in sorted(streams.values(),key=lambda r:r['name']):
        mapped_stream = mapped(row)
        output.append(mapped_stream)
        streams[str(row['id'])] = mapped_stream
    for row in rows:
        if 'Problem' in row['labels']:
            output.append(mapped(row))
    return output


@router.get('/nodes')
def nodes(tid: str, request: Request):
    accessible(tid)
    require_admin(request)
    return {'nodes': flatten(tid), 'scale': [1,10], 'collector': 'manual_source_review'}


@router.get('/graph')
def graph(tid: str):
    accessible(tid)
    # Lightweight separate payload. No embedded findings, no forced chart reload.
    return {'nodes': [
        {'graphId': row['graphId'], 'type': row['type'], 'score': row['effectiveScore'],
         'enabled': row['effectiveEnabled'], 'count': row['observationCount'],
         'overridden': row['effectiveSource'] == 'manual_override'}
        for row in flatten(tid)
    ]}


@router.patch('/nodes/{kind}/{node_id}/config')
def configure(tid: str, kind: Kind, node_id: str, body: NodeConfig, request: Request):
    admin = require_admin(request)
    accessible(tid)
    if kind == 'target' and body.enabled == 'inherit':
        raise HTTPException(422, 'Target must explicitly enable or disable sentiment')
    if kind == 'target' and body.sourceMode == 'inherit':
        raise HTTPException(422, 'Target sources must be explicitly configured')
    p = params(tid, kind, node_id)
    rows = execute(f'''{node_match(kind)}
        SET n.sentimentEnabled=$enabled,n.sentimentSourceMode=$sourceMode,
            n.sentimentSourceUrls=$sourceUrls,n.sentimentConfigUpdatedAt=datetime()
        CREATE (a:SocialSignalAudit {{id:$audit,targetId:$tid,nodeId:toString(n.id),
           action:'configuration',actorId:$actor,createdAt:datetime()}})
        RETURN n.id AS id''', **p, enabled=body.enabled, sourceMode=body.sourceMode,
        sourceUrls=body.sourceUrls, audit=str(uuid.uuid4()), actor=admin['id'])
    if not rows:
        raise HTTPException(404, 'Node is not in this Target')
    return {'ok': True}


def recompute(tx, node_match_query: str, p: dict):
    tx.run(f'''{node_match_query}
      OPTIONAL MATCH (o:SocialSignalObservation {{targetId:$tid,metric:'unmet_need',
         reviewStatus:'reviewed',factor:'overall'}})-[:ABOUT_SIGNAL]->(n)
      WITH n,avg(o.score) AS calculated,count(o) AS sources
      WHERE coalesce(n.isOverrideActive,false)=false
      SET n.automatedSentiment=calculated, n.sentimentObservationCount=sources,
          n.sentimentUpdatedAt=datetime()''', **p).consume()


@router.patch('/nodes/{kind}/{node_id}/override')
def override(tid: str, kind: Kind, node_id: str, body: OverrideInput, request: Request):
    admin = require_admin(request)
    accessible(tid)
    p = params(tid, kind, node_id)
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def write(tx):
            record = tx.run(f'''{node_match(kind)}
              WITH n, n.userOverriddenSentiment AS previous,
                   coalesce(n.isOverrideActive,false) AS wasActive
              SET n.isOverrideActive=$active,n.userOverriddenSentiment=$score,
                  n.sentimentOverrideAt=datetime(),n.sentimentOverrideBy=$actor
              CREATE (:SocialSignalAudit {{id:$audit,targetId:$tid,nodeId:toString(n.id),
                  actorId:$actor,action:'override',previousScore:previous,
                  previousActive:wasActive,newScore:$score,newActive:$active,
                  reason:$reason,createdAt:datetime()}})
              RETURN n.id AS id''', **p, active=body.active, score=body.score,
              actor=admin['id'], reason=body.reason, audit=str(uuid.uuid4())).single()
            if record is None:
                raise HTTPException(404, 'Node is not in this Target')
            if not body.active:
                recompute(tx, node_match(kind), p)
        session.execute_write(write)
    return {'ok': True}


@router.post('/nodes/{kind}/{node_id}/observations', status_code=201)
def add_observation(tid: str, kind: Kind, node_id: str, body: ObservationInput, request: Request):
    admin = require_admin(request)
    accessible(tid)
    p = params(tid, kind, node_id)
    observation_id = str(uuid.uuid4())
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def write(tx):
            record = tx.run(f'''{node_match(kind)}
              WHERE NOT EXISTS {{
                MATCH (prior:SocialSignalObservation {{targetId:$tid,sourceUrl:$url,
                  metric:$metric,factor:$factor}})-[:ABOUT_SIGNAL]->(n)
              }}
              CREATE (o:SocialSignalObservation {{id:$oid,targetId:$tid,
               nodeId:toString(n.id),actorId:$actor,sourceUrl:$url,
               sourceTitle:$title,summary:$summary,context:$context,
               metric:$metric,factor:$factor,score:$score,
               sampleSize:$sample,reviewStatus:$status,
               method:'manual_admin_source_review',createdAt:datetime()}})
              CREATE (o)-[:ABOUT_SIGNAL]->(n)
              RETURN o.id AS id''', **p, oid=observation_id, actor=admin['id'],
              url=body.sourceUrl, title=body.sourceTitle, summary=body.summary,
              context=body.context, metric=body.metric,
              factor=body.factor or 'overall', score=body.score,
              sample=body.sampleSize, status=body.reviewStatus).single()
            if record is None:
                raise HTTPException(409, 'Node unavailable or this source already has an observation for this metric and factor')
            recompute(tx, node_match(kind), p)
        session.execute_write(write)
    return {'id':observation_id, 'status':body.reviewStatus,
            'note':'Social discussion signal only; not empirical evidence'}


@router.get('/nodes/{kind}/{node_id}/observations')
def observations(tid: str, kind: Kind, node_id: str, request: Request):
    accessible(tid)
    account = auth.session_user(request)
    include_drafts = bool(account and account['role'] == 'admin')
    p = params(tid,kind,node_id)
    return query(f'''{node_match(kind)}
       OPTIONAL MATCH (o:SocialSignalObservation {{targetId:$tid}})-[:ABOUT_SIGNAL]->(n)
       WITH o WHERE o IS NOT NULL AND ($includeDraft OR o.reviewStatus='reviewed')
       RETURN o.id AS id,o.sourceUrl AS sourceUrl,o.sourceTitle AS sourceTitle,
          o.summary AS summary,o.context AS context,o.metric AS metric,
          o.factor AS factor,o.score AS score,o.sampleSize AS sampleSize,
          o.reviewStatus AS reviewStatus,toString(o.createdAt) AS createdAt
       ORDER BY createdAt DESC LIMIT 100''', **p, includeDraft=include_drafts)


@router.patch('/nodes/{kind}/{node_id}/observations/{observation_id}')
def review_observation(tid: str, kind: Kind, node_id: str, observation_id: str,
                       body: ReviewInput, request: Request):
    admin = require_admin(request)
    accessible(tid)
    p = params(tid,kind,node_id)
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def write(tx):
            record = tx.run(f'''{node_match(kind)}
               MATCH (o:SocialSignalObservation {{id:$oid,targetId:$tid}})-[:ABOUT_SIGNAL]->(n)
               SET o.reviewStatus=$status,o.reviewedBy=$actor,o.reviewedAt=datetime()
               RETURN o.id AS id''', **p, oid=observation_id, status=body.status,
               actor=admin['id']).single()
            if record is None:
                raise HTTPException(404,'Observation not found')
            recompute(tx,node_match(kind),p)
        session.execute_write(write)
    return {'ok':True}


@router.get('/solutions/{sid}')
def concept_social_factors(tid: str, sid: str):
    """Only direct, reviewed, factor-specific observations on matched problems.

    These are community attitudes about criteria, never concept performance.
    No inherited target/stream aggregate is presented as an observed factor.
    """
    accessible(tid)
    from .targets import me
    matches = query('''MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner})
       OPTIONAL MATCH (s)-[:ADDRESSES]->(p:Problem {targetId:$tid})
       RETURN s.id AS solutionId,collect(DISTINCT p.id) AS problemIds''',tid=tid,sid=sid,owner=me())
    if not matches:
        raise HTTPException(404,'Concept not found')
    ids = [x for x in matches[0]['problemIds'] if x is not None]
    if not ids:
        return {'summary':'No matched problems. Social discussion scores are unavailable.', 'factors':[], 'sources':[]}
    rows=query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream)-[:CONTAINS]->(:Category)
          -[:CONTAINS]->(p:Problem)
       WHERE p.id IN $ids
       MATCH (o:SocialSignalObservation {targetId:$tid,reviewStatus:'reviewed',metric:'unmet_need'})-[:ABOUT_SIGNAL]->(p)
       WHERE o.factor IN ['desirability','feasibility','viability','impact','coverage']
         AND (CASE WHEN p.sentimentEnabled IN ['on','off'] THEN p.sentimentEnabled
                   WHEN s.sentimentEnabled IN ['on','off'] THEN s.sentimentEnabled
                   ELSE coalesce(t.sentimentEnabled,'off') END)='on'
       RETURN p.id AS problemId, o.factor AS factor,o.score AS score,
         o.sourceUrl AS url,o.sourceTitle AS title,o.summary AS summary''',tid=tid,ids=ids)
    factors=[]
    for factor in ('desirability','feasibility','viability','impact','coverage'):
        source_rows=[x for x in rows if x['factor']==factor]
        if source_rows:
            factors.append({'factor':factor,'score':round(sum(x['score'] for x in source_rows)/len(source_rows),2),
                'sourceCount':len(set(x['url'] for x in source_rows)),
                'summary':f'{len(source_rows)} reviewed social observations (not concept efficacy)'})
    sources=[{'factor':r['factor'],'problemId':r['problemId'],'url':r['url'],
              'title':r['title'],'summary':r['summary']} for r in rows]
    return {'summary':f'{len(rows)} reviewed, manually curated social observations from {len(set(x["url"] for x in rows))} sources across linked problems. These express reported community priorities, not empirical evidence or predictions of concept performance.' if rows else 'No reviewed, factor-specific social observations for matched problems.',
            'factors':factors,'sources':sources}
