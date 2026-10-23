"""Administrator-only operations. No global research write endpoints."""
import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from . import auth, jobs
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
