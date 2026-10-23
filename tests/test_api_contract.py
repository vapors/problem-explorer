"""Offline API contract tests; no live Neo4j, Google or OpenAI required.
Run from project root: python -m unittest discover -s tests -v
These cover endpoint registration and authorization gates, NOT real database behavior.
"""
import sys, types, unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))

# Lightweight imports for CI hosts that have not installed the optional runtime stack.
try:import neo4j  # noqa: F401
except ImportError:
    neo=types.ModuleType('neo4j')
    class GraphDatabase:
        @staticmethod
        def driver(*args,**kwargs):raise RuntimeError('Neo4j not running in offline tests')
    neo.GraphDatabase=GraphDatabase
    sys.modules['neo4j']=neo
try:import pwdlib  # noqa: F401
except ImportError:
    pwd=types.ModuleType('pwdlib')
    class PasswordHash:
        @staticmethod
        def recommended():return PasswordHash()
    pwd.PasswordHash=PasswordHash
    sys.modules['pwdlib']=pwd
try:import google.oauth2.id_token  # noqa: F401
except ImportError:
    google=types.ModuleType('google');google.__path__=[]
    oauth=types.ModuleType('google.oauth2');oauth.__path__=[]
    ident=types.ModuleType('google.oauth2.id_token')
    auth_google=types.ModuleType('google.auth');auth_google.__path__=[]
    transport=types.ModuleType('google.auth.transport');transport.__path__=[]
    grequests=types.ModuleType('google.auth.transport.requests')
    google.oauth2=oauth;oauth.id_token=ident;google.auth=auth_google;auth_google.transport=transport;transport.requests=grequests
    sys.modules.update({'google':google,'google.oauth2':oauth,'google.oauth2.id_token':ident,
      'google.auth':auth_google,'google.auth.transport':transport,'google.auth.transport.requests':grequests})

try:import openai  # noqa: F401
except ImportError:
    openai=types.ModuleType('openai')
    class OpenAI:
        def __init__(self,*args,**kwargs):raise RuntimeError('OpenAI not available in offline tests')
    openai.OpenAI=OpenAI
    sys.modules['openai']=openai

from fastapi import HTTPException
from app import main,targets

