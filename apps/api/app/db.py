import os
from neo4j import GraphDatabase

_driver = None

def driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(os.getenv('NEO4J_URI','bolt://localhost:7687'),auth=(os.getenv('NEO4J_USER','neo4j'),os.getenv('NEO4J_PASSWORD','change-this-password')))
    return _driver

def query(cypher, **params):
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        return [dict(r) for r in session.run(cypher,**params)]

def execute(cypher, **params):
    with driver().session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        return session.execute_write(lambda tx: [dict(r) for r in tx.run(cypher,**params)])
