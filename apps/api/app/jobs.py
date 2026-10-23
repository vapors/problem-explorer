"""Persistent single-process background embedding queue. Run ONE API worker per database.
For multi-worker / distributed deployments replace with a dedicated queue worker.
"""
import os, threading, time, uuid
from datetime import datetime,timezone
from . import auth, semantic
from .db import query

stop_event=threading.Event()
thread=None

def queue_problem(owner, problem_id):
    return _enqueue(owner,'problem',str(problem_id))

def queue_target(owner, target_id):
    return _enqueue(owner,'target',target_id)

def queue_owner(owner):
    return _enqueue(owner,'owner','all')

def queue_shared():
    return _enqueue('__system__','shared','all')

def _enqueue(owner,kind,target):
    with auth.conn() as c:
        existing=c.execute("SELECT id FROM embedding_jobs WHERE owner_id=? AND kind=? AND target=? AND state IN ('queued','running')",(owner,kind,target)).fetchone()
        if existing:return {'jobId':existing['id'],'queued':True}
        jid=str(uuid.uuid4())
        c.execute("INSERT INTO embedding_jobs(id,owner_id,kind,target,state) VALUES(?,?,?,?,'queued')",(jid,owner,kind,target))
    return {'jobId':jid,'queued':True}

def status(owner):
    with auth.conn() as c:
        return [dict(r) for r in c.execute("SELECT id,kind,target,state,processed,error,created_at,updated_at FROM embedding_jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT 12",(owner,))]

def _execute(job):
    from .main import current_user
    owner=job['owner_id']
    token=current_user.set(owner if owner!='__system__' else '__system__')
    try:
        semantic.ensure_vector_index()
        if job['kind']=='shared':
            rows=query("MATCH (p:Problem) WHERE p.targetId='reference-longevity' AND p.embedding IS NULL RETURN p.id AS id,p.description AS description LIMIT 20")
        elif job['kind']=='target':
            rows=query('MATCH (p:Problem {targetId:$tid,ownerId:$owner}) WHERE p.embedding IS NULL RETURN p.id AS id,p.description AS description LIMIT 20',tid=job['target'],owner=owner)
        elif job['kind']=='problem':
            rows=query('MATCH (p:Problem {id:$pid}) WHERE p.ownerId=$owner AND p.embedding IS NULL RETURN p.id AS id,p.description AS description',pid=int(job['target']),owner=owner)
        else:
            rows=query('MATCH (p:Problem) WHERE p.ownerId=$owner AND p.embedding IS NULL RETURN p.id AS id,p.description AS description LIMIT 20',owner=owner)
        if not rows:return 0,False
        # Charge a user for the actual embedding batch, not the queue action.
        # System backfill is enabled explicitly by an admin, and has its own cap.
        if owner!='__system__' and not auth.reserve_ai_request(owner):
            raise RuntimeError('Daily AI allowance reached; resume indexing tomorrow or increase allowance')
        vectors=semantic.embed([x['description'] for x in rows])
        from .db import execute
        execute("UNWIND $rows AS row MATCH (p:Problem {id:row.id}) WHERE ($shared AND p.targetId='reference-longevity') OR p.ownerId=$owner CALL db.create.setNodeVectorProperty(p,'embedding',row.vector) RETURN count(p) AS n",rows=[{'id':r['id'],'vector':v} for r,v in zip(rows,vectors)],owner=owner,shared=owner=='__system__')
        return len(rows),job['kind'] in ('owner','shared','target') and len(rows)==20
    finally:current_user.reset(token)

def loop():
    while not stop_event.wait(2):
        try:
            with auth.conn() as c:
                # Resume interrupted jobs after process restarts.
                c.execute("UPDATE embedding_jobs SET state='queued' WHERE state='running' AND updated_at < datetime('now','-10 minutes')")
                c.execute("UPDATE embedding_jobs SET state='queued',error=NULL WHERE state='deferred' AND date(updated_at) < date('now')")
                job=c.execute("SELECT * FROM embedding_jobs WHERE state='queued' ORDER BY created_at LIMIT 1").fetchone()
                if job:c.execute("UPDATE embedding_jobs SET state='running',updated_at=CURRENT_TIMESTAMP WHERE id=?",(job['id'],))
            if not job:continue
            try:
                count,more=_execute(dict(job))
                with auth.conn() as c:
                    c.execute("UPDATE embedding_jobs SET state=?,processed=processed+?,updated_at=CURRENT_TIMESTAMP,error=NULL WHERE id=?",('queued' if more else 'done',count,job['id']))
                if more:time.sleep(.3)
            except Exception as exc:
                with auth.conn() as c:
                    c.execute("UPDATE embedding_jobs SET state=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",('deferred' if 'Daily AI allowance reached' in str(exc) else 'failed',str(exc)[:350],job['id']))
        except Exception:
            # Keep worker alive; server logging should capture unexpected failures.
            import logging
            logging.exception('Embedding queue worker failure')

def start():
    global thread
    with auth.conn() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS embedding_jobs (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',processed INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''')
    if os.getenv('AUTO_INDEX_SHARED','false').lower()=='true':queue_shared()
    stop_event.clear()
    thread=threading.Thread(target=loop,name='embedding-worker',daemon=True)
    thread.start()

def stop():
    stop_event.set()
    if thread:thread.join(timeout=4)
