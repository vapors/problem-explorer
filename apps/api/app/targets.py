"""Target/stream/category/problem CRUD. Every mutation verifies target ownership.

Each target owns a disjoint Neo4j subtree. Shared targets are readable, not writable.
No global stream or problem endpoints exist.
"""
import os, uuid
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel,Field
from .db import query,execute,driver

router=APIRouter(prefix='/api/targets',tags=['targets'])
REFERENCE='reference-longevity'
# Presentation lens identifiers accepted at the API boundary. They do not alter
# canonical Target/Stream/Category/Problem model labels or stored research.
SUPPORTED_LENSES = ('classic', 'general_challenge', 'technical_engineering', 'industrial_design')

def normalize_lens(lens: str) -> str:
    return lens if lens in SUPPORTED_LENSES else 'classic'


def me():
    from .main import uid
    return uid()

def accessible(tid:str,write:bool=False):
    rows=query('''MATCH (t:Target {id:$tid})
        WHERE t.ownerId=$owner OR ($allowShared AND t.shared=true)
        RETURN t.id AS id,t.name AS name,t.description AS description,
               t.ownerId AS ownerId,t.shared AS shared,t.reference AS reference''',
        tid=tid,owner=me(),allowShared=not write)
    if not rows:raise HTTPException(404,'Target not found or access denied')
    if write and rows[0]['ownerId']!=me():raise HTTPException(403,'Read-only target; copy it to your workspace')
    return rows[0]

class TargetInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)
    shared:bool=False

class StreamInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)

class TargetWithStreams(TargetInput):
    streams:List[StreamInput]=Field(min_length=1,max_length=18)

class SuggestInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)
    detail:str=Field(default='standard',pattern='^(outline|standard|detailed)$')

class Suggestions(BaseModel):
    streams:List[StreamInput]

class CategoryInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)

class ProblemInput(BaseModel):
    statement:str=Field(min_length=20,max_length=600)

@router.get('')
def directory(lens: str = 'classic'):
    '''List owned Targets and discoverable shared Targets; suggest a view-only default.

    Legacy missing directoryVisible means listed so upgrades preserve access.
    Only explicit shared+listed targets can be featured. Lens preferences do
    not change ownership or force a workspace switch.
    '''
    owner = me()
    selected_lens = normalize_lens(lens)
    mine=query('''MATCH (t:Target {ownerId:$owner})
        RETURN t.id AS id,t.name AS name,t.description AS description,
               coalesce(t.shared,false) AS shared,t.ownerId AS ownerId,
               coalesce(t.reference,false) AS reference,
               coalesce(t.directoryVisible,true) AS listed,
               coalesce(t.featured,false) AS featured,
               coalesce(t.featuredLenses,[]) AS featuredLenses
        ORDER BY t.name''',owner=owner)
    shared=query('''MATCH (t:Target {shared:true})
        WHERE t.ownerId<>$owner AND coalesce(t.directoryVisible,true)=true
        RETURN t.id AS id,t.name AS name,t.description AS description,
               t.shared AS shared,t.ownerId AS ownerId,
               coalesce(t.reference,false) AS reference,
               true AS listed,coalesce(t.featured,false) AS featured,
               coalesce(t.featuredLenses,[]) AS featuredLenses
        ORDER BY featured DESC,t.name''',owner=owner)
    # A lens-specific featured item wins; fall back to the general featured
    # item. No featured entry is also a valid configuration.
    featured = next((t['id'] for t in shared if selected_lens in (t.get('featuredLenses') or [])), None)
    if featured is None:
        featured = next((t['id'] for t in shared if t.get('featured')), None)
    return {'mine':mine,'shared':shared,'defaultTargetId':featured,'lens':selected_lens}

@router.post('/suggest-streams')
def suggestions(body:SuggestInput):
    from .ai import parse_structured
    count={'outline':3,'standard':5,'detailed':7}[body.detail]
    prompt=(f'Generate exactly {count} nonoverlapping research streams for this problem-first research TARGET. '
            f'Target: {body.name}. Scope: {body.description}. Each stream has a short name and one-sentence '
            'scope. No invented studies, statistics, or solutions; these are editable proposed scopes.')
    result=parse_structured(Suggestions,prompt)
    return {'streams':[r.model_dump() for r in result.streams[:count]],'draft':True}

