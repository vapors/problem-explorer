"""Problem Explorer v0.7: target-scoped discovery, evidence, concepts, matching and analysis.
All research IDs are checked against a target path before access. Shared targets are
read-only: copy them into a private workspace before commissioning AI work.
"""
import json, os, re, uuid
from difflib import SequenceMatcher
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .db import query, execute, driver
from .targets import accessible, me
from . import ai, auth, jobs, semantic

router=APIRouter(prefix='/api/targets/{tid}',tags=['research'])

class ResearchRequest(BaseModel):
    focus:str=Field(default='prevalence, lived experience, barriers, existing responses and gaps',max_length=800)
class ConceptRequest(BaseModel):
    count:int=Field(default=4,ge=2,le=6)
    direction:str=Field(default='',max_length=1000)
class ConceptInput(BaseModel):
    name:str=Field(min_length=3,max_length=140)
    description:str=Field(min_length=40,max_length=5000)
class SearchRequest(BaseModel):
    text:str=Field(min_length=3,max_length=1000)
    mode:str=Field(default='hybrid',pattern='^(exact|hybrid|semantic)$')
class DiscoveryRequest(BaseModel):
    topic:str=Field(min_length=10,max_length=1200)
class ReviewRequest(BaseModel):
    statement:str|None=Field(default=None,min_length=20,max_length=600)
class SeedRequest(BaseModel):
    detail:str=Field(default='standard',pattern='^(outline|standard|detailed)$')
class CategoryProposal(BaseModel):
    name:str
    problems:list[str]
class SeedProposal(BaseModel):
    categories:list[CategoryProposal]
class SaveTaxonomy(BaseModel):
    categories:list[CategoryProposal]=Field(min_length=1,max_length=8)

def problem_row(tid:str,pid:int):
    accessible(tid)
    rows=query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream)-[:CONTAINS]->(c:Category)-[:CONTAINS]->(p:Problem {id:$pid})
        RETURN p.id AS id,p.description AS description,p.origin AS origin,p.reviewStatus AS reviewStatus,
               s.id AS streamId,s.name AS stream,c.id AS categoryId,c.name AS category''',tid=tid,pid=pid)
    if not rows:raise HTTPException(404,'Problem not found in selected target')
    return rows[0]

def concept_row(tid:str,sid:str):
    accessible(tid)
    rows=query('MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner}) RETURN s.id AS id,s.name AS name,s.description AS description',tid=tid,sid=sid,owner=me())
    if not rows:raise HTTPException(404,'Concept not found in selected target')
    return rows[0]

def all_candidates(tid:str):
    return query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem)
        RETURN p.id AS id,p.description AS description,p.streamId AS streamId,p.origin AS origin''',tid=tid)

def lexical(tid:str,text:str,limit:int=80):
    words=set(re.findall(r'[a-z0-9]{3,}',text.lower()))-{'the','and','for','with','that','this','people','their'}
    matches=[]
    for p in all_candidates(tid):
        lowered=p['description'].lower()
        score=sum(w in lowered for w in words)+(8 if text.lower() in lowered else 0)
        if score:matches.append({**p,'score':round(score/max(1,len(words)),3),'searchMode':'lexical'})
    return sorted(matches,key=lambda x:(-x['score'],x['id']))[:limit]

def nearest(tid:str,text:str):
    rows=all_candidates(tid)
    candidates=sorted(({'id':r['id'],'description':r['description'],'score':round(SequenceMatcher(None,text.lower(),r['description'].lower()).ratio(),3)} for r in rows),key=lambda x:-x['score'])[:5]
    return {'matches':candidates,'blocked':any(x['score']>=.91 for x in candidates),'needsReview':any(x['score']>=.75 for x in candidates)}

@router.get('/stats')
def stats(tid:str):
    accessible(tid)
    rows=query('''MATCH (t:Target {id:$tid}) OPTIONAL MATCH (t)-[:HAS_STREAM]->(s:Stream)
      OPTIONAL MATCH (s)-[:CONTAINS]->(c:Category) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem)
      RETURN count(DISTINCT s) AS streams,count(DISTINCT c) AS categories,count(DISTINCT p) AS problems''',tid=tid)
    solutions=query('MATCH (s:Solution {targetId:$tid,ownerId:$owner}) RETURN count(s) AS n',tid=tid,owner=me())[0]['n']
    return {**rows[0],'solutions':solutions}

