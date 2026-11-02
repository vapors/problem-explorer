"""Administrator-only operations. No global research write endpoints."""
import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from . import auth, jobs
from .db import query, driver
from .targets import destroy_target, REFERENCE, SUPPORTED_LENSES
router=APIRouter(prefix='/api/admin',tags=['administration'])

def require_admin(request:Request):
    account=auth.session_user(request)
    if not account or account['role']!='admin':
        raise HTTPException(403,'Administrator access required')
    return account

@router.get('/overview')
def overview(request:Request):
    require_admin(request)
    with auth.conn() as c:
        users=[dict(r) for r in c.execute('SELECT id,email,name,role,status,ai_daily_limit,created_at FROM users ORDER BY created_at DESC LIMIT 250')]
        usage=[dict(r) for r in c.execute('SELECT user_id,day,requests FROM ai_usage ORDER BY day DESC,requests DESC LIMIT 250')]
        queue=[dict(r) for r in c.execute('SELECT id,owner_id,kind,state,processed,error,created_at FROM embedding_jobs ORDER BY created_at DESC LIMIT 60')]
    return {'users':users,'usage':usage,'jobs':queue,'dailyLimit':int(os.getenv('DAILY_AI_REQUEST_LIMIT','15'))}

class AccountUpdate(BaseModel):
    role:str|None=Field(default=None,pattern='^(admin|user)$')
    status:str|None=Field(default=None,pattern='^(active|disabled)$')
    ai_daily_limit:int|None=Field(default=None,ge=0,le=100000)

@router.patch('/users/{user_id}')
def update_account(user_id:str,body:AccountUpdate,request:Request):
    admin=require_admin(request)
    if admin['id']==user_id: raise HTTPException(400,'Cannot edit your own administrator role or status')
    with auth.conn() as c:
        if not c.execute('SELECT 1 FROM users WHERE id=?',(user_id,)).fetchone():raise HTTPException(404,'User not found')
        if body.role is not None:c.execute('UPDATE users SET role=? WHERE id=?',(body.role,user_id))
        if body.status is not None:
            c.execute('UPDATE users SET status=? WHERE id=?',(body.status,user_id))
            if body.status=='disabled':
                c.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
                c.execute("UPDATE embedding_jobs SET state='cancelled',updated_at=CURRENT_TIMESTAMP WHERE owner_id=? AND state IN ('queued','deferred')",(user_id,))
        if body.ai_daily_limit is not None:c.execute('UPDATE users SET ai_daily_limit=? WHERE id=?',(body.ai_daily_limit,user_id))
    return {'ok':True}

@router.post('/index-reference')
def index_reference(request:Request):
    require_admin(request)
    return jobs.queue_shared()


class ConfirmTargetDeletion(BaseModel):
    target_name: str = Field(min_length=1)
    target_id: str = Field(min_length=1)


@router.get('/targets')
def list_targets(request: Request):
    """Administrator inventory, target-scoped aggregate graph counts, SQLite owner labels."""
    require_admin(request)
    rows = query('''MATCH (t:Target)
        OPTIONAL MATCH (t)-[:HAS_STREAM]->(s:Stream)
        OPTIONAL MATCH (s)-[:CONTAINS]->(c:Category)
        OPTIONAL MATCH (c)-[:CONTAINS]->(p:Problem)
        RETURN t.id AS id,t.name AS name,t.ownerId AS ownerId,
               coalesce(t.reference,false) AS reference,
               coalesce(t.shared,false) AS shared,
               coalesce(t.directoryVisible,true) AS listed,
               coalesce(t.featured,false) AS featured,
               coalesce(t.featuredLenses,[]) AS featuredLenses,
               count(DISTINCT s) AS streams,count(DISTINCT c) AS categories,
               count(DISTINCT p) AS problems ORDER BY name LIMIT 250''')
    with auth.conn() as c:
        owners = {r['id']:dict(r) for r in c.execute('SELECT id,email FROM users')}
    for item in rows:
        account = owners.get(item['ownerId'])
        item['ownerEmail'] = account['email'] if account else ('System' if item['ownerId']=='__system__' else 'Unknown account')
        item['deletable'] = not item['reference'] and item['id'] != REFERENCE
    return {'targets':rows}