@router.post('/with-streams',status_code=201)
def create_target(body:TargetWithStreams):
    tid='T'+uuid.uuid4().hex
    entries=[{'id':'S'+uuid.uuid4().hex,'name':x.name.strip(),'description':x.description.strip()} for x in body.streams]
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def work(tx):
            tx.run('CREATE (t:Target {id:$tid,name:$name,description:$description,ownerId:$owner,shared:$shared,createdAt:datetime()})',tid=tid,name=body.name.strip(),description=body.description.strip(),owner=me(),shared=body.shared).consume()
            if entries:
                tx.run('''MATCH (t:Target {id:$tid,ownerId:$owner})
                    UNWIND $streams AS entry
                    CREATE (s:Stream {id:entry.id,name:entry.name,description:entry.description,ownerId:$owner,targetId:$tid,createdAt:datetime()})
                    CREATE (t)-[:HAS_STREAM]->(s)''',tid=tid,owner=me(),streams=entries).consume()
        session.execute_write(work)
    return {'id':tid,'name':body.name.strip(),'description':body.description.strip(),'ownerId':me(),'shared':body.shared,'streamCount':len(entries)}

@router.get('/{tid}')
def get_target(tid:str):return accessible(tid)

@router.patch('/{tid}')
def update_target(tid:str,body:TargetInput):
    accessible(tid,True)
    execute('''MATCH (t:Target {id:$tid,ownerId:$owner})
        SET t.name=$name,t.description=$description,t.shared=$shared
        FOREACH (_ IN CASE WHEN $shared THEN [] ELSE [1] END |
            SET t.directoryVisible=false,t.featured=false,t.featuredLenses=[])
        ''',tid=tid,owner=me(),name=body.name.strip(),description=body.description.strip(),shared=body.shared)
    return {'ok':True}

def destroy_target(tid: str, owner: str, *, admin: bool = False,
                   expected_name: str | None = None) -> dict:
    """Delete a non-reference target and all its records in one Neo4j transaction.

    The ownership, reference and confirmation checks are repeated in the write
    transaction. Shared Source records and global counters are preserved.
    Legacy hierarchy nodes lacking targetId are included via structural traversal.
    """
    if tid == REFERENCE:
        raise HTTPException(403, 'Reference target is protected')
    with driver().session(database=os.getenv('NEO4J_DATABASE', 'neo4j')) as session:
        def work(tx):
            rows = tx.run('''MATCH (t:Target {id:$tid})
                WHERE ($admin OR t.ownerId=$owner)
                  AND coalesce(t.reference,false)=false
                  AND ($expected IS NULL OR t.name=$expected)
                OPTIONAL MATCH (n) WHERE n.targetId=$tid
                WITH t,collect(DISTINCT n) AS owned
                OPTIONAL MATCH (t)-[:HAS_STREAM|CONTAINS*1..3]->(d)
                WITH t, owned, collect(DISTINCT d) AS hierarchy
                WITH owned + hierarchy + [t] AS nodes
                UNWIND nodes AS node
                WITH collect(DISTINCT node) AS doomed
                FOREACH (node IN doomed | DETACH DELETE node)
                RETURN size(doomed) AS deleted''', tid=tid, owner=owner,
                admin=admin, expected=expected_name).data()
            return rows[0]['deleted'] if rows else 0
        deleted = session.execute_write(work)
    if not deleted:
        raise HTTPException(404, 'Target not found, protected, or confirmation no longer matches')
    return {'ok': True, 'deletedNodes': deleted}


@router.delete('/{tid}')
def delete_target(tid: str):
    accessible(tid, True)
    return destroy_target(tid, me())

