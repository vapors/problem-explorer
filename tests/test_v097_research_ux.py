"""v0.9.7 source-of-truth status accounting and access control contracts."""
import pathlib
import sys
import unittest
from unittest.mock import patch
from fastapi import HTTPException

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'apps' / 'api'))
from app import research

class ResearchUXTests(unittest.TestCase):
    def test_counts_reconcile_and_are_scoped(self):
        counts = [{'runCount':3,'findingCount':7,'reviewedCount':2,'needsReviewCount':3,'rejectedCount':2}]
        with patch.object(research,'accessible') as accessible, patch.object(research,'me',return_value='acct-A'), \
             patch.object(research,'query',side_effect=[counts,[]]) as query:
            result=research.research_activity('target-1')
        accessible.assert_called_once_with('target-1')
        self.assertEqual(result['findingCount'],result['reviewedCount']+result['needsReviewCount']+result['rejectedCount'])
        self.assertEqual(result['rejectedCount'],2)
        self.assertTrue(all(call.kwargs['owner']=='acct-A' and call.kwargs['tid']=='target-1' for call in query.call_args_list))
        self.assertIn("f.reviewStatus='rejected'",query.call_args_list[0].args[0])

    def test_rejected_records_are_not_deleted_on_status_change(self):
        from app.research import FindingReview
        with patch.object(research,'accessible') as access, patch.object(research,'me',return_value='acct-A'), \
             patch.object(research,'execute',return_value=[{'id':'find-1'}]) as execute:
            result=research.review_finding('target-1','find-1',FindingReview(status='needs_review'))
        access.assert_called_once_with('target-1',True)
        self.assertEqual(result['status'],'needs_review')
        self.assertIn('SET f.reviewStatus=$status', execute.call_args.args[0])
        self.assertNotIn('DELETE',execute.call_args.args[0])
        self.assertEqual(execute.call_args.kwargs['owner'],'acct-A')

    def test_rejected_list_is_account_and_target_scoped(self):
        with patch.object(research,'accessible') as access, patch.object(research,'me',return_value='acct-A'), \
             patch.object(research,'query',return_value=[{'id':'find-1'}]) as query:
            result=research.rejected_findings('target-1',skip=7,limit=9999)
        self.assertEqual(len(result),1)
        access.assert_called_once_with('target-1')
        self.assertEqual(query.call_args.kwargs['owner'],'acct-A')
        self.assertEqual(query.call_args.kwargs['tid'],'target-1')
        self.assertEqual(query.call_args.kwargs['skip'],7)
        self.assertEqual(query.call_args.kwargs['limit'],200)
        self.assertIn('ownerId:$owner',query.call_args.args[0])
        self.assertIn("reviewStatus:'rejected'",query.call_args.args[0])
        self.assertIn('[:HAS_STREAM]',query.call_args.args[0])

    def test_denied_target_does_not_run_rejected_query(self):
        with patch.object(research,'accessible',side_effect=HTTPException(403,'denied')), \
             patch.object(research,'query') as query:
            with self.assertRaises(HTTPException):research.rejected_findings('private')
            query.assert_not_called()

    def test_problem_uses_origin_edge_not_similarity_to_list_concepts(self):
        with patch.object(research,'problem_row',return_value={'id':99}), \
             patch.object(research,'me',return_value='acct-A'),patch.object(research,'query',return_value=[]) as query:
            response=research.get_problem('target-1',99)
        self.assertEqual(response['solutions'],[])
        solution_calls=[call for call in query.call_args_list if 'INSPIRED_BY' in call.args[0]]
        self.assertEqual(len(solution_calls),1)
        self.assertEqual(solution_calls[0].kwargs['tid'],'target-1')
        self.assertEqual(solution_calls[0].kwargs['owner'],'acct-A')

if __name__=='__main__':unittest.main()