@router.get('/problems')
def problems(tid:str,q:str='',category:str='',limit:int=200):
    accessible(tid)
    return query('''MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream)-[:CONTAINS]->(c:Category)-[:CONTAINS]->(p:Problem)
       WHERE ($q='' OR toLower(p.description) CONTAINS toLower($q)) AND ($category='' OR c.id=$category)
       RETURN p.id AS id,p.description AS description,c.name AS category,c.id AS categoryId,s.name AS stream,s.id AS streamId,
              p.origin AS origin,p.reviewStatus AS reviewStatus
       ORDER BY p.id LIMIT $limit''',tid=tid,q=q,category=category,limit=min(1000,max(1,limit)))

@router.get('/problems/{pid}')
def get_problem(tid:str,pid:int):
    out=problem_row(tid,pid)
    out['findings']=query('''MATCH (f:Finding {targetId:$tid,ownerId:$owner})-[:ABOUT]->(p:Problem {id:$pid})
      OPTIONAL MATCH (f)-[:DERIVED_FROM]->(src:Source)
      RETURN f.id AS id,f.claim AS claim,f.population AS population,f.statistic AS statistic,f.limitations AS limitations,
             f.confidence AS confidence,f.reviewStatus AS reviewStatus,src.url AS url,src.title AS title
      ORDER BY f.createdAt DESC LIMIT 100''',tid=tid,pid=pid,owner=me())
    out['researchRuns']=query('MATCH (r:ResearchRun {targetId:$tid,ownerId:$owner})-[:RESEARCHES]->(p:Problem {id:$pid}) RETURN r.id AS id,r.focus AS focus,r.gaps AS gaps,r.createdAt AS createdAt ORDER BY r.createdAt DESC LIMIT 20',tid=tid,pid=pid,owner=me())
    out['conceptDrafts']=query('MATCH (b:ConceptBatch {targetId:$tid,ownerId:$owner})-[:GENERATED_FOR]->(p:Problem {id:$pid}) MATCH (b)-[:PROPOSED]->(d:ConceptDraft) RETURN d.id AS id,d.name AS name,d.status AS status',tid=tid,pid=pid,owner=me())
    return out

@router.post('/problems/{pid}/research')
def research_problem(tid:str,pid:int,body:ResearchRequest):
    accessible(tid,True)
    p=problem_row(tid,pid)
    try:result=ai.research(pid,p['description'],body.focus)
    except Exception as exc:raise HTTPException(502,'Research provider failed; consult server logs') from exc
    rid=str(uuid.uuid4())
    execute('''MATCH (p:Problem {id:$pid,targetId:$tid}) CREATE (r:ResearchRun {id:$rid,ownerId:$owner,targetId:$tid,
      focus:$focus,gaps:$gaps,conflicting:$conflicting,questions:$questions,createdAt:datetime()}) CREATE (r)-[:RESEARCHES]->(p)''',
        tid=tid,pid=pid,rid=rid,owner=me(),focus=body.focus,gaps=result.gaps,conflicting=result.conflicting_evidence,questions=result.follow_up_questions)
    for finding in result.findings:
        data=finding.model_dump();fid=str(uuid.uuid4())
        execute('''MATCH (p:Problem {id:$pid,targetId:$tid}),(r:ResearchRun {id:$rid,targetId:$tid})
           MERGE (src:Source {url:$url}) SET src.title=$title,src.publisher=$publisher,src.publishedAt=$date
           CREATE (f:Finding {id:$fid,targetId:$tid,ownerId:$owner,claim:$claim,population:$population,
             statistic:$statistic,limitations:$limitations,confidence:$confidence,reviewStatus:'needs_review',createdAt:datetime()})
           CREATE (f)-[:ABOUT]->(p) CREATE (f)-[:DERIVED_FROM]->(src) CREATE (r)-[:PRODUCED]->(f)''',
           tid=tid,pid=pid,rid=rid,fid=fid,owner=me(),url=data['url'],title=data['title'],publisher=data['publisher'],date=data['published_at'],
           claim=data['claim'],population=data['population'],statistic=data['statistic'],limitations=data['limitations'],confidence=data['confidence'])
    return {'researchRunId':rid,'saved':len(result.findings),'data':result.model_dump()}

class FindingReview(BaseModel):
    status:str=Field(pattern='^(needs_review|reviewed|rejected)$')