@router.post('/{tid}/copy',status_code=201)
def copy_target(tid:str):
    src=accessible(tid)
    new='T'+uuid.uuid4().hex
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def work(tx):
            tx.run('CREATE (t:Target {id:$tid,name:$name,description:$description,ownerId:$owner,shared:false,createdAt:datetime()})',tid=new,name=src['name']+' (copy)',description=src.get('description') or '',owner=me()).consume()
            streams=tx.run('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream) RETURN s.id AS id,s.name AS name,s.description AS description',tid=tid).data()
            problem_count=0
            for s in streams:
                sid='S'+uuid.uuid4().hex
                tx.run('MATCH (t:Target {id:$tid}) CREATE (s:Stream {id:$sid,name:$name,description:$desc,ownerId:$owner,targetId:$tid}) CREATE (t)-[:HAS_STREAM]->(s)',tid=new,sid=sid,name=s['name'],desc=s.get('description') or '',owner=me()).consume()
                cats=tx.run('MATCH (s:Stream {id:$sid})-[:CONTAINS]->(c:Category) RETURN c.id AS id,c.name AS name',sid=s['id']).data()
                for c in cats:
                    cid=sid+':'+uuid.uuid4().hex[:12]
                    tx.run('MATCH (s:Stream {id:$sid}) CREATE (c:Category {id:$cid,name:$name,ownerId:$owner,targetId:$tid}) CREATE (s)-[:CONTAINS]->(c)',sid=sid,cid=cid,name=c['name'],owner=me(),tid=new).consume()
                    problems=tx.run('MATCH (c:Category {id:$cid})-[:CONTAINS]->(p:Problem) RETURN p.description AS description',cid=c['id']).data()
                    for p in problems:
                        pid=tx.run('MERGE (counter:IdCounter {name:"problem"}) ON CREATE SET counter.next=0 SET counter.next=counter.next+1 RETURN counter.next AS id').single()['id']
                        tx.run('MATCH (c:Category {id:$cid}) CREATE (p:Problem {id:$pid,description:$description,ownerId:$owner,targetId:$tid,streamId:$sid,streamName:$sname,categoryName:$cname,origin:"copied",reviewStatus:"needs_review",createdAt:datetime()}) CREATE (c)-[:CONTAINS]->(p)',cid=cid,pid=pid,description=p['description'],owner=me(),tid=new,sid=sid,sname=s['name'],cname=c['name']).consume()
                        problem_count+=1
            return len(streams),problem_count
        stream_count,problem_count=session.execute_write(work)
    return {'id':new,'name':src['name']+' (copy)','ownerId':me(),'shared':False,'streamCount':stream_count,'problemCount':problem_count}

