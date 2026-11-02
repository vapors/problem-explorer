"""Durable SQLite operational queue, separate from Neo4j research artifacts.

Single API worker (as with embedding_jobs). Agent stages are checkpointed so a
restart resumes incomplete work. Evaluation results are persisted in Neo4j.
"""
from __future__ import annotations
import json,logging,os,threading,time,uuid
from datetime import datetime,timezone
from fastapi import HTTPException
from . import auth,evaluation_orchestrator as orchestrator
from .db import query,execute

_stop=threading.Event();_thread=None
SCHEMA='''CREATE TABLE IF NOT EXISTS evaluation_jobs (
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,target_id TEXT NOT NULL,solution_id TEXT NOT NULL,
 mode TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',stage TEXT NOT NULL DEFAULT 'quantitative',
 quant_json TEXT,qual_json TEXT,result_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,
 error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS evaluation_jobs_owner ON evaluation_jobs(owner_id,created_at);
 CREATE INDEX IF NOT EXISTS evaluation_jobs_pending ON evaluation_jobs(state,updated_at);'''

def init():
    with auth.conn() as c:c.executescript(SCHEMA)

def enqueue(owner,tid,sid,mode):
    if mode not in ('evidence','exploratory'):raise HTTPException(422,'Invalid evaluation mode')
    with auth.conn() as c:
        c.execute('BEGIN IMMEDIATE')
        row=c.execute("SELECT id FROM evaluation_jobs WHERE owner_id=? AND target_id=? AND solution_id=? AND mode=? AND state IN ('queued','running','deferred') ORDER BY created_at DESC LIMIT 1",(owner,tid,sid,mode)).fetchone()
        if row:return {'jobId':row['id'],'state':'queued' if row['id'] else 'queued'}
        jid=str(uuid.uuid4())
        c.execute('INSERT INTO evaluation_jobs(id,owner_id,target_id,solution_id,mode) VALUES (?,?,?,?,?)',(jid,owner,tid,sid,mode))
    return {'jobId':jid,'state':'queued'}

def status(owner,tid,jid):
    with auth.conn() as c:
        r=c.execute('''SELECT id,target_id,solution_id,mode,state,stage,result_id,attempts,error,created_at,updated_at
          FROM evaluation_jobs WHERE id=? AND owner_id=? AND target_id=?''',(jid,owner,tid)).fetchone()
    if r is None:raise HTTPException(404,'Evaluation job not found')
    return {'jobId':r['id'],'state':r['state'],'stage':r['stage'],'evaluationId':r['result_id'],
            'attempts':r['attempts'],'error':r['error'],'createdAt':r['created_at'],'updatedAt':r['updated_at']}

def history(owner,tid,sid):
    with auth.conn() as c:
        rows=c.execute('''SELECT id FROM evaluation_jobs WHERE owner_id=? AND target_id=? AND solution_id=?
            ORDER BY created_at DESC LIMIT 30''',(owner,tid,sid)).fetchall()
    return [status(owner,tid,r['id']) for r in rows]

def _context(job):
    tid=job['target_id'];sid=job['solution_id'];owner=job['owner_id']
    sol=query('''MATCH (t:Target {id:$tid,ownerId:$owner})
      MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner})
      RETURN s.name AS name,s.description AS description''',tid=tid,sid=sid,owner=owner)
    if not sol:raise RuntimeError('Solution or owner no longer exists in target')
    matches=query('''MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner})-[r:ADDRESSES]->(p:Problem {targetId:$tid})
      RETURN p.id AS problemId,p.description AS description,r.relevance AS relevance,
      r.relationship AS relationship LIMIT 80''',sid=sid,tid=tid,owner=owner)
    ids=[m['problemId'] for m in matches]
    findings=query('''MATCH (f:Finding {targetId:$tid,ownerId:$owner})-[:ABOUT]->(p:Problem {targetId:$tid})
      WHERE p.id IN $ids MATCH (f)-[:DERIVED_FROM]->(src:Source)
      RETURN f.claim AS claim,src.url AS url,f.limitations AS limitations,
      f.reviewStatus AS status LIMIT 60''',tid=tid,owner=owner,ids=ids)
    if job['mode']=='evidence':findings=[f for f in findings if f.get('status')=='reviewed']
    return sol[0]['name']+'\n'+sol[0]['description'],matches,findings

