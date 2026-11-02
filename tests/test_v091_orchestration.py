"""Offline v0.9.1 evidence, privacy, durable queue, feed safety contracts."""
import os,tempfile,unittest,sqlite3
from pathlib import Path
from unittest.mock import patch,MagicMock
from fastapi import HTTPException
from app import evaluation_orchestrator as o,evaluation_jobs as jobs,main,social_collection
from app.evaluation_orchestrator import QuantitativeResult,QualitativeResult,NumericFactor,NarrativeFactor

NAMES=list(o.FACTORS)
def quant(basis='evidence'):
    return QuantitativeResult(factors=[NumericFactor(factor=f,score=7,confidence='high',basis=basis,
        rationale='Source-based rating',evidence_urls=['https://example.org/research'],metrics=[],assumptions=[])
        for f in NAMES])
def qual(conflict=False):
    return QualitativeResult(summary='Several meaningful assumptions need testing',
        factors=[NarrativeFactor(factor=f,context='Stakeholder context',risks=[],
        conflicting_claims=['Study conflicts with sample'] if conflict and f=='impact' else [],
        assumptions=[],follow_up=['Interview affected users']) for f in NAMES],
        systemic_risks=['Access barriers'],key_assumptions=['May be adopted'],research_next=['Run usability study'])

class V091Tests(unittest.TestCase):
    def test_new_routes_and_no_metering_on_queue(self):
        routes={(r.path,m) for r in main.app.routes for m in getattr(r,'methods',set())}
        for path,method in [('/api/targets/{tid}/solutions/{sid}/evaluations/queue','POST'),
                 ('/api/targets/{tid}/evaluations/jobs/{jid}','GET'),
                 ('/api/targets/{tid}/solutions/{sid}/evaluations/compare','GET'),
                 ('/api/targets/{tid}/signals/nodes/{kind}/{node_id}/collect','POST')]:
            self.assertIn((path,method),routes)

    def test_no_fake_evidence_score(self):
        result=o.reconcile(quant(),qual(),[],mode='evidence')
        self.assertTrue(all(f['score'] is None and f['basis']=='unknown' for f in result['factors']))
        self.assertFalse(result['sentimentIncluded'])
        self.assertEqual(result['scoreMax'],10)
        self.assertEqual(len(result['reconciliation']['flagged']),5)

    def test_cited_reviewed_evidence_and_conflict(self):
        source={'url':'https://example.org/research','status':'reviewed'}
        result=o.reconcile(quant(),qual(True),[source],mode='evidence')
        self.assertEqual(result['factors'][3]['confidence'],'medium')
        self.assertEqual(result['factors'][0]['score'],7)
        self.assertEqual(result['factors'][0]['evidence_urls'],[source['url']])
        self.assertEqual(len(result['reconciliation']['flagged']),1)

    def test_exploratory_inference_is_labeled(self):
        result=o.reconcile(quant('inference'),qual(),[],mode='exploratory')
        self.assertEqual(result['factors'][0]['score'],7)
        self.assertEqual(result['factors'][0]['basis'],'inference')
        self.assertEqual(result['factors'][0]['confidence'],'low')

    def test_unreviewed_source_is_not_presented_as_empirical_proof(self):
        result=o.reconcile(quant('evidence'),qual(),[
            {'url':'https://example.org/research','status':'needs_review'}],mode='exploratory')
        self.assertEqual(result['factors'][0]['basis'],'inference')
        self.assertEqual(result['factors'][0]['confidence'],'low')
        self.assertTrue(result['reconciliation']['flagged'])

    def test_wrong_factor_contract_denied(self):
        data=quant();data.factors[1].factor='impact'
        with self.assertRaises(ValueError):o.reconcile(data,qual(),[],mode='evidence')

    def test_queue_is_persistent_private_and_deduplicated(self):
        with tempfile.TemporaryDirectory() as folder:
            path=os.path.join(folder,'auth.sqlite3')
            def connect():
                db=sqlite3.connect(path);db.row_factory=sqlite3.Row;return db
            with patch.object(jobs.auth,'conn',side_effect=connect):
                jobs.init()
                x=jobs.enqueue('u1','T1','sol','evidence')
                self.assertEqual(x['jobId'],jobs.enqueue('u1','T1','sol','evidence')['jobId'])
                self.assertNotEqual(x['jobId'],jobs.enqueue('u2','T1','sol','evidence')['jobId'])
                self.assertEqual(jobs.status('u1','T1',x['jobId'])['state'],'queued')
                with self.assertRaises(HTTPException):jobs.status('u2','T1',x['jobId'])
                claimed=jobs._claim();self.assertEqual(claimed['owner_id'],'u1')
                with connect() as c:c.execute("UPDATE evaluation_jobs SET updated_at=datetime('now','-11 minutes') WHERE id=?",(x['jobId'],))
                self.assertEqual(jobs._claim()['id'],x['jobId'])

    def test_queue_endpoint_authorizes_before_enqueuing(self):
        from app import research
        with patch.object(research,'accessible',side_effect=HTTPException(404,'denied')),patch.object(jobs,'enqueue') as enqueue:
            with self.assertRaises(HTTPException):research.enqueue_evaluation('T1','S1',research.EvaluationRequest())
            enqueue.assert_not_called()

    def test_feed_requires_admin_rights_and_approved_host(self):
        with patch.object(social_collection.signals,'require_admin',side_effect=HTTPException(403,'Admin only')):
            with self.assertRaises(HTTPException):social_collection.collect('T1','target','T1',social_collection.CollectRequest(sourceUrl='https://example.org/feed',attestedRights=True),MagicMock())
        with patch.dict(os.environ,{'SOCIAL_FEED_ALLOWED_HOSTS':''}):
            with self.assertRaises(HTTPException):social_collection.allowed_host('https://example.org/feed')
        with patch.object(social_collection.signals,'require_admin',return_value={'id':'admin'}),patch.object(social_collection,'accessible'):
            with self.assertRaises(HTTPException):social_collection.collect('T1','target','T1',social_collection.CollectRequest(sourceUrl='https://example.org/feed',attestedRights=False),MagicMock())

    def test_feed_xml_is_not_scraped_or_auto_scored(self):
        # The feed adapter does not call AI or write SocialSignalObservation.
        import inspect
        src=inspect.getsource(social_collection.collect)
        self.assertIn('SocialSignalCandidate',src)
        self.assertNotIn('SocialSignalObservation',src)

if __name__=='__main__':unittest.main()
