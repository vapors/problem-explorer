"""Private research streams and administrator API. Generated items are hypotheses, not sourced evidence."""
import json, os, re, uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel,Field
from . import auth, jobs, ai
from .db import query,execute,driver

router=APIRouter(prefix='/api',tags=['workspaces'])

def identity():
    from .main import uid
    return uid()

def require_admin(request:Request):
    u=auth.session_user(request)
    if not u or u['role']!='admin':raise HTTPException(403,'Administrator access required')
    return u

class StreamCreate(BaseModel):
    name:str=Field(min_length=3,max_length=100)
    description:str=Field(default='',max_length=1000)

class SeedRequest(BaseModel):
    detail:str=Field(default='standard',pattern='^(outline|standard|detailed)$')

@router.post('/streams',status_code=201)
def create_stream(body:StreamCreate):
    owner=identity();sid='S'+uuid.uuid4().hex[:16]
    execute('CREATE (s:Stream {id:$id,name:$name,description:$description,ownerId:$owner,createdAt:datetime()})',id=sid,name=body.name.strip(),description=body.description.strip(),owner=owner)
    return {'id':sid,'name':body.name,'ownerId':owner}

@router.get('/streams/mine')
def my_streams():
    return query('MATCH (s:Stream {ownerId:$owner}) RETURN s.id AS id,s.name AS name,s.description AS description ORDER BY s.createdAt DESC',owner=identity())

@router.post('/streams/{sid}/seed')
def seed_stream(sid:str,body:SeedRequest):
    owner=identity()
    stream=query('MATCH (s:Stream {id:$id,ownerId:$owner}) RETURN s.id AS id,s.name AS name,s.description AS description',id=sid,owner=owner)
    if not stream:raise HTTPException(404,'Your stream was not found')
    # Explicit finite bounds, and previews avoid automatic unsupervised growth.
    settings={'outline':(3,0),'standard':(5,3),'detailed':(7,6)}
    nc,np=settings[body.detail]
    from pydantic import BaseModel as PModel
    class CategoryProposal(PModel):
        name:str
        problems:list[str]
    class SeedProposal(PModel):
        categories:list[CategoryProposal]
    prompt=f'''Propose a taxonomy for this USER-DEFINED research domain. Domain: {stream[0]['name']}. Scope: {stream[0]['description']}.
Generate exactly {nc} distinct, concrete categories; for each category generate exactly {np} atomic, observable, non-solution problem hypotheses.
No citations, quantitative claims, diagnoses, or assertions of research verification. Avoid duplicate categories and overlapping problems. Output plain-language labels. These are UNVERIFIED DRAFTS for subsequent user review.'''
    # A single metered request for this user; /seed is not in middleware's AI paths.
    if not auth.reserve_ai_request(owner):raise HTTPException(429,'Daily AI allowance reached')
    try:result=ai.parse_structured(SeedProposal,prompt)
    except Exception as exc:raise HTTPException(502,'Could not generate research taxonomy') from exc
    cats=[]
    seen=set()
    for c in result.categories[:nc]:
        label=' '.join(c.name.split())[:100]
        if not label or label.lower() in seen:continue
        seen.add(label.lower())
        cats.append({'name':label,'problems':[p.strip()[:600] for p in c.problems[:np] if len(p.strip())>=20]})
    return {'streamId':sid,'detail':body.detail,'draft':True,'categories':cats,'notice':'Unverified draft taxonomy. Review before saving; no sources have been validated.'}

class SaveTaxonomy(BaseModel):
    categories:list[dict]=Field(min_length=1,max_length=8)

