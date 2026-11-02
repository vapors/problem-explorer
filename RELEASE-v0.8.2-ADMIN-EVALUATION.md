# Problem Explorer v0.8.2 — administration and concept evaluation

## Implemented

- Administrator-only Target inventory (`GET /api/admin/targets`) shows owners, privacy, structural counts and protected reference status.
- Administrator deletion (`DELETE /api/admin/targets/{tid}`) requires an explicit body containing the exact target ID and current display name; double-confirmed in the UI. Never deletes the system reference target.
- Existing owner deletion now shares an atomic Neo4j transaction. It deletes target-scoped artifacts and hierarchy descendants together, including older taxonomy nodes without `targetId`, while preserving the unrelated shared Source nodes and counters.
- Concept assessment supports `mode=evidence|exploratory`; both paths return the five existing factors and retain persistent evaluation history. Inference is labeled, with explicit assumptions, and unrated factors remain null.
- Evidence mode passes only account-reviewed findings to the evaluator. Model-generated citations are reconciled to supplied source URLs. Unsourced empirical ratings are nulled.
- Migrated the concept radar from Recharts to amCharts 5; radar code is dynamically loaded when its floating panel opens. If fewer than three factors have scores, the UI presents an explicit insufficient-data state instead of an invented polygon. No unknown score is plotted as zero.
- UI has an optional separate social discussion layer control. It is disabled until source-attributed, factor-specific signals exist; no simulated data, polling, scraping, AI sentiment pipeline or new Neo4j sentiment properties in v0.8.2.
- Version metadata and docs deployed with the same existing DirectAdmin permissions-safe toolkit and its rollback flow.

## Compatibility

- Existing endpoints, graph contract, Neo4j hierarchy, SQLite state and AI quota middleware retained.
- No database migrations, reset, reseed, credentials changes, production server modifications, additional backend dependencies or new npm packages required.
- Old evaluations load with `mode` absent and are labeled **legacy provisional / methodology unverified** rather than evidence-based; they are not silently recast as validated scores.
- Shared targets remain read-only; administrator deletion is a separate explicitly authorized action.

## Validation

Run `PYTHONPATH=apps/api python -m unittest discover -s tests -v` and locally in `apps/web` run `npm install && npm run build`. The deployment script performs both checks under the existing `siteadmin` account before publishing. On staging, confirm admin target inventory, reference protection, two-user isolation, evidence/exploratory evaluation, source URL validation, radar empty-state, old saved evaluations, and public login/health.

Do **not** run `app.bootstrap --reset-all`, seed reference data, or overwrite production `.env`, Neo4j or the SQLite auth store. Deleting user targets is permanent; confirm an independent Neo4j backup before admin deletion. Code rollback does not reverse data deletion.

## Upcoming releases (not implemented here)

- v0.9.0: targeted social-signal configuration, separate sentiment observations in Neo4j, source inheritance, governance, operator overrides, and in-place amCharts bubble signal updates.
- v0.9.1: durable multistage quantitative/qualitative agent evaluation, source-compliant collection adapters, quotas, traceable synthesis, and historical comparisons. Keep evidence, assumptions and sampled public discussion distinct.