@router.get('/{tid}/amcharts-tree')
def amcharts_tree(tid: str):
    """Return a target-scoped hierarchy with explicit problem-only lateral links.

    id and crossLinks use Neo4j elementId() for amCharts identity; problem
    recordId is the existing numeric Problem.id required by all CRUD routes.
    Saved concepts appear as presentation-only attachments to their originating Problem.\n    No new structural CONTAINS relationships are created in Neo4j.
    """
    accessible(tid)  # Enforce owner/shared-reader authorization before either query.
    nodes = query('''MATCH (t:Target {id:$tid})
        OPTIONAL MATCH path=(t)-[:HAS_STREAM|CONTAINS*1..3]->(n)
        WHERE (length(path)=1 AND n:Stream)
           OR (length(path)=2 AND n:Category)
           OR (length(path)=3 AND n:Problem)
        RETURN elementId(t) AS rootId, t.name AS rootName,
            collect(DISTINCT {
                id: elementId(n),
                parentId: elementId(nodes(path)[-2]),
                name: CASE WHEN n:Problem THEN n.description ELSE n.name END,
                type: CASE WHEN n:Stream THEN 'stream'
                           WHEN n:Category THEN 'category'
                           WHEN n:Problem THEN 'problem' END,
                recordId: CASE WHEN n:Problem THEN n.id END,
                recordKey: CASE WHEN n:Problem THEN toString(n.id) ELSE n.id END
            }) AS descendants''', tid=tid)
    if not nodes:
        raise HTTPException(404, 'Target not found or access denied')
    root = {'id': nodes[0]['rootId'], 'name': nodes[0]['rootName'],
            'type': 'target', 'stableKey': 'target:'+tid, 'children': []}
    by_id = {root['id']: root}
    # Collect and link in separate passes; Cypher traversal row order is not guaranteed.
    descendants = [row for row in nodes[0]['descendants'] if row.get('id') and row.get('type')]
    for item in descendants:
        child = {'id': item['id'], 'name': item.get('name') or '',
                 'type': item['type'], 'stableKey': item['type']+':'+str(item.get('recordKey') or item.get('recordId') or item['id']), 'children': []}
        if child['type'] == 'problem':
            child['value'] = 100
            child['recordId'] = item['recordId']
            child['crossLinks'] = []
        by_id[child['id']] = child
    for item in descendants:
        parent = by_id.get(item.get('parentId'))
        if parent is not None:
            parent['children'].append(by_id[item['id']])
    # Never connect into another target even if a malformed cross-target
    # relationship exists. Both endpoints must be in this target's hierarchy.
    lateral = query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)
          -[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem)
        MATCH (p)-[:RELATED_TO|CAUSES|SUPPORTED_BY]-(other:Problem)
        WHERE EXISTS {
            MATCH (t)-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)
              -[:CONTAINS]->(other)
        }
        RETURN elementId(p) AS sourceId,
               collect(DISTINCT elementId(other)) AS destinationIds''', tid=tid)
    for row in lateral:
        source = by_id.get(row['sourceId'])
        if source is not None and source['type'] == 'problem':
            source['crossLinks'] = sorted({destination for destination in row['destinationIds']
                                            if destination != row['sourceId']
                                            and destination in by_id
                                            and by_id[destination]['type'] == 'problem'})
    # Concepts are not structural ontology children: INSPIRED_BY remains the
    # canonical graph edge. This projection is private to the signed-in account.
    concept_rows = query('''MATCH (s:Solution {targetId:$tid,ownerId:$owner})
        -[:INSPIRED_BY]->(p:Problem {targetId:$tid})
        MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)
          -[:CONTAINS]->(:Category)-[:CONTAINS]->(p)
        WHERE coalesce(s.reviewStatus,'active')='active'
        RETURN elementId(p) AS problemId, s.id AS conceptId,
               s.name AS name ORDER BY name,conceptId''', tid=tid,owner=me())
    for record in concept_rows:
        parent = by_id.get(record['problemId'])
        if parent is not None and parent['type'] == 'problem':
            parent['children'].append({
                'id': 'solution:'+str(record['conceptId']),
                'stableKey': 'concept:'+str(record['conceptId']),
                'solutionId': str(record['conceptId']),
                'name': record['name'] or 'Untitled concept',
                'type': 'concept', 'value': 30,
            })

    # Count findings on each attached Problem for the current viewer. Rejected
    # findings are retained in Neo4j but excluded from reviewed/needs-review badges.
    finding_rows = query('''MATCH (r:ResearchRun {targetId:$tid,ownerId:$owner})-[:PRODUCED]->
              (f:Finding {targetId:$tid,ownerId:$owner})-[:ABOUT]->(p:Problem {targetId:$tid})
        MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p)
        RETURN elementId(p) AS problemId,
          count(DISTINCT CASE WHEN f.reviewStatus='reviewed' THEN f END) AS reviewed,
          count(DISTINCT CASE WHEN f.reviewStatus IS NULL OR f.reviewStatus='needs_review' THEN f END) AS unreviewed''',
        tid=tid,owner=me())
    for row in finding_rows:
        problem=by_id.get(row['problemId'])
        if problem is not None and problem['type']=='problem':
            problem['reviewedCount']=row['reviewed']
            problem['unreviewedCount']=row['unreviewed']

    def sort_children(item):
        if 'children' not in item: return
        item['children'].sort(key=lambda child: (child['name'].casefold(), child['id']))
        for child in item['children']:
            sort_children(child)
        if item['type'] == 'problem':
            item['conceptCount'] = sum(child['type']=='concept' for child in item['children'])
            item['problemCount'] = 1
            if not item['children']:
                item.pop('children')  # No concept attachment: preserve leaf shape.
        elif item['type']!='concept':
            descendants=[child for child in item.get('children',[]) if child['type']!='concept']
            item['problemCount']=sum(child.get('problemCount',0) for child in descendants)
            item['conceptCount']=sum(child.get('conceptCount',0) for child in descendants)
            item['reviewedCount']=sum(child.get('reviewedCount',0) for child in descendants)
            item['unreviewedCount']=sum(child.get('unreviewedCount',0) for child in descendants)
    sort_children(root)
    return root


@router.get('/{tid}/graph')
def graph(tid:str):
    t=accessible(tid)
    rows=query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream)
        OPTIONAL MATCH (s)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem)
        RETURN s.id AS id,s.name AS name,count(DISTINCT p) AS count ORDER BY s.name''',tid=tid)
    nodes=[{'data':{'id':'root','label':t['name'],'type':'root'}}]
    nodes.extend({'data':{'id':s['id'],'label':s['name'],'type':'stream','count':s['count']}} for s in rows)
    edges=[{'data':{'id':'root-'+s['id'],'source':'root','target':s['id']}} for s in rows]
    return {'nodes':nodes,'edges':edges}

