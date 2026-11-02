"""Security, sentinel, and data integrity contracts. No live graph or external API required."""
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from pydantic import ValidationError
from app import main, signals, ai
from app.schemas import FactorRating


class SignalContracts(unittest.TestCase):
    def test_scoped_routes_are_registered(self):
        routes={(r.path, method) for r in main.app.routes for method in getattr(r,'methods',())}
        prefix='/api/targets/{tid}/signals'
        for path,method in [('/nodes','GET'),('/graph','GET'),
                            ('/nodes/{kind}/{node_id}/config','PATCH'),
                            ('/nodes/{kind}/{node_id}/override','PATCH'),
                            ('/nodes/{kind}/{node_id}/observations','POST'),
                            ('/nodes/{kind}/{node_id}/observations','GET'),
                            ('/solutions/{sid}','GET')]:
            self.assertIn((prefix+path, method),routes)

    def test_no_data_is_never_1(self):
        self.assertIsNone(signals.OverrideInput(active=False).score)
        with self.assertRaises(ValidationError):
            signals.OverrideInput(active=True, score=None)
        rating=FactorRating(factor='impact',score=None,confidence='unknown',rationale='Unknown',evidence_urls=[],unanswered_questions=[])
        self.assertIsNone(rating.score)
        self.assertEqual(FactorRating(factor='impact',score=10,confidence='low',rationale='Estimate',evidence_urls=[],unanswered_questions=[]).score,10)
        with self.assertRaises(ValidationError):
            FactorRating(factor='impact',score=0,confidence='low',rationale='Invalid',evidence_urls=[],unanswered_questions=[])

    def test_http_private_and_duplicate_sources_denied(self):
        for url in ('http://reddit.com/r/example','https://localhost/a',
                    'https://127.0.0.1/resource','https://10.0.0.9/a','https://admin:password@example.com/'):
            with self.subTest(url=url),self.assertRaises(ValueError):
                signals.valid_url(url)
        self.assertEqual(signals.valid_url('https://www.reddit.com/r/example/'),'https://www.reddit.com/r/example/')
        with self.assertRaises(ValidationError):
            signals.NodeConfig(enabled='on',sourceMode='custom',sourceUrls=['https://example.org/a','https://example.org/a'])

    def test_permission_denied_before_mutation(self):
        with patch.object(signals,'require_admin',side_effect=HTTPException(403,'No admin')), \
             patch.object(signals,'execute') as execute:
            with self.assertRaises(HTTPException):
                signals.configure('T1','target','T1',signals.NodeConfig(enabled='on',sourceMode='custom'),MagicMock())
            execute.assert_not_called()

    def test_config_query_scopes_node_under_target(self):
        with patch.object(signals,'require_admin',return_value={'id':'admin'}), \
             patch.object(signals,'accessible'),patch.object(signals,'execute',return_value=[{'id':7}]) as execute:
            signals.configure('T1','problem','7',signals.NodeConfig(enabled='inherit',sourceMode='inherit'),MagicMock())
        statement=execute.call_args.args[0]
        self.assertIn('MATCH (t:Target {id:$tid})-[:HAS_STREAM]',statement)
        self.assertIn('(n:Problem {id:$problemId})',statement)
        self.assertEqual(execute.call_args.kwargs['problemId'],7)
        self.assertEqual(execute.call_args.kwargs['tid'],'T1')

    def test_default_inheritance_and_override_resolution(self):
        rows=[
            {'id':'T1','graphId':'root','name':'Target','labels':['Target'],'streamId':None,
             'enabled':'on','sourceMode':'custom','sourceUrls':['https://example.org/a'],
             'automatedSentiment':None,'userOverriddenSentiment':None,'isOverrideActive':False,'observationCount':0},
            {'id':'S1','graphId':'stream','name':'Stream','labels':['Stream'],'streamId':None,
             'enabled':None,'sourceMode':None,'sourceUrls':None,'automatedSentiment':None,
             'userOverriddenSentiment':9.5,'isOverrideActive':True,'observationCount':0},
            {'id':7,'graphId':'problem','name':'Problem','labels':['Problem'],'streamId':'S1',
             'enabled':None,'sourceMode':None,'sourceUrls':None,'automatedSentiment':4.5,
             'userOverriddenSentiment':None,'isOverrideActive':False,'observationCount':2},
        ]
        with patch.object(signals,'query',return_value=rows):
            result=signals.flatten('T1')
        self.assertEqual(len(result),3)
        self.assertTrue(result[2]['effectiveEnabled'])
        self.assertEqual(result[2]['effectiveSourceUrls'],['https://example.org/a'])
        self.assertEqual(result[1]['effectiveScore'],9.5)
        self.assertEqual(result[1]['effectiveSource'],'manual_override')
        self.assertEqual(result[2]['effectiveScore'],4.5)

    def test_node_override_has_audited_conditional_aggregate(self):
        session=MagicMock();session.__enter__.return_value=session
        tx=MagicMock();tx.run.return_value.single.return_value={'id':'T1'}
        session.execute_write.side_effect=lambda fn:fn(tx)
        db=MagicMock();db.session.return_value=session
        with patch.object(signals,'require_admin',return_value={'id':'admin'}), \
             patch.object(signals,'accessible'),patch.object(signals,'driver',return_value=db):
            signals.override('T1','target','T1',signals.OverrideInput(active=False),MagicMock())
        self.assertEqual(tx.run.call_count,2)
        cypher=tx.run.call_args.args[0]
        self.assertIn('coalesce(n.isOverrideActive,false)=false',cypher)
        self.assertIn("reviewStatus:'reviewed'",cypher)
        self.assertIn("factor:'overall'",cypher)

    def test_factor_social_query_requires_review_and_target_scope(self):
        with patch.object(signals,'accessible'),patch.object(signals,'query',side_effect=[
            [{'solutionId':'S','problemIds':[7]}],
            [{'problemId':7,'factor':'impact','score':7,'url':'https://example.org/a',
              'title':'Discussion','summary':'Users report an unmet need'}]
        ]) as query,patch('app.targets.me',return_value='user1'):
            result=signals.concept_social_factors('T1','S')
        self.assertEqual(result['factors'][0]['score'],7)
        self.assertIn("reviewStatus:'reviewed'",query.call_args.args[0])
        self.assertIn('metric:',query.call_args.args[0])
        self.assertEqual(query.call_args.kwargs['tid'],'T1')

if __name__=='__main__':unittest.main()
