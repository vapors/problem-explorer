"""v0.9.3: account-scoped view state, visual palettes, concept projections."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from app import auth, main, targets, research, graph_preferences as preferences


class GraphPreferencesTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ, {'AUTH_DB_PATH':str(Path(self.temp.name)/'auth.sqlite3')})
        self.env.start()
        auth.init_db();preferences.init_graph_preferences()
        with auth.conn() as c:
            for uid,role in [('alice','user'),('bob','user'),('admin','admin')]:
                c.execute('INSERT INTO users(id,email,name,role,status) VALUES(?,?,?,?,?)',
                          (uid,f'{uid}@example.org',uid,role,'active'))
    def tearDown(self):
        self.env.stop();self.temp.cleanup()

    def with_user(self,user, fn):
        token=main.current_user.set(user)
        try: return fn()
        finally:main.current_user.reset(token)

    def test_view_state_is_scoped_to_account_and_target(self):
        data=preferences.GraphView(expanded=['target:T1','stream:S1','problem:51'],
            focused='problem:51',zoom=1.75,panX=70,panY=-30,signalVisible=True)
        with patch.object(preferences,'accessible',return_value={'id':'T1'}):
            self.with_user('alice',lambda: preferences.save_graph_view('T1',data))
            self.assertEqual(self.with_user('alice',lambda: preferences.get_graph_view('T1'))['expanded'],data.expanded)
            self.assertEqual(self.with_user('alice',lambda: preferences.get_graph_view('T1'))['zoom'],1.75)
            self.assertEqual(self.with_user('bob',lambda: preferences.get_graph_view('T1'))['expanded'],[])
            self.assertEqual(self.with_user('alice',lambda: preferences.get_graph_view('T2'))['expanded'],[])

    def test_shared_target_view_is_saved_for_viewer_not_target_owner(self):
        with patch.object(preferences,'accessible',return_value={'id':'shared','shared':True,'ownerId':'alice'}):
            self.with_user('bob',lambda: preferences.save_graph_view('shared',preferences.GraphView(expanded=['stream:S1'])))
            self.assertEqual(self.with_user('bob',lambda: preferences.get_graph_view('shared'))['expanded'],['stream:S1'])
            self.assertEqual(self.with_user('alice',lambda: preferences.get_graph_view('shared'))['expanded'],[])

    def test_foreign_target_cannot_save_view(self):
        with patch.object(preferences,'accessible',side_effect=HTTPException(404,'denied')):
            with self.assertRaises(HTTPException):
                self.with_user('bob',lambda: preferences.save_graph_view('foreign',preferences.GraphView()))

    def test_view_id_and_zoom_validation(self):
        with patch.object(preferences,'accessible',return_value={'id':'T1'}):
            with self.assertRaises(HTTPException):
                self.with_user('alice',lambda: preferences.save_graph_view('T1',preferences.GraphView(expanded=['neo4j:elementId'])) )
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            preferences.GraphView(zoom=99)

    def test_palette_write_requires_active_admin(self):
        body=preferences.AppearanceUpdate(theme='dark',palette=preferences.GraphPalette(**preferences.DEFAULT_PALETTES['dark']))
        with self.assertRaises(HTTPException) as failure:
            self.with_user('alice',lambda: preferences.set_appearance(body))
        self.assertEqual(failure.exception.status_code,403)
        self.with_user('admin',lambda: preferences.set_appearance(body))
        self.assertEqual(self.with_user('bob',preferences.get_appearance)['dark'],preferences.DEFAULT_PALETTES['dark'])
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            preferences.GraphPalette(**{**preferences.DEFAULT_PALETTES['dark'],'target':'red'})

    def test_additive_sqlite_initialization_keeps_auth_rows(self):
        preferences.init_graph_preferences()
        with auth.conn() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM users').fetchone()[0],3)
            self.assertTrue(c.execute("SELECT 1 FROM sqlite_master WHERE name='user_graph_views'").fetchone())
            self.assertTrue(c.execute("SELECT 1 FROM sqlite_master WHERE name='graph_appearance'").fetchone())

class GraphProjectionTests(unittest.TestCase):
    def test_concept_projection_attaches_only_explicit_origins(self):
        descendants=[
          {'id':'graph-stream','recordKey':'S1','parentId':'graph-target','name':'Lens','type':'stream'},
          {'id':'graph-cat','recordKey':'S1:C1','parentId':'graph-stream','name':'Topic','type':'category'},
          {'id':'graph-problem','recordKey':'33','parentId':'graph-cat','name':'A need','type':'problem','recordId':33},
        ]
        results=[
          [{'id':'T1','ownerId':'alice','name':'Workspace','shared':False}],
          [{'rootId':'graph-target','rootName':'Workspace','descendants':descendants}],
          [],
          [{'problemId':'graph-problem','conceptId':'sol-1','name':'Assistive concept'},
           {'problemId':'not-in-target','conceptId':'sol-foreign','name':'Not attached'}],[],
        ]
        token=main.current_user.set('alice')
        try:
            with patch.object(targets,'query',side_effect=results) as q:
                tree=targets.amcharts_tree('T1')
                self.assertEqual(q.call_count,5)
                self.assertEqual(q.call_args_list[-1].kwargs['owner'],'alice')
        finally:main.current_user.reset(token)
        problem=tree['children'][0]['children'][0]['children'][0]
        self.assertEqual(tree['stableKey'],'target:T1')
        self.assertEqual(problem['stableKey'],'problem:33')
        self.assertEqual(len(problem['children']),1)
        self.assertEqual(problem['conceptCount'],1)
        concept=problem['children'][0]
        self.assertEqual(concept['solutionId'],'sol-1')
        self.assertEqual(concept['stableKey'],'concept:sol-1')
        self.assertEqual(concept['type'],'concept')

    def test_manual_concept_has_optional_scoped_origin(self):
        body=research.ConceptInput(name='Useful concept',description='A sufficiently detailed concept description for saving.',originProblemId=33)
        with patch.object(research,'accessible'),patch.object(research,'problem_row') as problem, \
             patch.object(research,'execute',return_value=[{'id':'saved'}]) as execute, \
             patch.object(research,'me',return_value='alice'):
            output=research.create_solution('T1',body)
        self.assertEqual(output['originProblemId'],33)
        problem.assert_called_once_with('T1',33)
        self.assertEqual(execute.call_args.kwargs['pid'],33)
        self.assertIn('INSPIRED_BY',execute.call_args.args[0])

    def test_existing_unlinked_concept_remains_valid(self):
        body=research.ConceptInput(name='Independent concept',description='An unlinked concept retained in the Concept Studio.')
        with patch.object(research,'accessible'),patch.object(research,'problem_row') as problem, \
             patch.object(research,'execute',return_value=[{'id':'saved'}]) as execute, \
             patch.object(research,'me',return_value='alice'):
            output=research.create_solution('T1',body)
        self.assertIsNone(output['originProblemId'])
        problem.assert_not_called()
        self.assertIsNone(execute.call_args.kwargs['pid'])

    def test_concept_save_does_not_force_chart_root_refresh(self):
        base=Path(__file__).resolve().parents[1]/'apps/web/src'
        main_source=(base/'main.tsx').read_text()
        chart=(base/'NetworkCanvas.tsx').read_text()
        self.assertIn('await refreshConcepts();await loadSolution(created.id,false)',main_source)
        self.assertIn('series.addChildData(parentItem,[entry])',chart)
        self.assertIn('},[targetId,refreshKey,resetSequence]);',chart)
        self.assertNotIn('},[targetId,refreshKey,theme]);',chart)
        self.assertIn('repaintRef.current?.();',chart)

if __name__=='__main__':unittest.main()