def _mark(jid,**fields):
    valid={'stage','quant_json','qual_json','state','error','result_id'}
    if not set(fields)<=valid:raise ValueError('Unknown job fields')
    with auth.conn() as c:
        sql=','.join(f'{k}=?' for k in fields)
        c.execute(f'UPDATE evaluation_jobs SET {sql},updated_at=CURRENT_TIMESTAMP WHERE id=?',(*fields.values(),jid))

def _execute(job):
    from .evaluation_orchestrator import QuantitativeResult,QualitativeResult
    concept,matches,findings=_context(job)
    q=QuantitativeResult.model_validate_json(job['quant_json']) if job['quant_json'] else None
    if q is None:
        if not auth.reserve_ai_request(job['owner_id']):
            _mark(job['id'],state='deferred',error='Daily AI allowance reached; retry after UTC midnight')
            return
        q=orchestrator.quantitative(concept,matches,findings,job['mode'])
        _mark(job['id'],quant_json=q.model_dump_json(),stage='qualitative')
    n=QualitativeResult.model_validate_json(job['qual_json']) if job['qual_json'] else None
    if n is None:
        if not auth.reserve_ai_request(job['owner_id']):
            _mark(job['id'],state='deferred',stage='qualitative',error='Daily AI allowance reached; retry after UTC midnight')
            return
        n=orchestrator.qualitative(concept,matches,findings,job['mode'])
        _mark(job['id'],qual_json=n.model_dump_json(),stage='reconcile')
    # Context is refetched at finalization: if permissions/research changed, do not publish
    # an evaluation based on a stale target membership. Newer review state may require rerun.
    _,_,latest=_context(job)
    if sorted(json.dumps(f,sort_keys=True,default=str) for f in findings)!=sorted(json.dumps(f,sort_keys=True,default=str) for f in latest):
        raise RuntimeError('Research sources changed during evaluation. Re-run the assessment.')
    result=orchestrator.reconcile(q,n,latest,job['mode'])
    eid=job['result_id'] or job['id']  # idempotent create across restarts
    rows=execute('''MATCH (s:Solution {id:$sid,targetId:$tid,ownerId:$owner})
      MERGE (e:Evaluation {id:$eid})
      ON CREATE SET e.targetId=$tid,e.ownerId=$owner,e.createdAt=datetime(),e.method='multi_agent_v1'
      SET e.payload=$payload
      MERGE (e)-[:ASSESSES]->(s) RETURN e.id AS id''',eid=eid,tid=job['target_id'],
      sid=job['solution_id'],owner=job['owner_id'],payload=json.dumps(result))
    if not rows:raise RuntimeError('Solution is no longer available for this account')
    _mark(job['id'],state='done',stage='complete',result_id=eid,error=None)

def _claim():
    with auth.conn() as c:
        c.execute('BEGIN IMMEDIATE')
        # Preserve stage checkpoint but requeue orphaned process after a crash.
        c.execute("UPDATE evaluation_jobs SET state='queued' WHERE state='running' AND updated_at < datetime('now','-10 minutes')")
        c.execute("UPDATE evaluation_jobs SET state='queued',error=NULL WHERE state='deferred' AND date(updated_at) < date('now')")
        row=c.execute("SELECT * FROM evaluation_jobs WHERE state='queued' ORDER BY created_at LIMIT 1").fetchone()
        if row:c.execute("UPDATE evaluation_jobs SET state='running',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",(row['id'],))
        return dict(row) if row else None

def loop():
    while not _stop.wait(2):
        try:
            row=_claim()
            if row is None:continue
            try:_execute(row)
            except Exception as ex:
                logging.exception('Evaluation job %s failed',row['id'])
                with auth.conn() as c:
                    # Retry transient failures twice. Cap repeated errors indefinitely.
                    state='failed' if row['attempts']>=2 else 'queued'
                    c.execute('UPDATE evaluation_jobs SET state=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
                              (state,str(ex)[:400],row['id']))
        except Exception:logging.exception('Evaluation worker loop failed')

def start():
    global _thread
    init();_stop.clear()
    _thread=threading.Thread(target=loop,name='evaluation-worker',daemon=True)
    _thread.start()

def stop():
    _stop.set()
    if _thread:_thread.join(timeout=4)