@router.patch('/findings/{fid}')
def review_finding(tid:str,fid:str,body:FindingReview):
    accessible(tid,True)
    rows=execute('''MATCH (f:Finding {id:$fid,targetId:$tid,ownerId:$owner})-[:ABOUT]->(p:Problem {targetId:$tid})
        SET f.reviewStatus=$status,f.reviewedAt=datetime() RETURN f.id AS id''',
        fid=fid,tid=tid,owner=me(),status=body.status)
    if not rows:raise HTTPException(404,'Finding not found in selected target')
    return {'ok':True,'status':body.status}

@router.post('/problems/{pid}/concepts/generate')
def generate(tid:str,pid:int,body:ConceptRequest):
    accessible(tid,True);p=get_problem(tid,pid)
    evidence=[{'claim':x['claim'],'source':x['url'],'reviewStatus':x['reviewStatus'],'limitations':x['limitations']} for x in p['findings']]
    existing=query('MATCH (s:Solution {targetId:$tid,ownerId:$owner}) RETURN s.name AS name,s.description AS description LIMIT 25',tid=tid,owner=me())
    try:result=ai.generate_concepts(pid,p['description'],evidence,existing,body.count,body.direction)
    except Exception as exc:raise HTTPException(502,'Concept generation failed; consult server logs') from exc
    bid=str(uuid.uuid4());items=[]
    execute('''MATCH (p:Problem {id:$pid,targetId:$tid}) CREATE (b:ConceptBatch {id:$bid,ownerId:$owner,targetId:$tid,
        framing:$framing,limitations:$limitations,direction:$direction,createdAt:datetime()}) CREATE (b)-[:GENERATED_FOR]->(p)''',
        tid=tid,pid=pid,bid=bid,owner=me(),framing=result.framing,limitations=result.research_limitations,direction=body.direction)
    for draft in result.concepts:
        d=draft.model_dump();did=str(uuid.uuid4())
        execute('''MATCH (b:ConceptBatch {id:$bid,targetId:$tid,ownerId:$owner})
            CREATE (d:ConceptDraft {id:$did,targetId:$tid,ownerId:$owner,name:$name,description:$description,
            payload:$payload,status:'proposed',createdAt:datetime()}) CREATE (b)-[:PROPOSED]->(d)''',
            tid=tid,bid=bid,owner=me(),did=did,name=d['name'],description=d['description'],payload=json.dumps(d))
        items.append({'id':did,'status':'proposed',**d})
    return {'batchId':bid,'concepts':items,'researchLimitations':result.research_limitations}

@router.get('/problems/{pid}/concepts')
def problem_concepts(tid:str,pid:int):
    problem_row(tid,pid)
    rows=query('''MATCH (b:ConceptBatch {targetId:$tid,ownerId:$owner})-[:GENERATED_FOR]->(p:Problem {id:$pid})
      MATCH (b)-[:PROPOSED]->(d:ConceptDraft) OPTIONAL MATCH (d)-[:PROMOTED_TO]->(s:Solution)
      RETURN d.id AS id,d.name AS name,d.description AS description,d.payload AS payload,d.status AS status,
             s.id AS solutionId ORDER BY d.createdAt DESC LIMIT 80''',tid=tid,pid=pid,owner=me())
    for r in rows:r['details']=json.loads(r.pop('payload') or '{}')
    return rows

@router.post('/concept-drafts/{did}/save')
def save_draft(tid:str,did:str,body:ConceptInput):
    accessible(tid,True)
    records=query('''MATCH (b:ConceptBatch {targetId:$tid,ownerId:$owner})-[:PROPOSED]->(d:ConceptDraft {id:$did})
        MATCH (b)-[:GENERATED_FOR]->(p:Problem) OPTIONAL MATCH (d)-[:PROMOTED_TO]->(s:Solution)
        RETURN p.id AS pid,s.id AS saved''',tid=tid,owner=me(),did=did)
    if not records:raise HTTPException(404,'Concept draft not found in selected target')
    if records[0]['saved']:return {'id':records[0]['saved'],'name':body.name}
    sid=str(uuid.uuid4())
    execute('''MATCH (b:ConceptBatch {targetId:$tid,ownerId:$owner})-[:PROPOSED]->(d:ConceptDraft {id:$did})
      MATCH (b)-[:GENERATED_FOR]->(p:Problem {targetId:$tid})
      CREATE (s:Solution {id:$sid,targetId:$tid,ownerId:$owner,name:$name,description:$desc,createdAt:datetime(),origin:'ai_generated_saved'})
      CREATE (d)-[:PROMOTED_TO]->(s) CREATE (s)-[:INSPIRED_BY]->(p) SET d.status='saved' ''',
      tid=tid,owner=me(),did=did,sid=sid,name=body.name,desc=body.description)
    return {'id':sid,'name':body.name}

