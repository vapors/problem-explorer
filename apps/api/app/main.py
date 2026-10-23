"""Problem Explorer v0.8 — one target-scoped API, no legacy unscoped endpoints."""
import os
from contextvars import ContextVar
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from . import auth, jobs
from .db import query

current_user: ContextVar[str] = ContextVar('current_user', default='')

def uid():
    value = current_user.get()
    if not value: raise HTTPException(401, 'Sign in required')
    return value

@asynccontextmanager
async def lifespan(app):
    auth.init_db()
    jobs.start()
    yield
    jobs.stop()

app = FastAPI(title='Problem Explorer API', version='0.8.0', lifespan=lifespan)
app.include_router(auth.router)

@app.middleware('http')
async def require_session_and_origin(request: Request, call_next):
    path = request.url.path
    if path.startswith('/api/') and request.method not in ('GET','HEAD','OPTIONS'):
        origin = request.headers.get('origin')
        if origin:
            allowed = {x.strip() for x in os.getenv('PUBLIC_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()}
            allowed.add(str(request.base_url).rstrip('/'))
            if origin not in allowed:
                return JSONResponse({'detail':'Cross-site request blocked'}, status_code=403)
    if path.startswith('/api/') and not path.startswith('/api/auth/') and path != '/api/health' and request.method != 'OPTIONS':
        user = auth.session_user(request)
        if not user: return JSONResponse({'detail':'Authentication required'}, status_code=401)
        token = current_user.set(user['id'])
        # Charge only calls that perform AI inference. Local reads and writes remain free.
        metered = (request.method == 'POST' and (
            path.endswith(('/suggest-streams','/seed-preview','/research','/concepts/generate',
                           '/discoveries/search','/match','/evaluate'))))
        if metered and not auth.reserve_ai_request(user['id']):
            current_user.reset(token)
            return JSONResponse({'detail':'Daily AI request allowance reached'}, status_code=429)
        try: return await call_next(request)
        finally: current_user.reset(token)
    return await call_next(request)

origins = [x.strip() for x in os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                   allow_methods=['GET','POST','PATCH','DELETE'], allow_headers=['*'])

@app.get('/api/health')
def health():
    try:
        nodes=query('MATCH (t:Target) RETURN count(t) AS targets')[0]['targets']
        return {'ok':True,'neo4j':True,'targets':nodes,'openaiConfigured':bool(os.getenv('OPENAI_API_KEY'))}
    except Exception as exc:
        raise HTTPException(503,'Neo4j unavailable or schema not initialized') from exc

from .targets import router as target_router
from .research import router as research_router
from .admin import router as admin_router
app.include_router(target_router)
app.include_router(research_router)
app.include_router(admin_router)
