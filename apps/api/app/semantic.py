# OpenAI embeddings + Neo4j vector search; no automatic API expenditure on startup.
import os, re, math
from .db import query, execute
from contextvars import ContextVar
# Read authenticated identity lazily to avoid circular imports.
def user_id():
    from .main import uid
    return uid()
from .ai import client

MODEL=os.getenv('OPENAI_EMBEDDING_MODEL','text-embedding-3-small')
DIM=1536  # dimension for text-embedding-3-small with default parameters

def embed(texts):
    if not texts: return []
    out=[]
    for i in range(0,len(texts),80):
        batch=texts[i:i+80]
        r=client().embeddings.create(model=MODEL,input=batch)
        out += [x.embedding for x in sorted(r.data,key=lambda x:x.index)]
    return out

def ensure_vector_index():
    execute(f'CREATE VECTOR INDEX problem_embedding_v2 IF NOT EXISTS FOR (p:Problem) ON (p.embedding) OPTIONS {{indexConfig: {{`vector.dimensions`: {DIM}, `vector.similarity_function`: "cosine"}}}}')

def index_missing(limit=100):
    rows=query('MATCH (p:Problem) WHERE p.embedding IS NULL AND (p.ownerId IS NULL OR p.ownerId=$owner) RETURN p.id AS id,p.description AS description ORDER BY p.id LIMIT $limit',limit=min(limit,20),owner=user_id())
    if not rows: return {'indexed':0,'remaining':0}
    vectors=embed([x['description'] for x in rows])
    execute('UNWIND $rows AS row MATCH (p:Problem {id:row.id}) CALL db.create.setNodeVectorProperty(p,"embedding",row.vector) RETURN count(p) AS n', rows=[{'id':r['id'],'vector':v} for r,v in zip(rows,vectors)])
    remaining=query('MATCH (p:Problem) WHERE p.embedding IS NULL AND (p.ownerId IS NULL OR p.ownerId=$owner) RETURN count(p) AS n',owner=user_id())[0]['n']
    return {'indexed':len(rows),'remaining':remaining}

def lexical(text,limit=25,stream=''):
    terms=[x for x in re.findall(r'[a-z0-9]{3,}',text.lower()) if x not in {'the','for','and','with','older','people','person','difficulty','having','their','that','this'}]
    rows=query('MATCH (p:Problem) WHERE (p.ownerId IS NULL OR p.ownerId=$owner) AND ($stream="" OR p.streamId=$stream) RETURN p.id AS id,p.description AS description,p.origin AS origin,p.streamId AS streamId',stream=stream,owner=user_id())
    ranks=[]
    for p in rows:
        lower=p['description'].lower()
        score=sum(1 for t in set(terms) if t in lower)
        if text.lower() in lower:score+=8
        if score:ranks.append((score,p))
    return [{**p,'score':round(min(1,score/max(len(set(terms)),1)),3),'searchMode':'lexical'} for score,p in sorted(ranks,key=lambda t:(-t[0],t[1]['id']))[:limit]]

def similar(text,limit=25,stream='',semantic_only=False):
    # Embeddings are optional until user triggers indexing.
    count=query('MATCH (p:Problem) WHERE p.embedding IS NOT NULL RETURN count(p) AS n')[0]['n']
    if not count:
        return {'mode':'lexical-fallback','indexCount':0,'results':lexical(text,limit,stream)}
    v=embed([text])[0]
    rows=query('''CALL db.index.vector.queryNodes("problem_embedding_v2",$k,$embedding) YIELD node,score
      WHERE (node.ownerId IS NULL OR node.ownerId=$owner) AND ($stream='' OR node.streamId=$stream)
      RETURN node.id AS id,node.description AS description,node.origin AS origin,node.streamId AS streamId,score
      ORDER BY score DESC LIMIT $limit''',k=min(max(count,1),max(limit*6,60)),embedding=v,limit=limit,stream=stream,owner=user_id())
    results=[{**r,'score':round(r['score'],4),'searchMode':'semantic'} for r in rows]
    if not semantic_only:
        seen={x['id'] for x in results}
        for lex in lexical(text,limit,stream):
            if lex['id'] not in seen: results.append(lex);seen.add(lex['id'])
    return {'mode':'semantic' if semantic_only else 'hybrid','indexCount':count,'results':results[:limit]}

def nearest_duplicate(statement):
    # Always check all existing records before approval. Strong fuzzy similarity alone is not proof of duplication.
    from difflib import SequenceMatcher
    rows=query('MATCH (p:Problem) WHERE p.ownerId IS NULL OR p.ownerId=$owner RETURN p.id AS id,p.description AS description',owner=user_id())
    scored=sorted(({'id':r['id'],'description':r['description'],'textSimilarity':round(SequenceMatcher(None,statement.lower(),r['description'].lower()).ratio(),3)} for r in rows),key=lambda r:-r['textSimilarity'])
    vector=[]
    if query('MATCH (p:Problem) WHERE p.embedding IS NOT NULL RETURN count(p) AS n')[0]['n']:
        try: vector=similar(statement,10,semantic_only=True)['results']
        except Exception:pass
    by_id={r['id']:{**r,'semanticSimilarity':None} for r in scored[:12]}
    for r in vector:
        if r['id'] not in by_id:
            original=next((x for x in rows if x['id']==r['id']),None)
            if original:by_id[r['id']]={'id':r['id'],'description':original['description'],'textSimilarity':None,'semanticSimilarity':r['score']}
        else:by_id[r['id']]['semanticSimilarity']=r['score']
    matches=sorted(by_id.values(),key=lambda r:max(r['semanticSimilarity'] or 0,r['textSimilarity'] or 0),reverse=True)[:10]
    # Conservative blocking. Borderline cases require manual resolution, not insertion.
    blocked=any((m['textSimilarity'] or 0)>=0.88 or (m['semanticSimilarity'] or 0)>=0.91 for m in matches)
    needs_review=any((m['textSimilarity'] or 0)>=0.65 or (m['semanticSimilarity'] or 0)>=0.82 for m in matches)
    return {'matches':matches,'blocked':blocked,'needsReview':needs_review,'embeddingCoverage':query('MATCH (p:Problem) WHERE p.embedding IS NULL AND (p.ownerId IS NULL OR p.ownerId=$owner) RETURN count(p) AS n',owner=user_id())[0]['n']==0}