@router.get('/solutions')
def solutions(tid:str):
    accessible(tid)
    return query('MATCH (s:Solution {targetId:$tid,ownerId:$owner}) RETURN s.id AS id,s.name AS name,s.description AS description ORDER BY s.createdAt DESC',tid=tid,owner=me())

@router.post('/solutions',status_code=201)
def create_solution(tid:str,body:ConceptInput):
    accessible(tid,True);sid=str(uuid.uuid4())
    execute('CREATE (s:Solution {id:$sid,targetId:$tid,ownerId:$owner,name:$name,description:$desc,createdAt:datetime(),origin:"manual"})',tid=tid,sid=sid,owner=me(),name=body.name,desc=body.description)
    return {'id':sid,'name':body.name,'description':body.description}

@router.get('/solutions/{sid}')
def solution(tid:str,sid:str):
    out=concept_row(tid,sid)
    out['matches']=query('''MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner})-[r:ADDRESSES]->(p:Problem {targetId:$tid})
       RETURN p.id AS problemId,p.description AS description,r.relationship AS relationship,r.relevance AS relevance,
              r.rationale AS rationale,r.confidence AS confidence ORDER BY r.relevance DESC''',tid=tid,sid=sid,owner=me())
    out['evaluations']=query('''MATCH (e:Evaluation {targetId:$tid,ownerId:$owner})-[:ASSESSES]->(s:Solution {id:$sid,targetId:$tid})
        RETURN e.id AS id,e.payload AS payload ORDER BY e.createdAt DESC LIMIT 20''',tid=tid,sid=sid,owner=me())
    return out

@router.post('/solutions/{sid}/match')
def match(tid:str,sid:str):
    accessible(tid,True);s=concept_row(tid,sid)
    try:out=ai.match(s['name']+'\n'+s['description'], lexical(tid,s['description'],100) or all_candidates(tid)[:100])
    except Exception as exc:raise HTTPException(502,'Matching provider failed; consult server logs') from exc
    for m in out.matches:
        execute('''MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner}),
           (p:Problem {id:$pid,targetId:$tid}) MERGE (s)-[r:ADDRESSES]->(p)
           SET r.relationship=$relationship,r.relevance=$relevance,r.rationale=$rationale,r.assumptions=$assumptions,
               r.confidence=$confidence,r.reviewStatus='ai_suggested',r.updatedAt=datetime()''',
            tid=tid,sid=sid,owner=me(),pid=m.problem_id,relationship=m.relationship,relevance=m.relevance,rationale=m.rationale,
            assumptions=m.assumptions,confidence=m.confidence)
    return out.model_dump()

@router.post('/solutions/{sid}/evaluate')
def evaluate(tid:str,sid:str):
    accessible(tid,True);s=solution(tid,sid)
    ids=[m['problemId'] for m in s['matches']]
    findings=query('''MATCH (f:Finding {targetId:$tid,ownerId:$owner})-[:ABOUT]->(p:Problem {targetId:$tid})
      WHERE p.id IN $ids MATCH (f)-[:DERIVED_FROM]->(src:Source)
      RETURN f.claim AS claim,src.url AS url,f.limitations AS limitations,f.reviewStatus AS status LIMIT 60''',tid=tid,owner=me(),ids=ids)
    try:result=ai.evaluate(s['name']+'\n'+s['description'],str(s['matches']),str(findings))
    except Exception as exc:raise HTTPException(502,'Evaluation provider failed; consult server logs') from exc
    eid=str(uuid.uuid4());payload=result.model_dump()
    execute('''MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner})
      CREATE (e:Evaluation {id:$eid,targetId:$tid,ownerId:$owner,payload:$payload,createdAt:datetime(),method:'provisional_ai_rubric_v1'})
      CREATE (e)-[:ASSESSES]->(s)''',tid=tid,sid=sid,owner=me(),eid=eid,payload=json.dumps(payload))
    return {'id':eid,'data':payload,'evidenceCount':len(findings)}