@router.get('/{tid}/expand/{node_id:path}')
def expand(tid:str,node_id:str):
    accessible(tid)
    if node_id.startswith('S') and ':' not in node_id:
        rows=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream {id:$id})-[:CONTAINS]->(c:Category) RETURN c.id AS id,c.name AS label ORDER BY c.name',tid=tid,id=node_id)
        kind='category'
    elif ':' in node_id:
        rows=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(c:Category {id:$id})-[:CONTAINS]->(p:Problem) RETURN toString(p.id) AS id,p.description AS label ORDER BY p.id LIMIT 500',tid=tid,id=node_id)
        kind='problem'
    elif node_id.startswith('P') and node_id[1:].isdigit():
        rows=query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem {id:$pid})
             OPTIONAL MATCH (f:Finding {targetId:$tid})-[:ABOUT]->(p)
             RETURN f.id AS id,f.claim AS label LIMIT 60''',tid=tid,pid=int(node_id[1:]))
        kind='finding'
    else:return {'nodes':[],'edges':[]}
    nodes=[];edges=[]
    for r in rows:
        if not r['id']:continue
        target=('P' if kind=='problem' else 'F' if kind=='finding' else '')+str(r['id'])
        nodes.append({'data':{'id':target,'label':r['label'],'type':kind}})
        edges.append({'data':{'id':node_id+'-'+target,'source':node_id,'target':target}})
    return {'nodes':nodes,'edges':edges}

@router.get('/{tid}/hierarchy')
def hierarchy(tid:str):
    accessible(tid)
    return query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream)
        OPTIONAL MATCH (s)-[:CONTAINS]->(c:Category)
        OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem)
        RETURN s.id AS streamId,s.name AS stream,c.id AS categoryId,c.name AS category,count(p) AS count
        ORDER BY stream,category''',tid=tid)

@router.get('/{tid}/streams')
def get_streams(tid:str):
    accessible(tid)
    return query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream) RETURN s.id AS id,s.name AS name,s.description AS description ORDER BY s.name',tid=tid)

@router.post('/{tid}/streams',status_code=201)
def add_stream(tid:str,body:StreamInput):
    accessible(tid,True);sid='S'+uuid.uuid4().hex
    execute('MATCH (t:Target {id:$tid,ownerId:$owner}) CREATE (s:Stream {id:$sid,name:$name,description:$description,ownerId:$owner,targetId:$tid}) CREATE (t)-[:HAS_STREAM]->(s)',tid=tid,owner=me(),sid=sid,name=body.name.strip(),description=body.description.strip())
    return {'id':sid,'name':body.name}

@router.patch('/{tid}/streams/{sid}')
def change_stream(tid:str,sid:str,body:StreamInput):
    accessible(tid,True)
    rows=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) SET s.name=$name,s.description=$description RETURN s.id AS id',tid=tid,owner=me(),sid=sid,name=body.name.strip(),description=body.description.strip())
    if not rows:raise HTTPException(404,'Stream not found')
    return rows[0]

@router.delete('/{tid}/streams/{sid}')
def remove_stream(tid:str,sid:str):
    accessible(tid,True)
    # Remove only nodes owned by this target (including research linked to the problems).
    rows=query('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) RETURN s.id AS id',tid=tid,owner=me(),sid=sid)
    if not rows:raise HTTPException(404,'Stream not found')
    execute('MATCH (s:Stream {id:$sid,targetId:$tid}) OPTIONAL MATCH (s)-[:CONTAINS]->(c:Category) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) WITH s,collect(DISTINCT c) AS cs,collect(DISTINCT p) AS ps FOREACH(p IN ps | DETACH DELETE p) FOREACH(c IN cs | DETACH DELETE c) DETACH DELETE s',sid=sid,tid=tid)
    return {'ok':True}

