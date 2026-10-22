# Problem Explorer v0.6.1 — Sidebar Workspace / Target Wizard (LOCAL TEST CANDIDATE)

**Do not deploy to the production VPS yet.** This is a focused working-source candidate, not an end-to-end validated release.

## What changed

- Restores left-hand navigation as the default after login. No target is selected until the user chooses one; the graph shows an empty central node instead of the legacy dataset automatically.
- New users see an overlay to create a target. The wizard asks for a target name, scope, and outline/standard/detailed stream suggestion count. The AI suggestion call is explicit, metered through the existing daily AI allowance, and editable before saving. You can manually add streams as well.
- `POST /api/targets/with-streams` writes a target and its reviewed streams in one Neo4j query, so the graph can display a center and stream children immediately.
- Shared-target directory can open the original longevity reference graph and all user-shared targets without automatically copying them.
- `POST /api/targets/{id}/copy` clones target, stream, category, and problem nodes into the signed-in user's private editable hierarchy using a Neo4j write transaction. It does NOT clone research findings or AI-generated concepts; such provenance is deliberately not misrepresented as independently verified.
- Admin UI and per-user quota code retained from v0.6.0.
- Cytoscape is retained for this candidate. amCharts evaluation can follow after graph loading and ownership are verified.

## Local install

1. Back up the previous source, `.env`, SQLite authentication database, and Neo4j data.
2. Extract into a new working directory or overlay application source files **without replacing `.env` or either database**.
3. In `apps/web`: `npm ci` and `npm run build`; resolve any package installation issues before proceeding.
4. In `apps/api`: use the existing virtualenv to install `requirements.txt`; run Python syntax checks.
5. Keep `AUTO_SEED=false`, start local services with `start-dev.cmd`.

## Required tests (not yet executed against live Neo4j)

1. Open app with a new account: original left nav visible, create-target modal opens, no implicit legacy graph.
2. Create target with manually added stream and with AI-selected streams: graph shows target center plus newly created stream nodes.
3. Open the reference longevity library from the left nav: streams visible; expand categories and problem statements.
4. Copy library into workspace: cloned streams/categories/problems visible; modifications to copied records do not modify shared original data.
5. With another account, confirm private target is invisible and private graph and problem detail endpoints cannot be accessed via URL/API.
6. Test empty and populated shared targets and administrator quotas.
7. Test transactional rollback using an invalid clone request, verify no orphan new target.
8. Confirm existing production data and `AUTO_SEED=false` remain unchanged.

## Known limitations

- TypeScript/Vite build did not complete in the packaging environment because `npm ci` produced incomplete `node_modules` typings. No passing frontend build is claimed.
- No real Neo4j integration test was possible here; copying hundreds of problem records needs staging verification before production use.
- The original research, discovery and solution-generation endpoints from v0.5 still need a comprehensive target-scoped authorization migration. Do **not** expose those workflows as target-aware until that work passes tests.
- Copying does not duplicate evidence, linked findings, solution batches or embeddings. Copied problems need their own research/embedding lifecycle.
- Single-process background indexing continues to be an existing limitation.

## Rollback

Stop the local services; restore previous application code, retaining both persistent databases and `.env`. This candidate contains no required destructive schema migration.
