"""Explicit, administrator-attested, allowlisted RSS/Atom discovery adapter.

This adapter collects *candidates* only, never sentiment scores or empirical
findings. No arbitrary URL fetching, feed discovery, login or HTML scraping.
"""
from __future__ import annotations
import html,os,re,socket,uuid,ipaddress,xml.etree.ElementTree as ET
from urllib.parse import urlsplit
import requests
from fastapi import APIRouter,HTTPException,Request
from pydantic import BaseModel,Field
from .targets import accessible
from . import signals
from .db import query,execute

router=APIRouter(prefix='/api/targets/{tid}/signals',tags=['social-signal-collection'])
MAX_BYTES=500_000

class CollectRequest(BaseModel):
    sourceUrl: str=Field(max_length=1800)
    attestedRights: bool=False
    maxItems: int=Field(default=10,ge=1,le=20)


def allowed_host(url:str):
    signals.valid_url(url)
    host=(urlsplit(url).hostname or '').lower().rstrip('.')
    allow={x.strip().lower() for x in os.getenv('SOCIAL_FEED_ALLOWED_HOSTS','').split(',') if x.strip()}
    if not allow or host not in allow:
        raise HTTPException(403,'Feed host not in SOCIAL_FEED_ALLOWED_HOSTS; review terms before approval')
    try:
        addresses=socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise HTTPException(422,'Feed host must resolve exclusively to public addresses')
    except OSError as exc:raise HTTPException(422,'Feed hostname could not be resolved') from exc
    return host


def load_feed(url:str):
    # Only feed URLs previously configured by the administrator and explicitly
    # allowlisted at deployment. Redirects, proxies, auth and large responses are off.
    allowed_host(url)
    with requests.Session() as session:
        session.trust_env=False
        try:
            with session.get(url,timeout=(4,10),stream=True,allow_redirects=False,
                 headers={'Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml',
                          'User-Agent':'ProblemExplorerAuthorizedFeed/0.9.1'}) as response:
                if response.status_code!=200:raise HTTPException(502,f'Feed returned HTTP {response.status_code}')
                ctype=response.headers.get('Content-Type','').lower()
                if not any(x in ctype for x in ('xml','rss','atom')):
                    raise HTTPException(422,'Only RSS or Atom XML endpoints are supported')
                chunks=[];length=0
                for chunk in response.iter_content(chunk_size=8192):
                    length+=len(chunk)
                    if length>MAX_BYTES:raise HTTPException(413,'Feed exceeds 500 KB size limit')
                    chunks.append(chunk)
                raw=b''.join(chunks)
        except requests.RequestException as exc:raise HTTPException(502,'Unable to retrieve approved feed') from exc
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise HTTPException(422,'Feed contains unsupported XML declarations')
    try:root=ET.fromstring(raw)
    except ET.ParseError as exc:raise HTTPException(422,'Invalid feed XML') from exc
    def inner(el,tag):
        found=el.find(tag)
        return ''.join(found.itertext()).strip() if found is not None else ''
    out=[]
    if root.tag.lower().endswith('rss') or root.find('channel') is not None:
        entries=root.findall('./channel/item')
        for e in entries:
            out.append({'url':inner(e,'link'),'title':inner(e,'title'),'excerpt':inner(e,'description')})
    else:
        ns='{http://www.w3.org/2005/Atom}'
        for e in root.findall(ns+'entry'):
            link=next((a.get('href') for a in e.findall(ns+'link') if a.get('rel','alternate')=='alternate'),None)
            out.append({'url':link or '', 'title':inner(e,ns+'title'),
                        'excerpt':inner(e,ns+'summary') or inner(e,ns+'content')})
    clean=[]
    for item in out:
        # Strip markup and limit excerpt length. The source may still contain PII;
        # authorization, review, and retention controls remain required.
        url=item['url'] or ''
        try:signals.valid_url(url)
        except ValueError:continue
        title=html.unescape(re.sub('<[^>]*>',' ',item['title']))[:220].strip()
        excerpt=html.unescape(re.sub('<[^>]*>',' ',item['excerpt']))
        excerpt=' '.join(excerpt.split())[:1000]
        if not title or not excerpt:continue
        clean.append({'url':url,'title':title,'excerpt':excerpt})
    return clean


def check_node(tid,kind,node_id,source_url):
    nodes=signals.flatten(tid)
    row=next((r for r in nodes if r['type']==kind and str(r['id'])==node_id),None)
    if not row:raise HTTPException(404,'Node not part of this Target')
    if not row['effectiveEnabled'] or source_url not in row['effectiveSourceUrls']:
        raise HTTPException(403,'Feed must be enabled and configured on this node or inherited from its parent')
    return row

@router.post('/nodes/{kind}/{node_id}/collect',status_code=202)
def collect(tid:str,kind:signals.Kind,node_id:str,body:CollectRequest,request:Request):
    admin=signals.require_admin(request)
    accessible(tid)
    if not body.attestedRights:raise HTTPException(422,'Confirm authorized collection and permission to use this feed')
    check_node(tid,kind,node_id,body.sourceUrl)
    entries=load_feed(body.sourceUrl)[:body.maxItems]
    # No scoring, endorsements or research claims from imported discussion.
    # MERGE also prevents duplicates after an interrupted HTTP response.
    result=execute(f'''{signals.node_match(kind)}
      UNWIND $entries AS item
      MERGE (candidate:SocialSignalCandidate {{targetId:$tid,nodeId:toString(n.id),sourceUrl:item.url}})
      ON CREATE SET candidate.id=randomUUID(),candidate.sourceFeed=$feed,
        candidate.sourceTitle=item.title,candidate.excerpt=item.excerpt,
        candidate.reviewStatus='pending_review',candidate.collectedAt=datetime(),
        candidate.collectedBy=$actor,candidate.rightsAttestedAt=datetime(),
        candidate.method='allowlisted_rss_atom'
      MERGE (candidate)-[:CANDIDATE_FOR]->(n)
      RETURN count(candidate) AS count''',**signals.params(tid,kind,node_id),entries=entries,
      feed=body.sourceUrl,actor=admin['id'])
    return {'imported':result[0]['count'] if result else 0,'state':'pending_review',
        'note':'Discussion excerpts are not empirical findings and have no scores'}

@router.get('/nodes/{kind}/{node_id}/candidates')
def candidates(tid:str,kind:signals.Kind,node_id:str,request:Request):
    signals.require_admin(request);accessible(tid)
    return query(f'''{signals.node_match(kind)}
      MATCH (c:SocialSignalCandidate {{targetId:$tid}})-[:CANDIDATE_FOR]->(n)
      RETURN c.id AS id,c.sourceUrl AS sourceUrl,c.sourceTitle AS sourceTitle,
        c.excerpt AS excerpt,c.sourceFeed AS sourceFeed,toString(c.collectedAt) AS collectedAt
      ORDER BY c.collectedAt DESC LIMIT 100''',**signals.params(tid,kind,node_id))