@router.post('/search')
def search(tid:str,body:SearchRequest):
    accessible(tid)
    if body.mode=='exact':return {'mode':'exact','results':lexical(tid,body.text)}
    count=query('MATCH (p:Problem {targetId:$tid}) WHERE p.embedding IS NOT NULL RETURN count(p) AS n',tid=tid)[0]['n']
    if not count:return {'mode':'lexical-fallback','results':lexical(tid,body.text),'indexCount':0}
    if not auth.reserve_ai_request(me()):raise HTTPException(429,'Daily AI allowance reached')
    try:
        vec=semantic.embed([body.text])[0]
        rows=query('''CALL db.index.vector.queryNodes("problem_embedding_v2",$k,$vector) YIELD node,score
           WHERE node.targetId=$tid RETURN node.id AS id,node.description AS description,score,
                  node.streamId AS streamId, node.origin AS origin ORDER BY score DESC LIMIT 100''',
           tid=tid,k=min(max(count*4,100),2000),vector=vec)
        seen={r['id'] for r in rows}
        if body.mode=='hybrid':rows.extend(x for x in lexical(tid,body.text) if x['id'] not in seen)
        return {'mode':body.mode,'indexCount':count,'results':rows[:100]}
    except Exception as exc:raise HTTPException(502,'Semantic search unavailable; try exact search') from exc

@router.get('/index/status')
def index_status(tid:str):
    accessible(tid)
    missing=query('MATCH (p:Problem {targetId:$tid}) WHERE p.embedding IS NULL RETURN count(p) AS n',tid=tid)[0]['n']
    return {'remaining':missing,'jobs':jobs.status(me())}

@router.post('/index/queue')
def queue_index(tid:str):
    accessible(tid,True)
    return jobs.queue_target(me(),tid)

@router.get('/discoveries')
def discoveries(tid:str):
    accessible(tid)
    return query('''MATCH (d:Discovery {targetId:$tid,ownerId:$owner})
       RETURN d.id AS id,d.statement AS statement,d.status AS status,d.topic AS topic,d.categoryId AS categoryId,
       d.evidenceUrls AS evidenceUrls,d.rationale AS rationale,d.neighborsJson AS neighborsJson
       ORDER BY d.createdAt DESC LIMIT 200''',tid=tid,owner=me())

@router.post('/discoveries/search')
def find_discoveries(tid:str,body:DiscoveryRequest):
    accessible(tid,True)
    categories=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream)-[:CONTAINS]->(c:Category) RETURN c.id AS id,c.name AS name,s.id AS streamId',tid=tid)
    if not categories:raise HTTPException(422,'Create at least one category before running discovery')
    known=all_candidates(tid)
    try:result=ai.discover(body.topic,categories,'; '.join(x['description'] for x in known[:2000]))
    except Exception as exc:raise HTTPException(502,'Discovery provider failed; consult server logs') from exc
    created=[];excluded=0;seen=[]
    for candidate in result.candidates:
        if candidate.category_id not in {x['id'] for x in categories}:continue
        if any(SequenceMatcher(None,candidate.statement.lower(),x.lower()).ratio()>.85 for x in seen):excluded+=1;continue
        duplicate=nearest(tid,candidate.statement)
        if duplicate['blocked']:excluded+=1;continue
        seen.append(candidate.statement)
        did=str(uuid.uuid4())
        execute('''CREATE (d:Discovery {id:$did,targetId:$tid,ownerId:$owner,statement:$statement,
        streamId:$sid,categoryId:$cid,topic:$topic,status:'pending_review',evidenceUrls:$urls,
        rationale:$rationale,neighborsJson:$neighbors,createdAt:datetime()})''',
        did=did,tid=tid,owner=me(),statement=candidate.statement,sid=candidate.stream_id,cid=candidate.category_id,
        topic=body.topic,urls=candidate.evidence_urls,rationale=candidate.rationale,neighbors=json.dumps(duplicate))
        created.append({'id':did,'statement':candidate.statement,'status':'pending_review','nearest':duplicate['matches']})
    return {'candidates':created,'count':len(created),'excludedSimilar':excluded,'gaps':result.research_gaps}