class ApiContractTests(unittest.TestCase):
    def test_all_research_routes_are_scoped(self):
        routes={(route.path,method) for route in main.app.routes for method in getattr(route,'methods',set())}
        for fragment,method in [('/problems/{pid}/research','POST'),('/problems/{pid}/concepts/generate','POST'),
          ('/solutions/{sid}/match','POST'),('/solutions/{sid}/evaluate','POST'),('/discoveries/search','POST'),
          ('/search','POST'),('/graph','GET'),('/expand/{node_id:path}','GET')]:
            self.assertIn(('/api/targets/{tid}'+fragment,method),routes)
        for legacy in ('/api/problems/{pid}/research','/api/solutions/{sid}/match','/api/graph/root'):
            self.assertFalse(any(path==legacy for path,_ in routes),legacy)

    def test_amcharts_tree_endpoint_is_registered(self):
        routes={(route.path,method) for route in main.app.routes for method in getattr(route,'methods',set())}
        self.assertIn(('/api/targets/{tid}/amcharts-tree','GET'),routes)

    def test_amcharts_tree_nested_contract_and_cross_target_filter(self):
        target={'id':'T1','name':'Research target','description':'','ownerId':'userA','shared':False}
        descendants=[
            {'id':'neo-stream','parentId':'neo-root','name':'Mobility','type':'stream','recordId':None},
            {'id':'neo-problem2','parentId':'neo-category','name':'A second unmet need','type':'problem','recordId':92},
            {'id':'neo-category','parentId':'neo-stream','name':'Safe movement','type':'category','recordId':None},
            {'id':'neo-problem1','parentId':'neo-category','name':'A specific unmet need','type':'problem','recordId':91},
        ]
        query_results=[[target],[{'rootId':'neo-root','rootName':'Research target','descendants':descendants}],
            [{'sourceId':'neo-problem1','destinationIds':['neo-problem2','neo-outside','neo-problem1','neo-problem2']}]]
        token=main.current_user.set('userA')
        try:
            with patch.object(targets,'query',side_effect=query_results) as mocked:
                tree=targets.amcharts_tree('T1')
                self.assertEqual(mocked.call_count,3)
                self.assertEqual([call.kwargs['tid'] for call in mocked.call_args_list],['T1']*3)
        finally:main.current_user.reset(token)
        self.assertEqual(tree['id'],'neo-root')
        self.assertEqual(tree['type'],'target')
        stream=tree['children'][0]
        self.assertEqual(stream['type'],'stream')
        category=stream['children'][0]
        self.assertEqual(category['type'],'category')
        problem=next(child for child in category['children'] if child['recordId']==91)
        self.assertEqual(problem['recordId'],91)
        self.assertEqual(problem['value'],100)
        self.assertEqual(problem['crossLinks'],['neo-problem2'])
        self.assertNotIn('children',problem)
        self.assertEqual(next(child for child in category['children'] if child['recordId']==92)['crossLinks'],[])

    def test_amcharts_tree_denies_foreign_private_targets(self):
        token=main.current_user.set('other-user')
        try:
            with patch.object(targets,'query',return_value=[]) as mocked:
                with self.assertRaises(HTTPException) as ctx: targets.amcharts_tree('Tprivate')
                self.assertEqual(ctx.exception.status_code,404)
                self.assertEqual(mocked.call_count,1) # No graph query after denial.
        finally:main.current_user.reset(token)

    def test_amcharts_tree_supports_empty_target(self):
        token=main.current_user.set('userA')
        try:
            with patch.object(targets,'query',side_effect=[
                [{'id':'empty','ownerId':'userA','shared':False,'name':'Empty'}],
                [{'rootId':'neo-empty','rootName':'Empty','descendants':[{'id':None,'type':None}]}],
                []]):
                tree=targets.amcharts_tree('empty')
        finally:main.current_user.reset(token)
        self.assertEqual(tree,{'id':'neo-empty','name':'Empty','type':'target','children':[]})

    def test_shared_target_read_only(self):
        row={'id':'Tshared','name':'Example','description':'','ownerId':'userA','shared':True,'reference':False}
        with patch.object(targets,'query',return_value=[row]):
            token=main.current_user.set('userB')
            try:
                self.assertEqual(targets.accessible('Tshared')['id'],'Tshared')
                with self.assertRaises(HTTPException) as ctx: targets.accessible('Tshared',True)
                self.assertEqual(ctx.exception.status_code,403)
            finally:main.current_user.reset(token)

    def test_missing_target_denied(self):
        with patch.object(targets,'query',return_value=[]):
            token=main.current_user.set('userB')
            try:
                with self.assertRaises(HTTPException) as ctx: targets.accessible('Tother')
                self.assertEqual(ctx.exception.status_code,404)
            finally:main.current_user.reset(token)

    def test_unauthenticated_api_is_rejected(self):
        from fastapi.testclient import TestClient
        with patch('app.auth.session_user',return_value=None):
            response=TestClient(main.app).get('/api/targets')
            self.assertEqual(response.status_code,401)

    def test_owned_target_required_for_mutations(self):
        from fastapi.testclient import TestClient
        with patch('app.auth.session_user',return_value={'id':'other-user','role':'user','status':'active'}),patch.object(targets,'query',return_value=[]):
            response=TestClient(main.app).post('/api/targets/Tsomeoneelse/streams',json={'name':'Unauthorized stream','description':''})
            self.assertEqual(response.status_code,404)

    def test_reference_csv_intact(self):
        import csv
        with (ROOT/'data/problems.csv').open(encoding='utf-8-sig') as f: rows=list(csv.DictReader(f))
        self.assertEqual(len(rows),498)
        self.assertEqual(len({r['stream'] for r in rows}),4)

    def test_bootstrap_not_in_lifespan(self):
        source=(ROOT/'apps/api/app/main.py').read_text()
        self.assertNotIn('reset_all(',source)
        self.assertNotIn('seed_reference(',source)

if __name__=='__main__':unittest.main()
