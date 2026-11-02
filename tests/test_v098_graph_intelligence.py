"""v0.9.8 authorized counters and reversible concept lifecycle contracts."""
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
from app import research,targets,graph_preferences,main

class ConceptStatusTests(unittest.TestCase):
    def test_reject_is_reversible_and_scoped(self):
        for status in ('rejected','active'):
            with patch.object(research,'accessible') as accessible, \
                 patch.object(research,'me',return_value='alice'), \
                 patch.object(research,'execute',return_value=[{'id':'s1'}]) as execute:
                result=research.change_concept_status('T','s1',research.ConceptStatusUpdate(status=status))
                accessible.assert_called_with('T',True)
                self.assertEqual(result['status'],status)
                self.assertEqual(execute.call_args.kwargs['owner'],'alice')
                self.assertEqual(execute.call_args.kwargs['tid'],'T')
                self.assertEqual(execute.call_args.kwargs['status'],status)
                self.assertIn('SET s.reviewStatus',execute.call_args.args[0])
                self.assertNotIn('DELETE',execute.call_args.args[0])

    def test_reject_other_account_concept_is_not_found(self):
        with patch.object(research,'accessible'), \
             patch.object(research,'me',return_value='alice'), \
             patch.object(research,'execute',return_value=[]):
            with self.assertRaises(HTTPException) as error:
                research.change_concept_status('T','someone-elses',research.ConceptStatusUpdate(status='rejected'))
        self.assertEqual(error.exception.status_code,404)

    def test_rejected_concepts_are_filtered_by_owner(self):
        with patch.object(research,'accessible') as access, \
             patch.object(research,'me',return_value='alice'), \
             patch.object(research,'query',return_value=[]) as query:
            result=research.rejected_concepts('T',skip=20,limit=50)
        self.assertEqual(result,[])
        access.assert_called_with('T')
        self.assertEqual(query.call_args.kwargs['owner'],'alice')
        self.assertEqual(query.call_args.kwargs['skip'],20)
        self.assertIn("reviewStatus:'rejected'",query.call_args.args[0])

    def test_active_concept_listing_excludes_rejected(self):
        with patch.object(research,'accessible'), \
             patch.object(research,'me',return_value='alice'), \
             patch.object(research,'query',return_value=[]) as query:
            research.solutions('T')
        self.assertIn("coalesce(s.reviewStatus,'active')='active'",query.call_args.args[0])

class GraphAggregatesTests(unittest.TestCase):
    def test_rollups_count_each_problem_and_linked_concept(self):
        descendants=[
            {'id':'stream','recordKey':'s','parentId':'target','name':'S','type':'stream'},
            {'id':'category','recordKey':'c','parentId':'stream','name':'C','type':'category'},
            {'id':'p1','recordKey':'1','parentId':'category','name':'P1','type':'problem','recordId':1},
            {'id':'p2','recordKey':'2','parentId':'category','name':'P2','type':'problem','recordId':2},
        ]
        results=[
            [{'id':'T','ownerId':'alice','name':'Title','shared':False}],
            [{'rootId':'target','rootName':'Title','descendants':descendants}],
            [],
            [{'problemId':'p1','conceptId':'A','name':'A'},
             {'problemId':'p2','conceptId':'B','name':'B'},
             {'problemId':'p2','conceptId':'C','name':'C'}],
            [{'problemId':'p1','reviewed':2,'unreviewed':1},
             {'problemId':'p2','reviewed':3,'unreviewed':4}],
        ]
        token=main.current_user.set('alice')
        try:
            with patch.object(targets,'query',side_effect=results) as query:
                tree=targets.amcharts_tree('T')
        finally:main.current_user.reset(token)
        for item in (tree,tree['children'][0],tree['children'][0]['children'][0]):
            self.assertEqual(item['conceptCount'],3)
            self.assertEqual(item['problemCount'],2)
            self.assertEqual(item['reviewedCount'],5)
            self.assertEqual(item['unreviewedCount'],5)
        finding_query=query.call_args_list[-1]
        self.assertEqual(finding_query.kwargs['owner'],'alice')
        self.assertEqual(finding_query.kwargs['tid'],'T')
        self.assertIn("f.reviewStatus='reviewed'",finding_query.args[0])

    def test_palette_extends_existing_fields_and_toggle_defaults(self):
        for theme in ('dark','light'):
            payload=graph_preferences.GraphPalette.model_validate(graph_preferences.DEFAULT_PALETTES[theme])
            self.assertTrue(payload.showConceptBadges)
            self.assertTrue(payload.showReviewedBadges)
            self.assertTrue(payload.showUnreviewedBadges)
            self.assertTrue(payload.showProblemBadges)
            self.assertRegex(payload.badgeReviewed,r'^#[0-9a-fA-F]{6}$')
            self.assertRegex(payload.badgeUnreviewed,r'^#[0-9a-fA-F]{6}$')

if __name__=='__main__':unittest.main()
