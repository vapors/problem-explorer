import json, os, uuid, math, re
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from contextvars import ContextVar
from urllib.parse import urlsplit
from . import auth
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .db import query, execute
from .seed import seed
from . import ai, semantic
from . import jobs

@asynccontextmanager
async def lifespan(app):
    auth.init_db()
    if os.getenv('AUTO_SEED','false').lower()=='true': seed()
    jobs.start()
    yield
    jobs.stop()

app=FastAPI(title='Problem Explorer API',version='0.5.0',lifespan=lifespan)
app.include_router(auth.router)
current_user: ContextVar[str] = ContextVar('current_user',default='')

def uid():
    value=current_user.get()
    if not value:raise HTTPException(401,'Sign in required')
    return value

@app.middleware('http')
async def auth_guard(request:Request, call_next):
    path=request.url.path
    # Auth endpoints and health are public. All other API endpoints require an active session.
    if path.startswith('/api') and request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if origin:
            allowed={x.strip() for x in os.getenv('PUBLIC_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',')}
            allowed.add(str(request.base_url).rstrip('/'))
            if origin not in allowed:return JSONResponse({'detail':'Cross-site request blocked'},status_code=403)
    if path.startswith('/api/') and not (path.startswith('/api/auth/') or path=='/api/health') and request.method!='OPTIONS':
        user=auth.session_user(request)
        if not user:return JSONResponse({'detail':'Authentication required'},status_code=401)
        token=current_user.set(user['id'])
        ai_paths=('/research','/concepts/generate','/discoveries/search','/match','/evaluate')
        metered=request.method=='POST' and path.endswith(ai_paths)
        if metered and not auth.reserve_ai_request(user['id']):
            current_user.reset(token)
            return JSONResponse({'detail':'Daily AI request limit reached. Try again tomorrow.'},status_code=429)
        try:return await call_next(request)
        finally:current_user.reset(token)
    return await call_next(request)

allowed=os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',')
app.add_middleware(CORSMiddleware,allow_origins=allowed,allow_methods=['GET','POST','PATCH'],allow_headers=['*'])

class ResearchRequest(BaseModel):
    focus: str=Field(default='prevalence, severity, populations affected, existing alternatives and shortcomings',max_length=800)

class DiscoveryRequest(BaseModel):
    topic: str=Field(min_length=10,max_length=1200)

class ReviewRequest(BaseModel):
    statement: str|None=Field(default=None,min_length=20,max_length=600)

class ManualProblemRequest(BaseModel):
    statement: str=Field(min_length=20,max_length=600)
    categoryId: str=Field(min_length=3,max_length=150)

class SearchRequest(BaseModel):
    text: str=Field(min_length=3,max_length=1000)
    stream: str=''
    mode: str='hybrid'

class SolutionRequest(BaseModel):
    name: str=Field(min_length=2,max_length=140)
    description: str=Field(min_length=15,max_length=5000)

@app.get('/api/health')
def health():
    try:
        count=query('MATCH (p:Problem) WHERE p.ownerId IS NULL OR p.ownerId=$owner RETURN count(p) AS n',owner=uid())[0]['n']
        return {'ok':True,'neo4j':True,'problemCount':count,'openaiConfigured':bool(os.getenv('OPENAI_API_KEY'))}
    except Exception as exc: raise HTTPException(503,'Neo4j is unavailable; check logs and configuration') from exc

@app.get('/api/stats')
def stats():
    r=query('MATCH (s:Stream) OPTIONAL MATCH (s)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem) WHERE (s.ownerId IS NULL OR s.ownerId=$owner) AND (p IS NULL OR p.ownerId IS NULL OR p.ownerId=$owner) RETURN s.id AS id,s.name AS name,count(DISTINCT p) AS count ORDER BY s.id',owner=uid())
    n=query('MATCH (n:Solution) WHERE n.ownerId=$owner RETURN count(n) AS count',owner=uid())[0]['count']
    return {'streams':r,'problems':sum(x['count'] for x in r),'solutions':n,'discovered':query("MATCH (p:Problem) WHERE p.origin='ai_discovered_reviewed' AND p.ownerId=$owner RETURN count(p) AS n",owner=uid())[0]['n']}

@app.get('/api/hierarchy')
def hierarchy():
    return query('MATCH (s:Stream)-[:CONTAINS]->(c:Category) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) WHERE (s.ownerId IS NULL OR s.ownerId=$owner) AND (p IS NULL OR p.ownerId IS NULL OR p.ownerId=$owner) AND (c.ownerId IS NULL OR c.ownerId=$owner) RETURN s.id AS streamId,s.name AS stream,c.id AS categoryId,c.name AS category,count(p) AS count ORDER BY s.id,c.id',owner=uid())

@app.get('/api/graph/root')
def graph_root():
    rows=query('MATCH (s:Stream) OPTIONAL MATCH (s)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem) WHERE (s.ownerId IS NULL OR s.ownerId=$owner) AND (p IS NULL OR p.ownerId IS NULL OR p.ownerId=$owner) RETURN s.id AS id,s.name AS name,count(DISTINCT p) AS count ORDER BY s.id',owner=uid())
    return {'nodes':[{'data':{'id':'root','label':'Problem Explorer','type':'root'}}]+[{'data':{'id':x['id'],'label':x['name'].split('—')[-1].strip(),'type':'stream','count':x['count']}} for x in rows],'edges':[{'data':{'id':'root-'+x['id'],'source':'root','target':x['id']}} for x in rows]}

@app.get('/api/graph/expand/{node_id:path}')
def graph_expand(node_id:str):
    if node_id.startswith('S') and ':' not in node_id:
        rows=query('MATCH (s:Stream {id:$id})-[:CONTAINS]->(c:Category) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) WHERE (c.ownerId IS NULL OR c.ownerId=$owner) AND (p IS NULL OR p.ownerId IS NULL OR p.ownerId=$owner) RETURN c.id AS id,c.name AS label,count(p) AS count ORDER BY c.id',id=node_id,owner=uid())
        kind='category'
    elif ':' in node_id and node_id.startswith('S'):
        rows=query('MATCH (c:Category {id:$id})-[:CONTAINS]->(p:Problem) WHERE (c.ownerId IS NULL OR c.ownerId=$owner) AND (p.ownerId IS NULL OR p.ownerId=$owner) RETURN toString(p.id) AS id,p.description AS label,0 AS count ORDER BY p.id',id=node_id,owner=uid())
        kind='problem'
    elif node_id.startswith('P') and node_id[1:].isdigit():
        pid=int(node_id[1:]); rows=query('MATCH (p:Problem {id:$id}) WHERE p.ownerId IS NULL OR p.ownerId=$owner OPTIONAL MATCH (p)<-[:ABOUT]-(f:Finding {ownerId:$owner}) RETURN p.id AS pid,collect(DISTINCT {id:f.id,label:f.claim}) AS findings',id=pid,owner=uid())
        fs=rows[0]['findings'] if rows else []
        ns=[{'data':{'id':'F'+str(x['id']),'label':x['label'][:92],'type':'finding'}} for x in fs if x.get('id')]
        return {'nodes':ns,'edges':[{'data':{'id':node_id+'-'+n['data']['id'],'source':node_id,'target':n['data']['id']}} for n in ns]}
    else: return {'nodes':[],'edges':[]}
    nodes=[]; edges=[]
    for r in rows:
        target='P'+r['id'] if kind=='problem' else r['id']
        nodes.append({'data':{'id':target,'label':r['label'],'type':kind,'count':r['count']}})
        edges.append({'data':{'id':node_id+'-'+target,'source':node_id,'target':target}})
    return {'nodes':nodes,'edges':edges}

@app.get('/api/problems')
def problems(q:str='',stream:str='',category:str='',limit:int=100,offset:int=0):
    limit=min(max(1,limit),2000);offset=max(0,offset)
    return query('''MATCH (p:Problem)<-[:CONTAINS]-(c:Category)<-[:CONTAINS]-(s:Stream)
      WHERE ($q = '' OR toLower(p.description) CONTAINS toLower($q)) AND ($stream = '' OR s.id=$stream) AND ($category='' OR c.id=$category)
      AND (p.ownerId IS NULL OR p.ownerId=$owner) AND (s.ownerId IS NULL OR s.ownerId=$owner) RETURN p.id AS id,p.description AS description,s.id AS streamId,c.id AS categoryId,c.name AS category
      ORDER BY p.id SKIP $offset LIMIT $limit''',q=q,stream=stream,category=category,offset=offset,limit=limit,owner=uid())

@app.post('/api/problems')
def create_manual_problem(body:ManualProblemRequest):
    statement=' '.join(body.statement.split())
    novelty=semantic.nearest_duplicate(statement)
    if novelty['blocked'] or novelty['needsReview']:
        raise HTTPException(409,{'message':'This may duplicate an existing problem. Refine its scope or wording before adding.', 'nearest':novelty['matches'][:3]})
    from .db import driver
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def transact(tx):
            category=tx.run('MATCH (s:Stream)-[:CONTAINS]->(c:Category {id:$cat}) WHERE (s.ownerId IS NULL OR s.ownerId=$owner) AND (c.ownerId IS NULL OR c.ownerId=$owner) RETURN s.id AS sid,s.name AS sname,c.name AS cname',cat=body.categoryId,owner=uid()).single()
            if not category:raise ValueError('Select an existing category')
            new=tx.run('MATCH (counter:IdCounter {name:"problem"}) SET counter.next=counter.next+1 RETURN counter.next AS id').single()
            if not new:raise ValueError('Problem ID counter missing')
            pid=new['id']
            tx.run('''MATCH (c:Category {id:$cat}) CREATE (p:Problem {id:$id,description:$statement,
              origin:'manual_reviewed',ownerId:$owner,streamId:$sid,streamName:$sname,categoryName:$cname,createdAt:datetime()})
              CREATE (c)-[:CONTAINS]->(p)''',cat=body.categoryId,id=pid,statement=statement,
              sid=category['sid'],sname=category['sname'],cname=category['cname'],owner=uid()).consume()
            return pid
        try: pid=session.execute_write(transact)
        except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    jobs.queue_problem(uid(),pid)
    return {'id':pid,'statement':statement,'status':'created'}

@app.get('/api/problems/{pid}')
def problem(pid:int):
    rows=query('''MATCH (p:Problem {id:$pid})<-[:CONTAINS]-(c:Category)<-[:CONTAINS]-(s:Stream)
    WHERE (p.ownerId IS NULL OR p.ownerId=$owner) AND (s.ownerId IS NULL OR s.ownerId=$owner) RETURN p.id AS id,p.description AS description,s.id AS streamId,s.name AS stream,c.name AS category''',pid=pid,owner=uid())
    if not rows: raise HTTPException(404,'Problem not found')
    out=rows[0]
    out['findings']=query('''MATCH (f:Finding)-[:ABOUT]->(p:Problem {id:$pid}) WHERE f.ownerId=$owner OPTIONAL MATCH (f)-[:DERIVED_FROM]->(src:Source)
       RETURN f.id AS id,f.claim AS claim,f.population AS population,f.statistic AS statistic,f.limitations AS limitations,f.confidence AS confidence,f.reviewStatus AS reviewStatus,src.url AS url,src.title AS title ORDER BY f.createdAt DESC LIMIT 100''',pid=pid,owner=uid())
    out['researchRuns']=query('MATCH (r:ResearchRun)-[:RESEARCHES]->(p:Problem {id:$pid}) WHERE r.ownerId=$owner RETURN r.id AS id,r.createdAt AS createdAt,r.focus AS focus,r.gaps AS gaps,r.conflicting AS conflicting ORDER BY r.createdAt DESC LIMIT 10',pid=pid,owner=uid())
    out['conceptDrafts']=query('MATCH (b:ConceptBatch)-[:GENERATED_FOR]->(p:Problem {id:$pid}) WHERE b.ownerId=$owner MATCH (b)-[:PROPOSED]->(d:ConceptDraft) RETURN d.id AS id,d.name AS name,d.status AS status ORDER BY d.createdAt DESC LIMIT 50',pid=pid,owner=uid())
    out['solutions']=query('MATCH (s:Solution)-[rel:ADDRESSES]->(p:Problem {id:$pid}) WHERE s.ownerId=$owner RETURN s.id AS id,s.name AS name,rel.relationship AS relationship,rel.relevance AS relevance ORDER BY rel.relevance DESC',pid=pid,owner=uid())
    return out

class GenerateConceptsRequest(BaseModel):
    count: int=Field(default=4,ge=2,le=6)
    direction: str=Field(default='',max_length=1000)

class SaveGeneratedConceptRequest(BaseModel):
    name: str=Field(min_length=3,max_length=140)
    description: str=Field(min_length=40,max_length=5000)

@app.post('/api/problems/{pid}/concepts/generate')
def generate_problem_concepts(pid:int,body:GenerateConceptsRequest):
    obj=problem(pid)
    # Retrieved findings are provisional unless explicitly reviewed.
    research=[{'claim':x['claim'],'source':x['url'],'reviewStatus':x['reviewStatus'],'limitations':x['limitations']} for x in obj['findings']]
    try:
        result=ai.generate_concepts(pid,obj['description'],research,obj['solutions'],body.count,body.direction)
        batchid=str(uuid.uuid4())
        execute("""MATCH (p:Problem {id:$pid}) WHERE p.ownerId IS NULL OR p.ownerId=$owner CREATE (b:ConceptBatch {id:$bid,ownerId:$owner,framing:$framing,limitations:$limitations,createdAt:datetime(),direction:$direction}) MERGE (b)-[:GENERATED_FOR]->(p)""",pid=pid,bid=batchid,framing=result.framing,limitations=result.research_limitations,direction=body.direction,owner=uid())
        generated=[]
        for idea in result.concepts:
            payload=idea.model_dump(); gid=str(uuid.uuid4())
            execute("""MATCH (b:ConceptBatch {id:$bid}) WHERE b.ownerId=$owner CREATE (d:ConceptDraft {id:$gid,ownerId:$owner,name:$name,description:$description,payload:$payload,status:'proposed',createdAt:datetime()}) MERGE (b)-[:PROPOSED]->(d)""",bid=batchid,gid=gid,name=idea.name,description=idea.description,payload=json.dumps(payload),owner=uid())
            generated.append({'id':gid,'status':'proposed',**payload})
        return {'batchId':batchid,'problemId':pid,'framing':result.framing,'researchLimitations':result.research_limitations,'concepts':generated}
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    except Exception as exc:raise HTTPException(502,'Concept generation failed; inspect API logs') from exc

@app.get('/api/problems/{pid}/concepts')
def generated_problem_concepts(pid:int):
    problem(pid)
    rows=query("""MATCH (b:ConceptBatch)-[:GENERATED_FOR]->(p:Problem {id:$pid}) WHERE b.ownerId=$owner MATCH (b)-[:PROPOSED]->(d:ConceptDraft) OPTIONAL MATCH (d)-[:PROMOTED_TO]->(s:Solution) RETURN d.id AS id,d.name AS name,d.description AS description,d.payload AS payload,d.status AS status,s.id AS solutionId,b.id AS batchId,b.createdAt AS createdAt ORDER BY b.createdAt DESC LIMIT 80""",pid=pid,owner=uid())
    for r in rows:
        r['details']=json.loads(r.pop('payload'))
        r['createdAt']=str(r.get('createdAt') or '')
    return rows

@app.post('/api/concept-drafts/{did}/save')
def save_concept_draft(did:str,body:SaveGeneratedConceptRequest):
    # User explicitly promotes a single concept; rerunning is idempotent.
    existing=query('MATCH (d:ConceptDraft {id:$did})-[:PROMOTED_TO]->(s:Solution) WHERE d.ownerId=$owner RETURN s.id AS id,s.name AS name,s.description AS description',did=did,owner=uid())
    if existing:return existing[0]
    sid=str(uuid.uuid4())
    out=execute("""MATCH (b:ConceptBatch)-[:PROPOSED]->(d:ConceptDraft {id:$did})-[:NOTHING]->(x) RETURN x""",did=did) if False else None
    rows=query('MATCH (b:ConceptBatch)-[:PROPOSED]->(d:ConceptDraft {id:$did}) WHERE b.ownerId=$owner MATCH (b)-[:GENERATED_FOR]->(p:Problem) RETURN p.id AS pid',did=did,owner=uid())
    if not rows:raise HTTPException(404,'Concept draft not found')
    execute("""MATCH (b:ConceptBatch)-[:PROPOSED]->(d:ConceptDraft {id:$did}) WHERE b.ownerId=$owner AND d.status='proposed' MATCH (b)-[:GENERATED_FOR]->(p:Problem) CREATE (s:Solution {id:$sid,ownerId:$owner,name:$name,description:$description,origin:'ai_generated_user_saved',createdAt:datetime(),generationDraftId:$did}) MERGE (d)-[:PROMOTED_TO]->(s) MERGE (s)-[:INSPIRED_BY]->(p) SET d.status='saved',d.savedAt=datetime()""",did=did,sid=sid,name=body.name,description=body.description,owner=uid())
    return {'id':sid,'name':body.name,'description':body.description,'originProblemId':rows[0]['pid']}

@app.post('/api/problems/{pid}/research')
def research(pid:int,body:ResearchRequest):
    obj=problem(pid)
    try:
        result=ai.research(pid,obj['description'],body.focus)
        rid=str(uuid.uuid4())
        execute('''MATCH (p:Problem {id:$pid}) WHERE p.ownerId IS NULL OR p.ownerId=$owner MERGE (r:ResearchRun {id:$rid}) SET r.ownerId=$owner, r.focus=$focus,r.createdAt=datetime(),r.gaps=$gaps,r.conflicting=$conflicting,r.questions=$questions MERGE (r)-[:RESEARCHES]->(p)''',pid=pid,rid=rid,focus=body.focus,gaps=result.gaps,conflicting=result.conflicting_evidence,questions=result.follow_up_questions,owner=uid())
        for finding in result.findings:
            fid=str(uuid.uuid4()); f=finding.model_dump()
            execute('''MATCH (p:Problem {id:$pid}),(r:ResearchRun {id:$rid}) WHERE r.ownerId=$owner AND (p.ownerId IS NULL OR p.ownerId=$owner)
             MERGE (src:Source {url:$url}) SET src.title=$title,src.publisher=$publisher,src.publishedAt=$published
             CREATE (f:Finding {id:$fid,ownerId:$owner,claim:$claim,population:$population,statistic:$statistic,limitations:$limitations,confidence:$confidence,reviewStatus:'needs_review',createdAt:datetime()})
             MERGE (f)-[:ABOUT]->(p) MERGE (f)-[:DERIVED_FROM]->(src) MERGE (r)-[:PRODUCED]->(f)''',pid=pid,rid=rid,fid=fid,url=f['url'],title=f['title'],publisher=f['publisher'],published=f['published_at'],claim=f['claim'],population=f['population'],statistic=f['statistic'],limitations=f['limitations'],confidence=f['confidence'],owner=uid())
        return {'researchRunId':rid,'data':result.model_dump(),'saved':len(result.findings)}
    except (ValueError, RuntimeError) as exc: raise HTTPException(422,str(exc)) from exc
    except Exception as exc: raise HTTPException(502,'Research provider failed; consult API logs') from exc

@app.post('/api/solutions')
def create_solution(body:SolutionRequest):
    sid=str(uuid.uuid4()); execute('CREATE (s:Solution {id:$sid,ownerId:$owner,name:$name,description:$description,createdAt:datetime()})',sid=sid,name=body.name,description=body.description,owner=uid())
    return {'id':sid,'name':body.name,'description':body.description}

@app.get('/api/solutions')
def solutions():
    return query('MATCH (s:Solution) WHERE s.ownerId=$owner RETURN s.id AS id,s.name AS name,s.description AS description ORDER BY s.createdAt DESC LIMIT 100',owner=uid())

@app.get('/api/solutions/{sid}')
def solution(sid:str):
    rows=query('MATCH (s:Solution {id:$sid}) WHERE s.ownerId=$owner RETURN s.id AS id,s.name AS name,s.description AS description',sid=sid,owner=uid())
    if not rows: raise HTTPException(404,'Solution not found')
    out=rows[0]
    out['originProblems']=query('MATCH (s:Solution {id:$sid})-[:INSPIRED_BY]->(p:Problem) WHERE s.ownerId=$owner RETURN p.id AS id,p.description AS description',sid=sid,owner=uid())
    out['matches']=query('MATCH (s:Solution {id:$sid})-[r:ADDRESSES]->(p:Problem) WHERE s.ownerId=$owner RETURN p.id AS problemId,p.description AS description,r.relationship AS relationship,r.relevance AS relevance,r.rationale AS rationale,r.confidence AS confidence ORDER BY r.relevance DESC',sid=sid,owner=uid())
    out['evaluations']=query('MATCH (e:Evaluation)-[:ASSESSES]->(s:Solution {id:$sid}) WHERE e.ownerId=$owner RETURN e.id AS id,e.createdAt AS createdAt,e.payload AS payload ORDER BY e.createdAt DESC LIMIT 10',sid=sid,owner=uid())
    return out

@app.post('/api/search')
def search_problems(body:SearchRequest):
    if body.mode=='exact':
        rows=query('MATCH (p:Problem) WHERE (p.ownerId IS NULL OR p.ownerId=$owner) AND toLower(p.description) CONTAINS toLower($text) AND ($stream="" OR p.streamId=$stream) RETURN p.id AS id,p.description AS description,p.origin AS origin,p.streamId AS streamId LIMIT 100',text=body.text,stream=body.stream,owner=uid())
        return {'mode':'exact','results':rows}
    try: return semantic.similar(body.text,limit=80,stream=body.stream,semantic_only=body.mode=='semantic')
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc

@app.get('/api/index/status')
def index_status():
    missing=query('MATCH (p:Problem) WHERE p.embedding IS NULL AND (p.ownerId IS NULL OR p.ownerId=$owner) RETURN count(p) AS n',owner=uid())[0]['n']
    return {'ready':missing==0,'remaining':missing,'jobs':jobs.status(uid())}

@app.post('/api/index/queue')
def queue_my_index():
    return jobs.queue_owner(uid())

@app.get('/api/discoveries')
def discoveries():
    return query('MATCH (d:Discovery) WHERE d.ownerId=$owner RETURN d.id AS id,d.statement AS statement,d.status AS status,d.topic AS topic,d.streamId AS streamId,d.categoryId AS categoryId,d.evidenceUrls AS evidenceUrls,d.rationale AS rationale,d.neighborsJson AS neighborsJson,d.createdAt AS createdAt ORDER BY d.createdAt DESC LIMIT 200',owner=uid())

@app.post('/api/discoveries/search')
def discovery_search(body:DiscoveryRequest):
    categories=query('MATCH (c:Category) RETURN c.id AS id,c.name AS name ORDER BY c.id')
    existing=query('MATCH (p:Problem) WHERE p.ownerId IS NULL OR p.ownerId=$owner RETURN p.description AS description ORDER BY p.id LIMIT 2000',owner=uid())
    sample='; '.join(x['description'] for x in existing)
    try: result=ai.discover(body.topic,categories,sample)
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc
    except Exception as exc: raise HTTPException(502,'Discovery provider failed; consult API logs') from exc
    added=[]; excluded=0; seen_statements=[]
    from difflib import SequenceMatcher
    existing_queue=query("MATCH (d:Discovery) WHERE d.ownerId=$owner AND d.status IN ['pending_review','duplicate_candidate','approved'] RETURN d.statement AS statement",owner=uid())
    prior=[str(r['statement']) for r in existing_queue if r.get('statement')]
    for c in result.candidates:
        normalized=' '.join(c.statement.lower().split())
        if any(SequenceMatcher(None,normalized,' '.join(p.lower().split())).ratio()>=0.83 for p in prior+seen_statements):
            excluded+=1;continue
        novelty=semantic.nearest_duplicate(c.statement)
        if novelty['blocked']:
            excluded+=1;continue
        seen_statements.append(c.statement)

        # Discovery is persistent even when a duplicate. Only approved entries become Problem nodes.
        did=str(uuid.uuid4()); status='duplicate_candidate' if novelty['blocked'] else 'pending_review'
        execute('''CREATE (d:Discovery {id:$id,ownerId:$owner,statement:$statement,streamId:$stream,categoryId:$cat,topic:$topic,status:$status,evidenceUrls:$urls,rationale:$rationale,contexts:$contexts,populations:$pops,uncertainties:$uncertainties,neighborsJson:$neighbors,createdAt:datetime()})''',id=did,statement=c.statement,stream=c.stream_id,cat=c.category_id,topic=body.topic,status=status,urls=c.evidence_urls,rationale=c.rationale,contexts=c.contexts,pops=c.affected_populations,uncertainties=c.uncertainties,neighbors=json.dumps(novelty),owner=uid())
        added.append({'id':did,'statement':c.statement,'status':status,'nearest':novelty['matches'][:3]})
    return {'candidates':added,'gaps':result.research_gaps,'count':len(added),'excludedSimilar':excluded}

@app.post('/api/discoveries/{did}/approve')
def approve_discovery(did:str,body:ReviewRequest):
    rows=query('MATCH (d:Discovery {id:$id}) WHERE d.ownerId=$owner RETURN d.statement AS statement,d.status AS status,d.streamId AS stream,d.categoryId AS category',id=did,owner=uid())
    if not rows:raise HTTPException(404,'Discovery not found')
    rec=rows[0]
    if rec['status'] not in ['pending_review','duplicate_candidate']:raise HTTPException(409,'Discovery already resolved')
    statement=body.statement or rec['statement']
    novelty=semantic.nearest_duplicate(statement)
    # Never accept close matches merely by overriding a warning.
    if novelty['blocked'] or novelty['needsReview']:
        raise HTTPException(409,{'message':'Potential overlap with existing problem: resolve by rejecting/merging, or refine the statement and retry.','nearest':novelty['matches'][:5]})
    # Category validates against known ontology, and atomic id increment in a write transaction.
    from .db import driver
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as sess:
        def transact(tx):
            current=tx.run('MATCH (d:Discovery {id:$id}) WHERE d.ownerId=$owner RETURN d.status AS status',id=did,owner=uid()).single()
            if not current or current['status'] not in ('pending_review','duplicate_candidate'):raise ValueError('Already resolved')
            new=tx.run('''MATCH (counter:IdCounter {name:'problem'}) SET counter.next=counter.next+1 RETURN counter.next AS id''').single()
            if not new:raise ValueError('ID counter missing; restart API to migrate')
            pid=new['id']
            found=tx.run('''MATCH (d:Discovery {id:$did}),(c:Category {id:$cat}) WHERE d.ownerId=$owner MATCH (s:Stream)-[:CONTAINS]->(c)
             CREATE (p:Problem {id:$pid,description:$statement,origin:'ai_discovered_reviewed',ownerId:$owner,streamId:s.id,streamName:s.name,categoryName:c.name,createdAt:datetime()})
             MERGE (c)-[:CONTAINS]->(p) CREATE (d)-[:ACCEPTED_AS]->(p) SET d.status='approved',d.reviewedAt=datetime() RETURN p.id AS id''',did=did,cat=rec['category'],pid=pid,statement=statement,owner=uid()).single()
            if not found: raise ValueError('Category not found')
            return pid
        try: pid=sess.execute_write(transact)
        except ValueError as exc:raise HTTPException(409,str(exc)) from exc
    # Immediately embed; failure leaves accepted record available via lexical search, endpoint can backfill.
    # Embedding backfill is optional and user-triggered; approval must not incur
    # unmetered OpenAI API charges or depend on other users' index progress.
    return {'id':pid,'status':'approved','statement':statement}

@app.post('/api/discoveries/{did}/reject')
def reject_discovery(did:str):
    execute("MATCH (d:Discovery {id:$id}) WHERE d.ownerId=$owner AND d.status IN ['pending_review','duplicate_candidate'] SET d.status='rejected',d.reviewedAt=datetime()",id=did,owner=uid())
    return {'status':'rejected'}

@app.post('/api/discoveries/{did}/merge/{pid}')
def merge_discovery(did:str,pid:int):
    execute('''MATCH (d:Discovery {id:$did}),(p:Problem {id:$pid}) WHERE (p.ownerId IS NULL OR p.ownerId=$owner) AND d.ownerId=$owner AND d.status IN ['pending_review','duplicate_candidate'] MERGE (d)-[:DUPLICATE_OF]->(p) SET d.status='merged',d.reviewedAt=datetime()''',did=did,pid=pid,owner=uid())
    return {'status':'merged','problemId':pid}

def candidates(text):
    try:return semantic.similar(text,limit=100)['results']
    except Exception:return semantic.lexical(text,100)

@app.post('/api/solutions/{sid}/match')
def match_solution(sid:str):
    obj=solution(sid)
    try:
        raw=ai.match(obj['name']+'\n'+obj['description'],candidates(obj['description']))
        for m in raw.matches:
            execute('''MATCH (s:Solution {id:$sid}),(p:Problem {id:$pid}) WHERE s.ownerId=$owner AND (p.ownerId IS NULL OR p.ownerId=$owner)
              MERGE (s)-[r:ADDRESSES]->(p) SET r.relationship=$relationship,r.relevance=$relevance,r.rationale=$rationale,r.assumptions=$assumptions,r.confidence=$confidence,r.reviewStatus='ai_suggested',r.updatedAt=datetime()''',sid=sid,pid=m.problem_id,relationship=m.relationship,relevance=m.relevance,rationale=m.rationale,assumptions=m.assumptions,confidence=m.confidence,owner=uid())
        return raw.model_dump()
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc
    except Exception as exc: raise HTTPException(502,'Matching provider failed; consult API logs') from exc

@app.post('/api/solutions/{sid}/evaluate')
def evaluate_solution(sid:str):
    obj=solution(sid)
    matches=obj['matches']
    ids=[m['problemId'] for m in matches]
    findings=query('MATCH (f:Finding)-[:ABOUT]->(p:Problem) WHERE p.id IN $ids AND f.ownerId=$owner MATCH (f)-[:DERIVED_FROM]->(src:Source) RETURN f.claim AS claim,src.url AS url,f.limitations AS limitations,f.reviewStatus AS status LIMIT 60',ids=ids,owner=uid())
    try:
        result=ai.evaluate(obj['name']+'\n'+obj['description'],str(matches[:20]),str(findings))
        eid=str(uuid.uuid4()); payload=result.model_dump()
        execute('''MATCH (s:Solution {id:$sid}) WHERE s.ownerId=$owner CREATE (e:Evaluation {id:$eid,ownerId:$owner,payload:$payload,createdAt:datetime(),method:'provisional_ai_rubric_v1'}) MERGE (e)-[:ASSESSES]->(s)''',sid=sid,eid=eid,payload=json.dumps(payload),owner=uid())
        return {'id':eid,'data':payload,'evidenceCount':len(findings)}
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc
    except Exception as exc: raise HTTPException(502,'Evaluation provider failed; consult API logs') from exc

# Register workspace and administrator APIs separately from the legacy research endpoints.
from .workspace import router as workspace_router
app.include_router(workspace_router)

from .targets import router as targets_router
app.include_router(targets_router)
