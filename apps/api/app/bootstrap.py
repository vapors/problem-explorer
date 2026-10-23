"""Explicit opt-in reset/init. NEVER invoked on application startup.

Usage (backend service stopped):
  python -m app.bootstrap --reset-all --confirm DELETE-ALL-RESEARCH-AND-USERS
  python -m app.bootstrap --seed-reference
"""
import argparse, csv, os, sqlite3, time
from pathlib import Path
from dotenv import load_dotenv
from .db import execute, query
from . import auth

ROOT=Path(__file__).resolve().parents[3]
load_dotenv(ROOT/'.env',override=False)

SCHEMA=[
 'CREATE CONSTRAINT target_id IF NOT EXISTS FOR (n:Target) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT stream_id IF NOT EXISTS FOR (n:Stream) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT category_id IF NOT EXISTS FOR (n:Category) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT problem_id IF NOT EXISTS FOR (n:Problem) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT solution_id IF NOT EXISTS FOR (n:Solution) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT discovery_id IF NOT EXISTS FOR (n:Discovery) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT research_id IF NOT EXISTS FOR (n:ResearchRun) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT source_url IF NOT EXISTS FOR (n:Source) REQUIRE n.url IS UNIQUE',
 'CREATE CONSTRAINT evaluation_id IF NOT EXISTS FOR (n:Evaluation) REQUIRE n.id IS UNIQUE',
 'CREATE FULLTEXT INDEX problem_search IF NOT EXISTS FOR (n:Problem) ON EACH [n.description,n.categoryName,n.streamName]',
]

def seed_reference():
    for cypher in SCHEMA:execute(cypher)
    file=Path(os.getenv('DATA_FILE',str(ROOT/'data/problems.csv')))
    with file.open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
    if len(rows)!=498:raise RuntimeError(f'Expected 498 reference problems, got {len(rows)}')
    if query('MATCH (t:Target {id:"reference-longevity"}) RETURN count(t) AS n')[0]['n']:
        raise RuntimeError('Reference target already exists; refusing to reseed a nonempty reference')
    streams=list(dict.fromkeys(r['stream'] for r in rows))
    if len(streams)!=4:raise RuntimeError('Reference CSV should contain 4 streams')
    formatted=[]
    for r in rows:
        s=streams.index(r['stream'])+1
        formatted.append({'id':int(r['id']),'sid':f'S{s}','sname':r['stream'],
           'cid':f'S{s}:{r["subcategory"].split(".")[0]}','cname':r['subcategory'].strip(),
           'statement':r['problem']})
    execute('CREATE (t:Target {id:"reference-longevity",name:"Longevity research library",description:"Original 498-problem reference dataset",ownerId:"__system__",shared:true,reference:true,createdAt:datetime()})')
    execute('''UNWIND $rows AS r MATCH (t:Target {id:'reference-longevity'})
      MERGE (s:Stream {id:r.sid}) ON CREATE SET s.name=r.sname,s.ownerId='__system__',s.targetId='reference-longevity'
      MERGE (t)-[:HAS_STREAM]->(s)
      MERGE (c:Category {id:r.cid}) ON CREATE SET c.name=r.cname,c.ownerId='__system__',c.targetId='reference-longevity'
      MERGE (s)-[:CONTAINS]->(c)
      CREATE (p:Problem {id:r.id,description:r.statement,origin:'original-498',targetId:'reference-longevity',ownerId:'__system__',streamId:r.sid,streamName:r.sname,categoryName:r.cname,createdAt:datetime()})
      CREATE (c)-[:CONTAINS]->(p)''',rows=formatted)
    execute('MERGE (x:IdCounter {name:"problem"}) SET x.next=498')
    print('Seeded 498 reference problems under one shared Target.')

def reset_all():
    # Preflight the seed file before touching live records.
    datafile=Path(os.getenv('DATA_FILE',str(ROOT/'data/problems.csv')))
    with datafile.open(encoding='utf-8-sig',newline='') as f:
        if len(list(csv.DictReader(f)))!=498:
            raise RuntimeError('Reference CSV preflight failed. No data was deleted.')
    # Caller must stop FastAPI worker. Make an independent Neo4j backup before this command.
    path=auth.database_path()
    if path.exists():
        # Snapshot auth database using SQLite online backup (includes WAL state).
        backup=path.with_name(path.stem+'.pre-v07-reset-'+time.strftime('%Y%m%dT%H%M%S')+'.sqlite3')
        with sqlite3.connect(path) as source,sqlite3.connect(backup) as dst:source.backup(dst)
        print('Authentication SQLite backup created:',backup)
    execute('MATCH (n) DETACH DELETE n')
    if path.exists():
        with auth.conn() as conn:
            conn.execute('DELETE FROM embedding_jobs') if conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='embedding_jobs'").fetchone()[0] else None
            conn.execute('DELETE FROM ai_usage') if conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='ai_usage'").fetchone()[0] else None
            conn.execute('DELETE FROM sessions') if conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='sessions'").fetchone()[0] else None
            conn.execute('DELETE FROM users') if conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'").fetchone()[0] else None
        print('Authentication reset; saved SQLite backup:',backup)
    auth.init_db()
    seed_reference()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    opts=parser.add_mutually_exclusive_group(required=True)
    opts.add_argument('--reset-all',action='store_true',help='DESTRUCTIVE: delete all Neo4j data and SQLite accounts')
    opts.add_argument('--seed-reference',action='store_true',help='Seed 498 problems only if reference absent')
    opts.add_argument('--promote-email',type=str,help='One-time promote an existing registered account to admin')
    parser.add_argument('--confirm',default='')
    args=parser.parse_args()
    if args.reset_all:
        if args.confirm!='DELETE-ALL-RESEARCH-AND-USERS':parser.error('Missing exact destructive confirmation')
        reset_all()
    elif args.promote_email:
        auth.init_db()
        with auth.conn() as c:
            cur=c.execute("UPDATE users SET role='admin' WHERE lower(email)=? AND status='active'",(args.promote_email.strip().lower(),))
            if cur.rowcount != 1:raise SystemExit('No matching active registered account; no change made')
            print('Administrator role assigned. Sign out and back in.')
    else:seed_reference()
