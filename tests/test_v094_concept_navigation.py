"""v0.9.4: presentation-only concept counters and modal wiring.

These are offline contract tests; they cannot replace a browser render test.
"""
import unittest
from pathlib import Path
from unittest.mock import patch
from app import main,targets

BASE=Path(__file__).resolve().parents[1]/'apps/web/src'

class ConceptNavigationTests(unittest.TestCase):
    def test_no_concepts_count_is_zero(self):
        descendants=[
          {'id':'s','recordKey':'s','parentId':'t','name':'Stream','type':'stream'},
          {'id':'c','recordKey':'c','parentId':'s','name':'Category','type':'category'},
          {'id':'p','recordKey':'1','parentId':'c','name':'Need','type':'problem','recordId':1},
        ]
        token=main.current_user.set('alice')
        try:
            with patch.object(targets,'query',side_effect=[
              [{'id':'T','ownerId':'alice','name':'Research target','shared':False}],
              [{'rootId':'t','rootName':'Research target','descendants':descendants}],[],[],[]]):
                tree=targets.amcharts_tree('T')
        finally:
            main.current_user.reset(token)
        problem=tree['children'][0]['children'][0]['children'][0]
        self.assertEqual(problem['conceptCount'],0)
        self.assertNotIn('children',problem)

    def test_attached_concepts_produce_count_and_private_scoped_query(self):
        descendants=[
          {'id':'s','recordKey':'s','parentId':'t','name':'Stream','type':'stream'},
          {'id':'c','recordKey':'c','parentId':'s','name':'Category','type':'category'},
          {'id':'p','recordKey':'1','parentId':'c','name':'Need','type':'problem','recordId':1},
        ]
        token=main.current_user.set('alice')
        try:
            with patch.object(targets,'query',side_effect=[
              [{'id':'T','ownerId':'alice','name':'Research target','shared':False}],
              [{'rootId':'t','rootName':'Research target','descendants':descendants}],[],
              [{'problemId':'p','conceptId':'A','name':'Idea A'},
               {'problemId':'p','conceptId':'B','name':'Idea B'},
               {'problemId':'elsewhere','conceptId':'X','name':'Foreign'}],[],
            ]) as q:
                tree=targets.amcharts_tree('T')
                self.assertEqual(q.call_args.kwargs['owner'],'alice')
                self.assertEqual(q.call_args.kwargs['tid'],'T')
        finally:
            main.current_user.reset(token)
        problem=tree['children'][0]['children'][0]['children'][0]
        self.assertEqual(problem['conceptCount'],2)
        self.assertEqual({x['solutionId'] for x in problem['children']},{'A','B'})

    def test_badge_does_not_change_persistent_chart_dependencies(self):
        src=(BASE/'NetworkCanvas.tsx').read_text()
        self.assertIn('series.nodes.template.setup=',src)
        self.assertIn("badge.events.on('click'",src)
        self.assertIn('suppressedProblemClick',src)
        self.assertIn('series.disableDataItem(item)',src)
        self.assertIn('series.enableDataItem(item,1)',src)
        self.assertIn('},[targetId,refreshKey,resetSequence]);',src)

    def test_workspace_is_distinct_from_concept_studio(self):
        src=(BASE/'main.tsx').read_text()
        self.assertIn('onConceptNodeSelect={id=>run(\'concept\',()=>openConceptWorkspace(id))}',src)
        self.assertIn('<ConceptWorkspaceModal',src)
        self.assertIn("changeTab('matching')",src)
        self.assertIn("changeTab('evaluation',true)",src)
        self.assertIn("setConceptModalOpen(false);setDrafts([])",src)

    def test_concept_workspace_has_accessible_modal_and_actions(self):
        src=(BASE/'ConceptWorkspaceModal.tsx').read_text()
        self.assertIn('aria-modal="true"',src)
        self.assertIn('aria-labelledby=',src)
        self.assertIn('onMatching',src)
        self.assertIn('onAnalysis',src)
        self.assertIn('onClose',src)

if __name__=='__main__':unittest.main()