@router.post('/discoveries/{did}/approve')
def approve(tid:str,did:str,body:ReviewRequest):
    accessible(tid,True)
    rows=query('MATCH (d:Discovery {id:$did,targetId:$tid,ownerId:$owner}) RETURN d.statement AS statement,d.status AS status,d.categoryId AS categoryId',tid=tid,did=did,owner=me())
    if not rows:raise HTTPException(404,'Discovery not found')
    row=rows[0]
    if row['status']!='pending_review':raise HTTPException(409,'Discovery already resolved')
    text=body.statement or row['statement']
    if nearest(tid,text)['needsReview']:raise HTTPException(409,'Potentially duplicate problem; refine the statement or reject it')
    from .targets import ProblemInput, add_problem
    result=add_problem(tid,row['categoryId'],ProblemInput(statement=text))
    execute('MATCH (d:Discovery {id:$did,targetId:$tid,ownerId:$owner}) MATCH (p:Problem {id:$pid,targetId:$tid}) MERGE (d)-[:ACCEPTED_AS]->(p) SET d.status="approved",d.reviewedAt=datetime()',tid=tid,did=did,owner=me(),pid=result['id'])
    return {'id':result['id'],'status':'approved'}

@router.post('/discoveries/{did}/reject')
def reject(tid:str,did:str):
    accessible(tid,True)
    rows=execute('MATCH (d:Discovery {id:$did,targetId:$tid,ownerId:$owner,status:"pending_review"}) SET d.status="rejected",d.reviewedAt=datetime() RETURN d.id AS id',tid=tid,did=did,owner=me())
    if not rows:raise HTTPException(404,'Discovery not found')
    return {'status':'rejected'}

@router.post('/streams/{sid}/seed-preview')
def seed_preview(tid:str,sid:str,body:SeedRequest):
    accessible(tid,True)
    rows=query('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) RETURN s.name AS name,s.description AS description,t.name AS target',tid=tid,owner=me(),sid=sid)
    if not rows:raise HTTPException(404,'Stream not found')
    c,p={'outline':(3,0),'standard':(5,3),'detailed':(7,6)}[body.detail]
    prompt=(f'Propose exactly {c} research categories and exactly {p} distinct concrete observable problem hypotheses for each category. '
            f'Target: {rows[0]["target"]}. Research stream: {rows[0]["name"]}. Scope: {rows[0]["description"]}. '
            'Avoid solutions, false citations, assumptions presented as facts, and duplicate statements. '
            'Everything is an editable UNVERIFIED DRAFT awaiting research and review.')
    try:result=ai.parse_structured(SeedProposal,prompt)
    except Exception as exc:raise HTTPException(502,'Taxonomy generation failed') from exc
    return {'categories':[{'name':x.name,'problems':x.problems[:p]} for x in result.categories[:c]],'draft':True}

@router.post('/streams/{sid}/taxonomy')
def save_taxonomy(tid:str,sid:str,body:SaveTaxonomy):
    accessible(tid,True)
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as sess:
        def work(tx):
            stream=tx.run('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) RETURN s.name AS name',tid=tid,owner=me(),sid=sid).single()
            if not stream:raise ValueError('Stream not found')
            output=[]
            for cat in body.categories:
                name=' '.join(cat.name.split())[:120]
                if len(name)<3:continue
                cid=sid+':'+uuid.uuid4().hex[:12]
                tx.run('MATCH (s:Stream {id:$sid,targetId:$tid}) CREATE (c:Category {id:$cid,name:$name,targetId:$tid,ownerId:$owner}) CREATE (s)-[:CONTAINS]->(c)',sid=sid,tid=tid,cid=cid,name=name,owner=me()).consume()
                pids=[]
                for statement in cat.problems[:8]:
                    text=' '.join(statement.split())[:600]
                    if len(text)<20:continue
                    counter=tx.run('MERGE (counter:IdCounter {name:"problem"}) ON CREATE SET counter.next=0 SET counter.next=counter.next+1 RETURN counter.next AS id').single()['id']
                    tx.run('MATCH (c:Category {id:$cid,targetId:$tid}) CREATE (p:Problem {id:$pid,description:$statement,targetId:$tid,ownerId:$owner,streamId:$sid,streamName:$sname,categoryName:$cname,origin:"ai_taxonomy_draft",reviewStatus:"needs_review",createdAt:datetime()}) CREATE (c)-[:CONTAINS]->(p)',cid=cid,tid=tid,pid=counter,statement=text,owner=me(),sid=sid,sname=stream['name'],cname=name).consume()
                    pids.append(counter)
                output.append({'id':cid,'name':name,'problems':pids})
            return output
        try:created=sess.execute_write(work)
        except ValueError as exc:raise HTTPException(404,str(exc)) from exc
    if any(x['problems'] for x in created):jobs.queue_target(me(),tid)
    return {'categories':created,'draft':True}
