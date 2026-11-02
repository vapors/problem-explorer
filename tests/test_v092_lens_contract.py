"""Offline deployment guardrails for UI-only v0.9.2 lens foundation.

No Node/npm runtime is needed to execute Python backend contract tests. The
strict TypeScript vocabulary checks run independently via `npm run test:lenses`.
"""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / 'apps' / 'web' / 'src'


class LensFoundationContracts(unittest.TestCase):
    def test_registry_fallback_has_no_database_side_effect(self):
        src = (WEB / 'types' / 'terminology.ts').read_text(encoding='utf-8')
        self.assertIn("id:'classic'", src)
        self.assertIn('CLASSIC_ENTITIES', src)
        self.assertIn('CLASSIC_MESSAGES', src)
        self.assertIn('lens.messages?.[key]??CLASSIC_MESSAGES[key]', src)
        self.assertNotIn('fetch(', src)

    def test_wizard_is_three_phase_and_reuses_existing_routes(self):
        src = (WEB / 'NewTargetWizard.tsx').read_text(encoding='utf-8')
        self.assertIn("'name'|'focus'|'investigate'", src)
        for route in ['/targets/suggest-streams', '/with-streams', '/seed-preview', '/taxonomy']:
            self.assertIn(route, src)
        self.assertIn('name,description:scope,shared,streams:chosen', src)
        self.assertIn("setPhase('investigate')", src)

    def test_graph_initialization_independent_of_lens(self):
        src = (WEB / 'NetworkCanvas.tsx').read_text(encoding='utf-8')
        self.assertIn('},[targetId,refreshKey,resetSequence]);', src)
        self.assertNotIn('},[targetId,refreshKey,theme]);', src)
        self.assertIn('useTerminology()', src)
        self.assertIn('series.data.setAll', src)
        self.assertNotIn('[targetId, refreshKey, theme, lensId]', src)

    def test_account_preference_not_in_research_schema(self):
        ctx = (WEB / 'contexts' / 'TerminologyContext.tsx').read_text(encoding='utf-8')
        main = (WEB / 'main.tsx').read_text(encoding='utf-8')
        self.assertIn('problem-explorer:lens:${preferenceKey}', ctx)
        self.assertIn('preferenceKey={account.id}', main)
        self.assertIn('<NetworkCanvas targetId=', main)
        self.assertNotIn('key={lensId}', main)

    def test_five_evaluation_factors_unchanged(self):
        chart = (WEB / 'EvaluationRadar.tsx').read_text(encoding='utf-8')
        for factor in ['desirability', 'feasibility', 'viability', 'impact', 'coverage']:
            self.assertIn("'" + factor + "'", chart)
        self.assertIn('sourceCount>0', chart)
        self.assertIn('tenPoint(', chart)

    def test_release_metadata_and_non_destructive_deployment(self):
        release = (ROOT / 'deploy' / 'release.env').read_text(encoding='utf-8')
        web_version = __import__('json').loads((WEB.parent / 'package.json').read_text(encoding='utf-8'))['version']
        self.assertIn(f'RELEASE_VERSION={web_version}', release)
        script = (ROOT / 'deploy' / 'directadmin' / 'deploy.sh').read_text(encoding='utf-8')
        self.assertIn('npm run test:lenses', script)
        self.assertIn('npm run build', script)
        self.assertNotIn('--reset-all', script)
        self.assertIn('pe_rsync_source', script)


if __name__ == '__main__':
    unittest.main()
