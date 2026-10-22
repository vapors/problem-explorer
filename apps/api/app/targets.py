"""Isolated target hierarchy. Legacy research library is a read-only shared directory entry.

No schema rewrite, Neo4j reseed, or changes to existing Stream/Problem records.
"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
from .db import query, execute

router=APIRouter(prefix='/api/targets',tags=['targets'])

def me():
    from .main import uid
    return uid()

class TargetInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)
    shared:bool=False

class SeedStream(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)

class TargetWithStreams(TargetInput):
    streams:List[SeedStream]=Field(default_factory=list,max_length=18)

class SuggestStreamsInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)
    detail:str=Field(default='standard',pattern='^(outline|standard|detailed)$')

class StreamSuggestions(BaseModel):
    streams:List[SeedStream]

class StreamInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)
    description:str=Field(default='',max_length=1500)

class CategoryInput(BaseModel):
    name:str=Field(min_length=3,max_length=120)

class ProblemInput(BaseModel):
    statement:str=Field(min_length=20,max_length=600)

def accessible(tid,write=False):
    row=query('MATCH (t:Target {id:$id}) WHERE t.ownerId=$me OR ($read AND t.shared=true) RETURN t.id AS id,t.name AS name,t.description AS description,t.ownerId AS ownerId,t.shared AS shared',id=tid,me=me(),read=not write)
    if not row:raise HTTPException(404,'Target not found or access denied')
    return row[0]

@router.get('')
def list_targets():
    mine=query('MATCH (t:Target {ownerId:$me}) RETURN t.id AS id,t.name AS name,t.description AS description,t.shared AS shared,t.ownerId AS ownerId ORDER BY t.name',me=me())
    shared=query('MATCH (t:Target {shared:true}) WHERE t.ownerId<>$me RETURN t.id AS id,t.name AS name,t.description AS description,t.shared AS shared,t.ownerId AS ownerId ORDER BY t.name',me=me())
    return {'mine':mine,'shared':shared,'reference':{'id':'reference-longevity','name':'Longevity research library','description':'Original shared reference library (legacy Neo4j data).','shared':True,'readOnly':True}}

@router.post('',status_code=201)
def create_target(body:TargetInput):
    tid='T'+uuid.uuid4().hex
    execute('CREATE (t:Target {id:$id,name:$name,description:$description,ownerId:$owner,shared:$shared,createdAt:datetime()})',id=tid,name=body.name.strip(),description=body.description.strip(),owner=me(),shared=body.shared)
    return {'id':tid,'name':body.name,'description':body.description,'shared':body.shared}

@router.post('/suggest-streams')
def suggest_streams(body:SuggestStreamsInput):
    # AI quota is counted by auth middleware on POST /suggest-streams.
    from .ai import parse_structured
    amount={'outline':3,'standard':5,'detailed':7}[body.detail]
    prompt=(f'Suggest exactly {amount} distinct, practical research streams for a problem-first '
            f'exploration TARGET: {body.name}. Scope: {body.description}. '
            'Return only a taxonomy proposal, no asserted facts, invented evidence or solutions. '
            'Each stream needs a concise name and a one-sentence research scope. '
            'Avoid overlap. This is an editable unverified draft.')
    response=parse_structured(StreamSuggestions,prompt)
    return {'streams':[x.model_dump() for x in response.streams[:amount]],'draft':True}

@router.post('/with-streams',status_code=201)
def create_with_streams(body:TargetWithStreams):
    # Single Cypher write: no half-created target if any stream creation fails.
    tid='T'+uuid.uuid4().hex
    seed=[{'id':'S'+uuid.uuid4().hex[:16], 'name':x.name.strip(), 'description':x.description.strip()} for x in body.streams]
    result=execute('''CREATE (t:Target {id:$tid,name:$name,description:$description,ownerId:$owner,shared:$shared,createdAt:datetime()})
        WITH t UNWIND $streams AS entry
        CREATE (s:Stream {id:entry.id,name:entry.name,description:entry.description,ownerId:$owner,targetId:$tid,createdAt:datetime(),origin:'user_reviewed_ai_outline'})
        CREATE (t)-[:HAS_STREAM]->(s)
        RETURN count(s) AS created''',tid=tid,name=body.name.strip(),description=body.description.strip(),owner=me(),shared=body.shared,streams=seed)
    # Empty stream lists must be handled separately because UNWIND [] suppresses rows but still creates t.
    return {'id':tid,'name':body.name,'description':body.description,'ownerId':me(),'shared':body.shared,'streamCount':len(seed)}

@router.post('/{tid}/copy',status_code=201)
def copy_target(tid:str):
    if tid!='reference-longevity':source=accessible(tid)
    else:source={'name':'Longevity research library','description':'Private copy of original research dataset'}
    new_id='T'+uuid.uuid4().hex
    # A single transaction clones the complete source tree, without touching originals.
    from .db import driver
    import os
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def work(tx):
            tx.run('CREATE (t:Target {id:$id,name:$name,description:$description,ownerId:$owner,shared:false,createdAt:datetime()})',id=new_id,name=source['name']+' (copy)',description=source.get('description') or '',owner=me()).consume()
            if tid=='reference-longevity':
                stream_rows=tx.run('MATCH (s:Stream) WHERE s.ownerId IS NULL RETURN s.id AS id,s.name AS name,s.description AS description').data()
            else:
                stream_rows=tx.run('MATCH (t:Target {id:$source})-[:HAS_STREAM]->(s:Stream) RETURN s.id AS id,s.name AS name,s.description AS description',source=tid).data()
            count=0
            for stream in stream_rows:
                sid='S'+uuid.uuid4().hex[:16]
                tx.run('MATCH (t:Target {id:$tid}) CREATE (s:Stream {id:$sid,name:$name,description:$desc,ownerId:$owner,targetId:$tid}) CREATE (t)-[:HAS_STREAM]->(s)',tid=new_id,sid=sid,name=stream['name'],desc=stream.get('description') or '',owner=me()).consume()
                cat_rows=tx.run('MATCH (s:Stream {id:$id})-[:CONTAINS]->(c:Category) RETURN c.id AS id,c.name AS name',id=stream['id']).data()
                for cat in cat_rows:
                    cid=sid+':'+uuid.uuid4().hex[:10]
                    tx.run('MATCH (s:Stream {id:$sid}) CREATE (c:Category {id:$cid,name:$name,ownerId:$owner,targetId:$tid}) CREATE (s)-[:CONTAINS]->(c)',sid=sid,cid=cid,name=cat['name'],owner=me(),tid=new_id).consume()
                    problems=tx.run('MATCH (c:Category {id:$cid})-[:CONTAINS]->(p:Problem) RETURN p.description AS description,p.origin AS origin',cid=cat['id']).data()
                    for prob in problems:
                        # Reserve unique numeric IDs within the same write transaction.
                        counter=tx.run('MATCH (p:Problem) WITH coalesce(max(p.id),0) AS base MERGE (x:IdCounter {name:"problem"}) ON CREATE SET x.next=0 SET x.next=CASE WHEN x.next < base THEN base ELSE x.next END SET x.next=x.next+1 RETURN x.next AS n').single()['n']
                        tx.run('MATCH (c:Category {id:$cid}) CREATE (p:Problem {id:$pid,description:$description,ownerId:$owner,targetId:$tid,streamId:$sid,streamName:$sname,categoryName:$cname,origin:"copied_reference",createdAt:datetime()}) CREATE (c)-[:CONTAINS]->(p)',cid=cid,pid=counter,description=prob['description'],owner=me(),tid=new_id,sid=sid,sname=stream['name'],cname=cat['name']).consume()
                        count+=1
            return count,len(stream_rows)
        problems,streams=session.execute_write(work)
    return {'id':new_id,'name':source['name']+' (copy)','ownerId':me(),'shared':False,'streamCount':streams,'problemCount':problems}

@router.patch('/{tid}')
def update_target(tid:str,body:TargetInput):
    accessible(tid,True)
    execute('MATCH (t:Target {id:$id,ownerId:$owner}) SET t.name=$name,t.description=$description,t.shared=$shared',id=tid,owner=me(),name=body.name.strip(),description=body.description.strip(),shared=body.shared)
    return {'ok':True}

@router.delete('/{tid}')
def delete_target(tid:str):
    accessible(tid,True)
    # Explicitly destructive: only target-scoped nodes, no legacy nodes; attached metadata is deleted.
    execute('MATCH (t:Target {id:$id,ownerId:$owner}) OPTIONAL MATCH (t)-[:HAS_STREAM]->(s:Stream) OPTIONAL MATCH (s)-[:CONTAINS]->(c:Category) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) DETACH DELETE t,s,c,p',id=tid,owner=me())
    return {'ok':True}

@router.get('/{tid}/graph')
def target_graph(tid:str):
    if tid=='reference-longevity':
        rows=query('MATCH (s:Stream) WHERE s.ownerId IS NULL OPTIONAL MATCH (s)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem) RETURN s.id AS id,s.name AS name,count(DISTINCT p) AS count ORDER BY s.id')
        title='Longevity research library'
    else:
        t=accessible(tid); title=t['name']
        rows=query('MATCH (t:Target {id:$id})-[:HAS_STREAM]->(s:Stream) RETURN s.id AS id,s.name AS name,0 AS count ORDER BY s.name',id=tid)
    nodes=[{'data':{'id':'root','label':title,'type':'root'}}]
    nodes += [{'data':{'id':r['id'],'label':r['name'],'type':'stream','count':r['count']}} for r in rows]
    edges=[{'data':{'id':'root-'+r['id'],'source':'root','target':r['id']}} for r in rows]
    return {'nodes':nodes,'edges':edges}

@router.get('/{tid}/expand/{node_id:path}')
def target_expand(tid:str,node_id:str):
    if tid=='reference-longevity':
        if node_id.startswith('S') and ':' not in node_id:
            rows=query('MATCH (s:Stream {id:$id}) WHERE s.ownerId IS NULL MATCH (s)-[:CONTAINS]->(c:Category) RETURN c.id AS id,c.name AS label',id=node_id);kind='category'
        elif ':' in node_id:
            rows=query('MATCH (s:Stream)-[:CONTAINS]->(c:Category {id:$id}) WHERE s.ownerId IS NULL MATCH (c)-[:CONTAINS]->(p:Problem) WHERE p.ownerId IS NULL RETURN toString(p.id) AS id,p.description AS label LIMIT 300',id=node_id);kind='problem'
        else:return {'nodes':[],'edges':[]}
    else:
        accessible(tid)
        if node_id.startswith('S') and ':' not in node_id:
            rows=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream {id:$id})-[:CONTAINS]->(c:Category) RETURN c.id AS id,c.name AS label',tid=tid,id=node_id);kind='category'
        elif ':' in node_id:
            rows=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(c:Category {id:$id})-[:CONTAINS]->(p:Problem) RETURN toString(p.id) AS id,p.description AS label LIMIT 300',tid=tid,id=node_id);kind='problem'
        else:return {'nodes':[],'edges':[]}
    nodes=[{'data':{'id':('P'+str(r['id']) if kind=='problem' else r['id']),'label':r['label'],'type':kind}} for r in rows]
    edges=[{'data':{'id':node_id+'-'+n['data']['id'],'source':node_id,'target':n['data']['id']}} for n in nodes]
    return {'nodes':nodes,'edges':edges}

@router.get('/{tid}/streams')
def get_streams(tid:str):
    accessible(tid)
    return query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream) RETURN s.id AS id,s.name AS name,s.description AS description ORDER BY s.name',tid=tid)

@router.post('/{tid}/streams',status_code=201)
def create_stream(tid:str,body:StreamInput):
    accessible(tid,True);sid='S'+uuid.uuid4().hex[:16]
    execute('MATCH (t:Target {id:$tid,ownerId:$owner}) CREATE (s:Stream {id:$sid,name:$name,description:$description,ownerId:$owner,targetId:$tid,createdAt:datetime()}) CREATE (t)-[:HAS_STREAM]->(s)',tid=tid,owner=me(),sid=sid,name=body.name.strip(),description=body.description.strip())
    return {'id':sid,'name':body.name}

@router.patch('/{tid}/streams/{sid}')
def update_stream(tid:str,sid:str,body:StreamInput):
    accessible(tid,True)
    rows=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(s:Stream {id:$sid}) RETURN s.id AS id',tid=tid,sid=sid)
    if not rows:raise HTTPException(404,'Stream not found')
    execute('MATCH (s:Stream {id:$sid,ownerId:$owner,targetId:$tid}) SET s.name=$name,s.description=$desc',sid=sid,owner=me(),tid=tid,name=body.name.strip(),desc=body.description.strip())
    return {'ok':True}

@router.delete('/{tid}/streams/{sid}')
def delete_stream(tid:str,sid:str):
    accessible(tid,True)
    execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) OPTIONAL MATCH (s)-[:CONTAINS]->(c:Category) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) DETACH DELETE s,c,p',tid=tid,owner=me(),sid=sid)
    return {'ok':True}

@router.post('/{tid}/streams/{sid}/categories',status_code=201)
def add_category(tid:str,sid:str,body:CategoryInput):
    accessible(tid,True);cid=sid+':'+uuid.uuid4().hex[:10]
    result=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream {id:$sid}) CREATE (c:Category {id:$cid,name:$name,ownerId:$owner,targetId:$tid}) CREATE (s)-[:CONTAINS]->(c) RETURN c.id AS id',tid=tid,owner=me(),sid=sid,cid=cid,name=body.name.strip())
    if not result:raise HTTPException(404,'Stream not found')
    return result[0]

@router.post('/{tid}/categories/{cid}/problems',status_code=201)
def add_problem(tid:str,cid:str,body:ProblemInput):
    accessible(tid,True)
    rows=query('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(s:Stream)-[:CONTAINS]->(c:Category {id:$cid}) RETURN s.id AS sid,s.name AS stream,c.name AS category',tid=tid,owner=me(),cid=cid)
    if not rows:raise HTTPException(404,'Category not found')
    from .db import driver
    import os
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        def work(tx):
            n=tx.run('MERGE (counter:IdCounter {name:"problem"}) ON CREATE SET counter.next=0 SET counter.next=counter.next+1 RETURN counter.next AS id').single()['id']
            return tx.run('MATCH (c:Category {id:$cid,ownerId:$owner,targetId:$tid}) CREATE (p:Problem {id:$pid,description:$statement,ownerId:$owner,targetId:$tid,streamId:$sid,streamName:$stream,categoryName:$cat,origin:"manual",createdAt:datetime()}) CREATE (c)-[:CONTAINS]->(p) RETURN p.id AS id',cid=cid,owner=me(),tid=tid,pid=n,statement=body.statement.strip(),sid=rows[0]['sid'],stream=rows[0]['stream'],cat=rows[0]['category']).single()['id']
        pid=session.execute_write(work)
    return {'id':pid}

@router.get('/{tid}/problems/{pid}')
def get_problem(tid:str,pid:int):
    if tid!='reference-longevity':accessible(tid)
    if tid=='reference-longevity':
        rows=query('MATCH (p:Problem {id:$id}) WHERE p.ownerId IS NULL RETURN p.id AS id,p.description AS description',id=pid)
    else:
        rows=query('MATCH (t:Target {id:$tid})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem {id:$id}) RETURN p.id AS id,p.description AS description',tid=tid,id=pid)
    if not rows:raise HTTPException(404,'Problem not found')
    return rows[0]

@router.patch('/{tid}/categories/{cid}')
def update_category(tid:str,cid:str,body:CategoryInput):
    accessible(tid,True)
    result=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(c:Category {id:$cid}) SET c.name=$name RETURN c.id AS id',tid=tid,owner=me(),cid=cid,name=body.name.strip())
    if not result:raise HTTPException(404,'Category not found')
    return result[0]

@router.delete('/{tid}/categories/{cid}')
def delete_category(tid:str,cid:str):
    accessible(tid,True)
    result=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(c:Category {id:$cid}) OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem) WITH c,collect(p) AS problems FOREACH (p IN problems | DETACH DELETE p) DETACH DELETE c RETURN true AS deleted',tid=tid,owner=me(),cid=cid)
    if not result:raise HTTPException(404,'Category not found')
    return {'ok':True}

@router.patch('/{tid}/problems/{pid}')
def update_problem(tid:str,pid:int,body:ProblemInput):
    accessible(tid,True)
    result=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem {id:$pid}) SET p.description=$description RETURN p.id AS id',tid=tid,owner=me(),pid=pid,description=body.statement.strip())
    if not result:raise HTTPException(404,'Problem not found')
    return result[0]

@router.delete('/{tid}/problems/{pid}')
def delete_problem(tid:str,pid:int):
    accessible(tid,True)
    result=execute('MATCH (t:Target {id:$tid,ownerId:$owner})-[:HAS_STREAM]->(:Stream)-[:CONTAINS]->(:Category)-[:CONTAINS]->(p:Problem {id:$pid}) DETACH DELETE p RETURN true AS deleted',tid=tid,owner=me(),pid=pid)
    if not result:raise HTTPException(404,'Problem not found')
    return {'ok':True}
