"""v0.9.5: Target publication, lens recommendations and reference protection.

These are isolated contract tests; live Neo4j/permissions require staging checks.
"""
import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from app import admin, targets


class TargetPublicationTests(unittest.TestCase):
    def test_default_selection_uses_active_lens_then_general_fallback(self):
        library=[
            {'id':'reference-longevity','name':'Longevity','featured':False,'featuredLenses':['industrial_design']},
            {'id':'engineering-default','name':'Engineering','featured':False,'featuredLenses':['technical_engineering']},
            {'id':'general-default','name':'General','featured':True,'featuredLenses':[]},
        ]
        with patch.object(targets,'me',return_value='reader'),patch.object(targets,'query',side_effect=[[],library]) as q:
            result=targets.directory('industrial_design')
        self.assertEqual(result['defaultTargetId'],'reference-longevity')
        self.assertIn('coalesce(t.directoryVisible,true)=true',q.call_args_list[1].args[0])
        self.assertIn('t.ownerId<>$owner',q.call_args_list[1].args[0])
        with patch.object(targets,'me',return_value='reader'),patch.object(targets,'query',side_effect=[[],library]):
            result=targets.directory('unknown_lens')
        self.assertEqual(result['defaultTargetId'],'general-default')
        self.assertEqual(result['lens'],'classic')

    def test_no_forced_default_without_featured_target(self):
        with patch.object(targets,'me',return_value='u'),patch.object(targets,'query',side_effect=[[],[{'id':'t1','featured':False,'featuredLenses':[]}]]):
            self.assertIsNone(targets.directory('classic')['defaultTargetId'])

    def test_admin_only_publication(self):
        with patch.object(admin,'require_admin',side_effect=HTTPException(403,'Denied')),patch.object(admin,'driver') as db:
            with self.assertRaises(HTTPException):
                admin.update_target_publication('target',admin.TargetPublicationUpdate(listed=False),MagicMock())
            db.assert_not_called()

    def test_unknown_lens_rejected_before_neo4j(self):
        with patch.object(admin,'require_admin'),patch.object(admin,'driver') as db:
            with self.assertRaises(HTTPException) as err:
                admin.update_target_publication('target',admin.TargetPublicationUpdate(featuredLenses=['arbitrary']),MagicMock())
            self.assertEqual(err.exception.status_code,422)
            db.assert_not_called()

    def _run_admin_patch(self,target_data,changes):
        statements=[]
        tx=MagicMock()
        def run(statement,**params):
            statements.append((statement,params))
            result=MagicMock()
            if 'RETURN t.id AS id,t.ownerId' in statement:
                result.single.return_value=target_data
            return result
        tx.run.side_effect=run
        session=MagicMock();session.__enter__.return_value=session
        session.execute_write.side_effect=lambda fn:fn(tx)
        db=MagicMock();db.session.return_value=session
        with patch.object(admin,'require_admin',return_value={'id':'administrator'}),patch.object(admin,'driver',return_value=db):
            result=admin.update_target_publication('reference-longevity',admin.TargetPublicationUpdate(**changes),MagicMock())
        session.execute_write.assert_called_once()
        return result,statements

    def test_reference_target_may_be_hidden_without_becoming_deletable(self):
        target={'id':'reference-longevity','ownerId':'__system__','shared':True,'listed':True,
                'featured':True,'featuredLenses':['classic'],'reference':True}
        result,statements=self._run_admin_patch(target,{'listed':False})
        self.assertTrue(result['reference'])
        self.assertFalse(result['listed'])
        self.assertFalse(result['featured'])
        self.assertEqual(result['featuredLenses'],[])
        self.assertEqual(statements[-1][1]['shared'],True)
        self.assertIn('directoryVisible',statements[-1][0])
        self.assertNotIn('DETACH DELETE',repr(statements))

    def test_reference_target_can_be_made_private_without_deleting_research(self):
        target={'id':'reference-longevity','ownerId':'__system__','shared':True,'listed':True,
                'featured':False,'featuredLenses':['industrial_design'],'reference':True}
        result,statements=self._run_admin_patch(target,{'shared':False})
        self.assertFalse(result['shared']);self.assertFalse(result['listed'])
        self.assertFalse(result['featured']);self.assertEqual(result['featuredLenses'],[])
        self.assertTrue(result['reference'])
        self.assertNotIn('DETACH DELETE',repr(statements))

    def test_one_target_per_lens_assignment_and_preserve_global_featured(self):
        target={'id':'reference-longevity','ownerId':'__system__','shared':True,'listed':True,
                'featured':True,'featuredLenses':[],'reference':True}
        result,statements=self._run_admin_patch(target,{'featuredLenses':['technical_engineering','industrial_design']})
        self.assertEqual(result['featuredLenses'],['technical_engineering','industrial_design'])
        self.assertTrue(result['featured'])
        clears=[(q,p) for q,p in statements if 'SET other.featuredLenses=' in q]
        self.assertEqual({p['lens'] for _,p in clears},{'industrial_design','technical_engineering'})
        self.assertEqual(statements[-1][1]['lenses'],['technical_engineering','industrial_design'])

    def test_admin_cannot_publish_someone_elses_private_workspace(self):
        item={'id':'T-private','ownerId':'other-user','shared':False,'listed':False,
              'featured':False,'featuredLenses':[],'reference':False}
        with self.assertRaises(HTTPException) as err:
            self._run_admin_patch(item,{'shared':True})
        self.assertEqual(err.exception.status_code,403)

    def test_admin_may_publish_their_own_private_workspace(self):
        item={'id':'T-own','ownerId':'administrator','shared':False,'listed':False,
              'featured':False,'featuredLenses':[],'reference':False}
        result,statements=self._run_admin_patch(item,{'shared':True})
        self.assertTrue(result['shared'])
        self.assertFalse(result['listed'])  # Listing remains an explicit decision.
        self.assertNotIn('DETACH DELETE',repr(statements))

    def test_owner_unshare_clears_publication_flags(self):
        with patch.object(targets,'accessible'),patch.object(targets,'me',return_value='owner'),patch.object(targets,'execute') as execute:
            targets.update_target('T1',targets.TargetInput(name='Research',description='',shared=False))
        statement=execute.call_args.args[0]
        self.assertIn('t.directoryVisible=false',statement)
        self.assertIn('t.featuredLenses=[]',statement)
        self.assertIn('t.featured=false',statement)

if __name__=='__main__': unittest.main()
