"""Offline v0.8.2 security/contract tests; live Neo4j still needs staging validation."""
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app import targets, admin, research, ai, main
from app.schemas import EvaluationResult,FactorRating


def factors(basis='inference'):
    return [FactorRating(factor=name,score=4,confidence='low',rationale='Assumption only',
                         evidence_urls=[],unanswered_questions=['Validate with users'],basis=basis)
            for name in ['desirability','feasibility','viability','impact','coverage']]


class V082Tests(unittest.TestCase):
    def test_admin_target_routes(self):
        routes={(r.path,m) for r in main.app.routes for m in getattr(r,'methods',set())}
        self.assertIn(('/api/admin/targets','GET'),routes)
        self.assertIn(('/api/admin/targets/{tid}','DELETE'),routes)
        self.assertIn(('/api/targets/{tid}','DELETE'),routes)

    def test_reference_library_cannot_be_destroyed(self):
        with self.assertRaises(HTTPException) as caught:
            targets.destroy_target(targets.REFERENCE,'administrator',admin=True)
        self.assertEqual(caught.exception.status_code,403)

    def test_admin_confirmation_id_mismatch_never_opens_driver(self):
        with patch.object(admin,'require_admin',return_value={'id':'admin'}), \
             patch.object(admin,'destroy_target') as destroy:
            with self.assertRaises(HTTPException):
                admin.admin_delete_target('T1',admin.ConfirmTargetDeletion(target_name='T',target_id='T2'),MagicMock())
            destroy.assert_not_called()

    def test_atomic_delete_uses_one_write_and_double_checks_owner(self):
        session=MagicMock();session.__enter__.return_value=session
        tx=MagicMock();tx.run.return_value.data.return_value=[{'deleted':7}]
        session.execute_write.side_effect=lambda fn:fn(tx)
        database=MagicMock();database.session.return_value=session
        with patch.object(targets,'driver',return_value=database):
            result=targets.destroy_target('T1','user1',expected_name='Example')
        self.assertEqual(result['deletedNodes'],7)
        session.execute_write.assert_called_once()
        self.assertEqual(tx.run.call_count,1)
        sql=tx.run.call_args.args[0]
        self.assertIn('coalesce(t.reference,false)=false',sql)
        self.assertIn('t.ownerId=$owner',sql)
        self.assertIn('collect(DISTINCT node)',sql)
        self.assertEqual(tx.run.call_args.kwargs['expected'],'Example')

    def test_admin_inventory_requires_admin(self):
        with patch.object(admin,'require_admin',side_effect=HTTPException(403,'Denied')), \
             patch.object(admin,'query') as get:
            with self.assertRaises(HTTPException):admin.list_targets(MagicMock())
            get.assert_not_called()

    def test_ai_modes_keep_inferred_scores_out_of_evidence_mode(self):
        answer=EvaluationResult(summary='Hypothetical',factors=factors(),key_assumptions=[],risks=[],next_research=[])
        with patch.object(ai,'parse_structured',return_value=answer):
            result=ai.evaluate('a concept','some matched problems','no reviewed research','evidence')
        self.assertTrue(all(f.score is None and f.basis=='unknown' for f in result.factors))
        answer=EvaluationResult(summary='Hypothetical',factors=factors(),key_assumptions=[],risks=[],next_research=[])
        with patch.object(ai,'parse_structured',return_value=answer):
            result=ai.evaluate('a concept','some matched problems','no reviewed research','exploratory')
        self.assertTrue(all(f.score==4 and f.basis=='inference' for f in result.factors))

    def test_evaluation_saves_mode_and_screens_unreviewed_findings(self):
        answer=EvaluationResult(summary='Scored',factors=factors('evidence'),key_assumptions=[],risks=[],next_research=[])
        supplied=[{'claim':'Reviewed','status':'reviewed','url':'https://example.org/reviewed'},
                  {'claim':'Unreviewed','status':'needs_review','url':'https://example.org/pending'}]
        with patch.object(research,'accessible'),patch.object(research,'me',return_value='user1'), \
             patch.object(research,'solution',return_value={'name':'Concept','description':'Description','matches':[{'problemId':4}]}), \
             patch.object(research,'query',return_value=supplied), \
             patch.object(research.ai,'evaluate',return_value=answer) as evaluate_ai, \
             patch.object(research,'execute') as save:
            result=research.evaluate('T1','S1',research.EvaluationRequest(mode='evidence'))
        self.assertEqual(result['data']['mode'],'evidence')
        self.assertFalse(result['data']['sentimentIncluded'])
        self.assertEqual(result['evidenceCount'],1)
        self.assertNotIn('Unreviewed',evaluate_ai.call_args.args[2])
        self.assertIn('Reviewed',evaluate_ai.call_args.args[2])
        self.assertEqual(save.call_args.kwargs['method'],'ai_rubric_v3_10point_evidence')

    def test_invalid_mode_rejected_at_schema_boundary(self):
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):research.EvaluationRequest(mode='sentiment')

if __name__=='__main__':unittest.main()
