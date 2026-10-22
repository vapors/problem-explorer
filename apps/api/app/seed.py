import csv, os
from pathlib import Path
from .db import execute, query

SCHEMA = [
 'CREATE CONSTRAINT stream_id IF NOT EXISTS FOR (n:Stream) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT category_id IF NOT EXISTS FOR (n:Category) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT problem_id IF NOT EXISTS FOR (n:Problem) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT solution_id IF NOT EXISTS FOR (n:Solution) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT research_id IF NOT EXISTS FOR (n:ResearchRun) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT source_url IF NOT EXISTS FOR (n:Source) REQUIRE n.url IS UNIQUE',
 'CREATE CONSTRAINT discovery_id IF NOT EXISTS FOR (n:Discovery) REQUIRE n.id IS UNIQUE',
 'CREATE CONSTRAINT evaluation_id IF NOT EXISTS FOR (n:Evaluation) REQUIRE n.id IS UNIQUE',
 'CREATE FULLTEXT INDEX problem_search IF NOT EXISTS FOR (n:Problem) ON EACH [n.description,n.categoryName,n.streamName]'
]

def seed():
    for statement in SCHEMA: execute(statement)
    p=Path(os.getenv('DATA_FILE','/app/data/problems.csv'))
    with p.open(encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    assert len(rows)==498, f'Expected 498 original records; got {len(rows)}'
    ids={int(r['id']) for r in rows}
    assert len(ids)==498 and min(ids)==1 and max(ids)==498
    stream_names=list(dict.fromkeys(r['stream'] for r in rows))
    assert len(stream_names)==4
    for r in rows:
        s=stream_names.index(r['stream'])+1
        category=r['subcategory'].strip()
        r.update(id=int(r['id']),stream_id=f'S{s}',category_id=f'S{s}:{category.split(".")[0]}',stream_name=r['stream'],category_name=category)
    execute('''UNWIND $rows AS row
       MERGE (s:Stream {id: row.stream_id}) SET s.name=row.stream_name
       MERGE (c:Category {id: row.category_id}) SET c.name=row.category_name, c.streamId=row.stream_id
       MERGE (p:Problem {id: row.id}) SET p.description=row.problem, p.streamName=row.stream_name,
            p.categoryName=row.category_name, p.origin='original-498', p.streamId=row.stream_id
       MERGE (s)-[:CONTAINS]->(c) MERGE (c)-[:CONTAINS]->(p)''',rows=rows)
    execute("MERGE (counter:IdCounter {name:'problem'}) ON CREATE SET counter.next=498")
    return {'problems':len(rows),'streams':len(stream_names),'categories':len(set(r['category_id'] for r in rows))}

if __name__=='__main__': print(seed())
