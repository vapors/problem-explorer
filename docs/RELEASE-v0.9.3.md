# Problem Explorer v0.9.3 — Graph Continuity & Visual Semantics

**Source baseline:** v0.9.2 Lens Framework. **Release type:** incremental and non-destructive. **Deploy user:** siteadmin through the existing root-safe DirectAdmin scripts.

## Behavior and contracts

### Per-account persisted view state

The frontend fetches and debounces authenticated `GET`/`PUT /api/targets/{tid}/graph-view` requests. The view payload is versioned (`version: 1`) and includes stable-key `expanded` branch IDs, optional `focused` node key, camera zoom and translation, and social-signal visibility. A browser close/pagehide attempts a final save using `keepalive`; ordinary interactions save after a delay. Returning to a Target loads its last view. The explicit Reset View control clears this saved state and reconstructs the initial presentation.

`user_graph_views` is an additive SQLite table with a `(user_id,target_id)` primary key. Both reads and writes are subject to the existing Target visibility check; the user ID comes from the server-side authenticated session, never a request parameter. Shared-target viewers keep independent view settings. Deleting or moving branches safely ignores stale IDs when restoring. Exact force-simulation coordinates are *not* persisted.

### Concepts as presentation attachments

`GET /api/targets/{tid}/amcharts-tree` retains the canonical Target/Stream/Category/Problem structure and Neo4j `elementId` chart link keys. The response now includes durable `stableKey` fields mapped from application IDs; each `Problem` can have `concept` presentation children if its owner-scoped `Solution` has an explicit `(Solution)-[:INSPIRED_BY]->(Problem)` relation in the selected Target. The existing `RELATED_TO`/`CAUSES`/`SUPPORTED_BY` cross-links remain problem-only. This does **not** introduce a structural `CONTAINS` relationship for Concepts. Only the current account's saved concepts appear; draft Concepts and unrelated users' private research do not.

Manual `POST /api/targets/{tid}/solutions` now accepts an **optional** integer `originProblemId`; it is validated inside the authorized Target, and the `INSPIRED_BY` link is created with the Solution in the same Neo4j write. Existing unlinked Concepts remain valid. AI-generated saved Concepts already have `INSPIRED_BY` and remain compatible.

The frontend uses amCharts' `series.addChildData()` on concept saves instead of `refreshTarget()`; it refreshes Concept Studio lists without changing the graph structure key. For a Problem node, the detail workflow includes **Reveal linked concepts on graph**. Clicking a concept node opens its existing Concept panel. Target/tree edits can still request a structural refresh.

### Hierarchy palette

Two suggested dark/light palettes are keyed by the canonical `target`, `stream`, `category`, `problem`, `concept` roles. `GET /api/graph/appearance` is readable to signed-in users; `PUT /api/graph/appearance` checks the actual account role and is admin-only. Configured palettes live in the additive SQLite `graph_appearance` table, not on Neo4j research nodes. Changing colors or switching light/dark/terminology updates chart sprites through adapters/repaint functions; normal changes do not dispose the amCharts root. Social-signal rings retain their independent semantics.

## Deployment

Upload `Problem-Explorer-v0.9.3-Graph-Continuity.zip` to `/home/siteadmin/releases/`, then as root:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.3-Graph-Continuity.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The familiar scripts copy/build as `siteadmin` and preserve `apps/api/.venv`, the live `.env`, SQLite, Neo4j data and DirectAdmin vhosts. The new SQLite tables are created **additively** by FastAPI startup. Never invoke `bootstrap --reset-all`. Existing source, findings, evaluations, matching percentages, and user access are unchanged. Deploy script preserves its rollback snapshot of **code/front-end only**. Independently back up both databases before an upgrade.

## Automated verification

- Backend: `PYTHONPATH=apps/api python -m unittest discover -s tests -v`.
- Frontend: from `apps/web`, `npm install`, `npm run test:lenses`, `npm run test:graph`, `npm run build`.
- Release: Bash `bash -n deploy/directadmin/*.sh` and Python compilation.

The package-authoring environment cannot reach npm registry or production Neo4j; a frontend syntax transpilation check alone is not a full TS typecheck or browser/Neo4j integration verification. The deploy script performs the full frontend build as a **prepublication gate**.

## Browser acceptance checklist

1. Open Target A as user 1. Expand multiple branches, zoom and pan, choose a Problem, leave Target A, return, and confirm approximate camera and expansion state. Sign out/in and repeat. Verify user 2 does **not** inherit user 1's view.
2. Shared read-only Target: verify individual viewers may save their view while they still cannot create or edit graph research. Private Target: verify a different user gets an authorized-access denial on its graph-view routes.
3. Save an AI draft concept from a Problem at nondefault zoom; confirm the node appears via `INSPIRED_BY`, the camera remains stable, and the app doesn't issue a new `GET /amcharts-tree`. Select concept node, open existing Concept workspace. Repeat for manual concept with an explicit origin.
4. Create a manual concept without an origin; verify it remains in Concept Studio and is not arbitrarily attached to any Problem. Confirm historical draft findings, social signals, and `ADDRESSES` matching still work.
5. Configure both dark/light graph colors as admin, switch theme and lens with multiple open branches, verify colors update *without* network reinitialization and the graph remains legible. Confirm a non-admin cannot `PUT /api/graph/appearance`.
6. Use **Reset saved graph view** and confirm default branch state on return. Verify a stale saved branch key does not crash the graph after a structural edit.
7. Check the reference Target (~498 Problems) and a populated private Target for frame rate and node readability. Compare startup/layout against v0.9.2.

## Deferred, separate from this release

The planned concept-matching halo overlay using `ADDRESSES.relevance` percentages is not enabled yet. The percentage remains estimated conceptual fit, not empirical success. Evaluation Profiles, Research Toolkit/MCP mapping, per-user palette customization and complete localization are also separate later releases.
