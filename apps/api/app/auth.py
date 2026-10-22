"""Local accounts and opaque database-backed sessions. No API keys enter the browser."""
import hashlib
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter(prefix='/api/auth', tags=['authentication'])
password_hash = PasswordHash.recommended()
write_lock = Lock()
COOKIE = 'pe_session'

def database_path():
    p = Path(os.getenv('AUTH_DB_PATH', './data/auth.sqlite3')).resolve()
    p.parent.mkdir(parents=True, exist_ok=True)
    return p

def conn():
    c = sqlite3.connect(database_path(), timeout=20)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA busy_timeout=20000')
    c.execute('PRAGMA foreign_keys=ON')
    return c

def init_db():
    with conn() as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                password_hash TEXT, google_sub TEXT UNIQUE,
                role TEXT NOT NULL DEFAULT 'user',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
            CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,day));
        ''')

def public_user(user):
    return {'id':user['id'],'email':user['email'],'name':user['name'],'role':user['role']}

def session_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token: return None
    h = hashlib.sha256(token.encode()).hexdigest()
    with conn() as c:
        return c.execute('''SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
             WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' ''',
             (h,datetime.now(timezone.utc).isoformat())).fetchone()

def set_session(response: Response, user_id: str):
    token=secrets.token_urlsafe(48)
    expires=(datetime.now(timezone.utc)+timedelta(days=14)).isoformat()
    with conn() as c:
        c.execute('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',
                  (hashlib.sha256(token.encode()).hexdigest(),user_id,expires))
    response.set_cookie(COOKIE,token,httponly=True,secure=os.getenv('AUTH_SECURE_COOKIE','true').lower()=='true',
                        samesite='lax',max_age=14*86400,path='/')

class Signup(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1,max_length=120)
    password: str = Field(min_length=12,max_length=256)

class Login(BaseModel):
    email: EmailStr
    password: str

class GoogleLogin(BaseModel):
    credential: str = Field(min_length=50,max_length=10000)

@router.get('/config')
def config():
    return {'googleClientId':os.getenv('GOOGLE_CLIENT_ID','')}

@router.get('/me')
def me(request:Request):
    user=session_user(request)
    return {'user':public_user(user) if user else None}

@router.post('/register',status_code=201)
def register(body:Signup,response:Response):
    email=body.email.lower().strip()
    uid=str(uuid.uuid4())
    with write_lock:
        try:
            with conn() as c:
                c.execute('INSERT INTO users (id,email,name,password_hash) VALUES (?,?,?,?)',
                          (uid,email,body.name.strip(),password_hash.hash(body.password)))
        except sqlite3.IntegrityError:
            raise HTTPException(409,'Account already exists. Sign in instead.')
    set_session(response,uid)
    return {'user':{'id':uid,'email':email,'name':body.name.strip(),'role':'user'}}

@router.post('/login')
def login(body:Login,response:Response):
    with conn() as c:
        user=c.execute('SELECT * FROM users WHERE email=?',(body.email.lower().strip(),)).fetchone()
    if not user or not user['password_hash'] or not password_hash.verify(body.password,user['password_hash']) or user['status']!='active':
        raise HTTPException(401,'Invalid email or password')
    set_session(response,user['id'])
    return {'user':public_user(user)}

@router.post('/google')
def google_login(body:GoogleLogin,response:Response):
    audience=os.getenv('GOOGLE_CLIENT_ID','').strip()
    if not audience:raise HTTPException(503,'Google sign-in is not configured')
    try:
        claims=id_token.verify_oauth2_token(body.credential,google_requests.Request(),audience)
    except Exception:
        raise HTTPException(401,'Invalid Google identity token')
    if claims.get('iss') not in ('accounts.google.com','https://accounts.google.com') or claims.get('email_verified') is not True:
        raise HTTPException(401,'Verified Google email required')
    sub=claims.get('sub'); email=claims.get('email','').lower()
    if not sub or not email:raise HTTPException(401,'Invalid Google identity')
    with write_lock:
        with conn() as c:
            user=c.execute('SELECT * FROM users WHERE google_sub=?',(sub,)).fetchone()
            if not user:
                existing=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                if existing:
                    # No automatic account linking based solely on a matching email.
                    raise HTTPException(409,'This email already has an account. Sign in with your password first.')
                uid=str(uuid.uuid4())
                c.execute('INSERT INTO users(id,email,name,google_sub) VALUES(?,?,?,?)',
                          (uid,email,str(claims.get('name') or email.split('@')[0])[:120],sub))
                user=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
    if user['status']!='active':raise HTTPException(403,'Account unavailable')
    set_session(response,user['id'])
    return {'user':public_user(user)}

@router.post('/logout')
def logout(request:Request,response:Response):
    token=request.cookies.get(COOKIE)
    if token:
        with conn() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie(COOKIE,path='/')
    return {'ok':True}


def reserve_ai_request(user_id: str) -> bool:
    """Simple shared, atomic daily request cap; reservations are consumed on API failure too."""
    cap = max(0,int(os.getenv('DAILY_AI_REQUEST_LIMIT','15')))
    today = datetime.now(timezone.utc).date().isoformat()
    with write_lock:
        with conn() as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('INSERT OR IGNORE INTO ai_usage(user_id,day,requests) VALUES(?,?,0)',(user_id,today))
            cur=c.execute('UPDATE ai_usage SET requests=requests+1 WHERE user_id=? AND day=? AND requests<?',(user_id,today,cap))
            return cur.rowcount==1