@router.post('/{tid}/streams/{sid}/categories',status_code=201)
def add_category(tid:str,sid:str,body:CategoryInput):
    accessible(tid,True); cid=sid+':'+uuid.uuid4().hex[:12]
    rows=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) CREATE (c:Category {id:$cid,name:$name,ownerId:$owner,targetId:$tid}) CREATE (s)-[:CONTAINS]->(c) RETURN c.id AS id',tid=tid,owner=me(),sid=sid,cid=cid,name=body.name.strip())
    if not rows:raise HTTPException(404,'Stream not found')
    return rows[0]

@router.patch('/{tid}/categories/{cid}')
def change_category(tid:str,cid:str,body:CategoryInput):
    accessible(tid,True)
    rows=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(c:Category {id:$cid}) SET c.name=$name RETURN c.id AS id',tid=tid,owner=me(),cid=cid,name=body.name.strip())
    if not rows:raise HTTPException(404,'Category not found')
    return rows[0]

@router.delete('/{tid}/categories/{cid}')
def remove_category(tid:str,cid:str):
    accessible(tid,True)
    rows=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(c:Category {id:$cid}) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) WITH c,collect(p) AS ps FOREACH (p IN ps | DETACH DELETE p) DETACH DELETE c RETURN true AS ok',tid=tid,owner=me(),cid=cid)
    if not rows:raise HTTPException(404,'Category not found')
    return {'ok':True}

@router.post('/{tid}/categories/{cid}/problems',status_code=201)
def add_problem(tid:str,cid:str,body:ProblemInput):
    accessible(tid,True)
    from difflib import SequenceMatcher
    stmt=' '.join(body.statement.split())
    existing=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem) RETURN p.description AS text',tid=tid)
    if any(SequenceMatcher(None,stmt.lower(),x['text'].lower()).ratio()>.91 for x in existing):raise HTTPException(409,'Very similar problem already exists in this target')
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def work(tx):
            row=tx.run('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream)-[:CONTAINS]->(c:Category {id:$cid}) RETURN s.id AS sid,s.name AS stream,c.name AS category',tid=tid,owner=me(),cid=cid).single()
            if not row:raise ValueError('Category not found')
            pid=tx.run('MERGE (counter:IdCounter {name:"problem"}) ON CREATE SET counter.next=0 SET counter.next=counter.next+1 RETURN counter.next AS id').single()['id']
            tx.run('MATCH (c:Category {id:$cid}) CREATE (p:Problem {id:$pid,description:$statement,ownerId:$owner,targetId:$tid,streamId:$sid,streamName:$stream,categoryName:$cat,origin:"manual",reviewStatus:"needs_review",createdAt:datetime()}) CREATE (c)-[:CONTAINS]->(p)',cid=cid,pid=pid,statement=stmt,owner=me(),tid=tid,sid=row['sid'],stream=row['stream'],cat=row['category']).consume()
            return pid
        try: pid=session.execute_write(work)
        except ValueError as exc:raise HTTPException(404,str(exc)) from exc
    from . import jobs
    jobs.queue_problem(me(),pid)
    return {'id':pid,'statement':stmt}

@router.patch('/{tid}/problems/{pid}')
def change_problem(tid:str,pid:int,body:ProblemInput):
    accessible(tid,True)
    rows=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem {id:$pid}) SET p.description=$statement, p.embedding=null RETURN p.id AS id',tid=tid,owner=me(),pid=pid,statement=body.statement.strip())
    if not rows:raise HTTPException(404,'Problem not found')
    from . import jobs
    jobs.queue_problem(me(),pid)
    return rows[0]

@router.delete('/{tid}/problems/{pid}')
def remove_problem(tid:str,pid:int):
    accessible(tid,True)
    rows=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem {id:$pid}) DETACH DELETE p RETURN true AS ok',tid=tid,owner=me(),pid=pid)
    if not rows:raise HTTPException(404,'Problem not found')
    return {'ok':True}