@router.post('/streams/{sid}/taxonomy')
def save_taxonomy(sid:str,body:SaveTaxonomy):
    owner=identity()
    from .db import driver
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def work(tx):
            stream=tx.run('MATCH (s:Stream {id:$sid,ownerId:$owner}) RETURN s',sid=sid,owner=owner).single()
            if not stream:raise ValueError('Stream not found or not owned by you')
            made=[]
            for item in body.categories:
                label=str(item.get('name','')).strip()[:100]
                if len(label)<3:continue
                cid=sid+':'+uuid.uuid4().hex[:10]
                tx.run('MATCH (s:Stream {id:$sid,ownerId:$owner}) CREATE (c:Category {id:$cid,name:$label,ownerId:$owner}) CREATE (s)-[:CONTAINS]->(c)',sid=sid,owner=owner,cid=cid,label=label).consume()
                created=[]
                for p in item.get('problems',[])[:8]:
                    statement=str(p).strip()[:600]
                    if len(statement)<20:continue
                    # Scoped duplicate protection at the category level.
                    already=tx.run('MATCH (c:Category {id:$cid})-[:CONTAINS]->(p:Problem) WHERE toLower(p.description)=toLower($statement) RETURN p.id AS id',cid=cid,statement=statement).single()
                    if already:continue
                    nxt=tx.run('MERGE (counter:IdCounter {name:"problem"}) ON CREATE SET counter.next=0 SET counter.next=counter.next+1 RETURN counter.next AS id').single()
                    pid=nxt['id']
                    tx.run('MATCH (c:Category {id:$cid}) CREATE (p:Problem {id:$pid,description:$statement,origin:"ai_taxonomy_draft",reviewStatus:"needs_review",ownerId:$owner,streamId:$sid,streamName:$sname,categoryName:$label,createdAt:datetime()}) CREATE (c)-[:CONTAINS]->(p)',cid=cid,pid=pid,statement=statement,owner=owner,sid=sid,sname=stream['s']['name'],label=label).consume()
                    created.append(pid)
                made.append({'id':cid,'name':label,'problems':created})
            return made
        try:created=session.execute_write(work)
        except ValueError as exc:raise HTTPException(404,str(exc)) from exc
    if any(c['problems'] for c in created):jobs.queue_owner(owner)
    return {'categories':created,'draft':True,'message':'Saved in private workspace as unverified drafts'}

@router.get('/admin/overview')
def admin_overview(request:Request):
    require_admin(request)
    with auth.conn() as c:
        users=[dict(r) for r in c.execute('SELECT id,email,name,role,status,ai_daily_limit,created_at FROM users ORDER BY created_at DESC LIMIT 250')]
        usage=[dict(r) for r in c.execute('SELECT user_id,day,requests FROM ai_usage ORDER BY day DESC,requests DESC LIMIT 250')]
        queue=[dict(r) for r in c.execute('SELECT id,owner_id,kind,state,processed,error,created_at FROM embedding_jobs ORDER BY created_at DESC LIMIT 60')]
    return {'users':users,'usage':usage,'jobs':queue,'dailyLimit':int(os.getenv('DAILY_AI_REQUEST_LIMIT','15'))}

@router.post('/admin/index-shared')
def admin_queue_shared(request:Request):
    require_admin(request)
    return jobs.queue_shared()

class AccountUpdate(BaseModel):
    role:str|None=Field(default=None,pattern='^(admin|user)$')
    status:str|None=Field(default=None,pattern='^(active|disabled)$')
    ai_daily_limit:int|None=Field(default=None,ge=0,le=100000)

@router.patch('/admin/users/{user_id}')
def admin_update(user_id:str,body:AccountUpdate,request:Request):
    admin=require_admin(request)
    if admin['id']==user_id:raise HTTPException(400,'Cannot modify your own administrator access here')
    with auth.conn() as c:
        target=c.execute('SELECT id FROM users WHERE id=?',(user_id,)).fetchone()
        if not target:raise HTTPException(404,'User not found')
        if body.role is not None:c.execute('UPDATE users SET role=? WHERE id=?',(body.role,user_id))
        if body.status is not None:
            c.execute('UPDATE users SET status=? WHERE id=?',(body.status,user_id))
            if body.status=='disabled':c.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
        if body.ai_daily_limit is not None:c.execute('UPDATE users SET ai_daily_limit=? WHERE id=?',(body.ai_daily_limit,user_id))
    return {'ok':True}