@router.delete('/targets/{tid}')
def admin_delete_target(tid: str, body: ConfirmTargetDeletion, request: Request):
    administrator = require_admin(request)
    if tid == REFERENCE or body.target_id != tid:
        raise HTTPException(403, 'Reference target protected or target ID mismatch')
    return destroy_target(tid, administrator['id'], admin=True, expected_name=body.target_name)


class TargetPublicationUpdate(BaseModel):
    # Publication state is separate from reference-record protection.
    shared: bool | None = None
    listed: bool | None = None
    featured: bool | None = None
    featuredLenses: list[str] | None = None


@router.patch('/targets/{tid}/publication')
def update_target_publication(tid: str, body: TargetPublicationUpdate, request: Request):
    # Publication changes affect Target metadata only, never research records.
    administrator = require_admin(request)
    if body.shared is None and body.listed is None and body.featured is None and body.featuredLenses is None:
        raise HTTPException(422, 'Provide a publication change')
    if body.featuredLenses is not None:
        if len(body.featuredLenses) != len(set(body.featuredLenses)) or any(
            lens not in SUPPORTED_LENSES for lens in body.featuredLenses
        ):
            raise HTTPException(422, 'Unrecognized or duplicate lens identifiers')
    with driver().session(database=os.getenv('NEO4J_DATABASE', 'neo4j')) as session:
        def work(tx):
            item = tx.run('''MATCH (t:Target {id:$tid})
                RETURN t.id AS id,t.ownerId AS ownerId,
                       coalesce(t.shared,false) AS shared,
                       coalesce(t.directoryVisible,true) AS listed,
                       coalesce(t.featured,false) AS featured,
                       coalesce(t.featuredLenses,[]) AS featuredLenses,
                       coalesce(t.reference,false) AS reference''',tid=tid).single()
            if item is None:
                raise HTTPException(404, 'Target not found')
            shared = item['shared'] if body.shared is None else body.shared
            listed = item['listed'] if body.listed is None else body.listed
            featured = item['featured'] if body.featured is None else body.featured
            featured_lenses = list(item['featuredLenses'] or []) if body.featuredLenses is None else list(body.featuredLenses)
            if body.shared is True and not item['shared'] and item['ownerId'] not in ('__system__', administrator['id']):
                raise HTTPException(403, 'Only the target owner may initially share private research')
            if not shared:
                listed = False
                featured = False
                featured_lenses = []
            if not listed:
                featured = False
                featured_lenses = []
            if (body.listed is True and not shared) or (body.featured is True and (not shared or not listed)) or (body.featuredLenses and (not shared or not listed)):
                raise HTTPException(422, 'Featured/listed targets must be publicly shared and listed')
            # Clearing the former default and setting the new one happen atomically.
            # The research subtree and protection flag are never modified.
            if featured and body.featured is True:
                tx.run('''MATCH (other:Target) WHERE other.id<>$tid AND coalesce(other.featured,false)
                    SET other.featured=false''',tid=tid).consume()
            # Clear any previous assignment of each newly claimed lens. This
            # transaction keeps featured assignments exclusive without altering
            # research or reference/protected flags.
            for lens in featured_lenses:
                tx.run('''MATCH (other:Target) WHERE other.id<>$tid
                      AND $lens IN coalesce(other.featuredLenses,[])
                    SET other.featuredLenses=[v IN other.featuredLenses WHERE v<>$lens]''',
                    tid=tid,lens=lens).consume()
            tx.run('''MATCH (t:Target {id:$tid})
                SET t.shared=$shared,t.directoryVisible=$listed,t.featured=$featured,
                    t.featuredLenses=$lenses''',
                tid=tid,shared=shared,listed=listed,featured=featured,lenses=featured_lenses).consume()
            return {'id':tid,'shared':shared,'listed':listed,'featured':featured,
                    'featuredLenses':featured_lenses,'reference':item['reference']}
        return session.execute_write(work)
