# v0.7.0 — Full target-scoped integration (local candidate)

## Integration decision

Instead of a compatibility toggle between two UIs, v0.7 has one React root component and one authenticated, target-scoped FastAPI API. The v0.5 legacy graph endpoints are **not mounted**, removing the path by which actions could inadvertently use the wrong target.

| Workflow | Route family | Model |
|---|---|---|
| Target directory and sharing | `/api/targets` | Target |
| Hierarchy graph | `/api/targets/{tid}/graph`, `/expand/{node_id}` | Target→Stream→Category→Problem→Finding |
| Hierarchy editing | `/api/targets/{tid}/streams/...`, `/categories/...`, `/problems/...` | Target-owned |
| AI taxonomy previews | `/api/targets/{tid}/streams/{sid}/seed-preview` | Preview only; save explicitly |
| Problem research | `/api/targets/{tid}/problems/{pid}/research` | ResearchRun, Finding, Source |
| Problem discovery | `/api/targets/{tid}/discoveries/...` | Discovery→approved Problem |
| Concept generation | `/api/targets/{tid}/problems/{pid}/concepts/...` | ConceptBatch, ConceptDraft |
| Concepts and matching | `/api/targets/{tid}/solutions/...` | Solution→ADDRESSES→Problem |
| Analysis | `/api/targets/{tid}/solutions/{sid}/evaluate` | Evaluation→Solution |
| Search / indexing | `/api/targets/{tid}/search`, `/index/...` | target-scoped, quota-accounted |
| Administration | `/api/admin/...` | SQLite accounts, usage and queue |

Read-only shared targets have their hierarchy and data visible but cannot be modified. The copy action creates separate target, stream, category and problem nodes with new unique identifiers, assigned to the user; source data is not mutated. Edits and AI operations are checked against target ownership before work starts.

## Important changes since v0.6.2

- Removed the temporary legacy research-mode switch and old global graph/research routes.
- Created one consistent left navigation for graph, problems, research, discovery, concepts, matching, evaluation, target management, directory, and administration.
- Made research topics arbitrary rather than requiring original streams `S1`–`S4`.
- Converted the source dataset into an explicitly shared `reference-longevity` Target.
- Prevented creating an empty target from the wizard.
- Added editable taxonomy previews and research statement / concept draft review.
- Added scoped finding review statuses and user-controlled AI allowances.
- Added `requests` to backend requirements for Google OAuth transport.
- Made `reset-all` a separate, confirmation-gated command that does not run on API startup.

## Windows local validation checklist

1. Copy the ZIP to a separate test directory or back up the current `C:\Projects\problem-explorer` tree. Keep `.env` intact.
2. Run backend `python -m pip install -r requirements.txt`, frontend `npm ci`, then `npm run build`.
3. Stop FastAPI, back up Neo4j and SQLite, then run the reset command in the README **only in the intended disposable environment**.
4. Start services; check `/api/health` (expected: `targets: 1`) and Neo4j counts for the reference Target (`498` problems, `4` streams).
5. Register two accounts, A and B. Promote A using `--promote-email`.
6. Open the shared Longevity reference graph, expand stream → category → problems, and open a problem record.
7. As A, copy the reference target into an editable personal workspace; confirm the graph contains streams/categories/problems. As B, confirm the copy is not visible unless shared.
8. As A, create another target via wizard; request AI stream suggestions, edit selections, save. Confirm center target and selected stream nodes immediately appear.
9. On the new target, create a category, manually add a problem, edit and delete it; generate taxonomy preview, edit, save, expand graph.
10. Research a problem; inspect source links, review/reject a finding; generate concept drafts, edit and save one, match the concept, generate evaluation.
11. Run a discovery search against the selected target and approve/reject a candidate. Confirm no candidate is added before approval.
12. In Admin, disable user B; their active session and API access should be denied. Re-enable and modify daily AI allowance.
13. Verify API isolation: attempts by B to modify A's unshared target and to access its problems, findings, solutions and evaluations must return `404`/`403`; test both UI and direct API requests.
14. Set one user's AI limit to `0`; all AI-backed operations should return `429` but ordinary problem browsing and manual editing should continue.
15. Confirm embedding jobs are asynchronous, limited to the correct target, and continue after FastAPI restarts. A single Uvicorn worker is supported in this version.

## Critical release gates NOT VERIFIED in this build environment

- `npm run build` with dependencies installed (the npm registry is inaccessible here).
- End-to-end graph traversal / Cypher against Neo4j 2026.10 Community.
- Real Google OAuth callback on localhost and production origin.
- OpenAI web search / structured extraction / embeddings via live credentials.
- Concurrent access, transaction retry performance (especially copying 498 problems).
- Linux systemd startup and DirectAdmin/Nginx routing.

**Do not treat the absence of exceptions during syntax checks as proof the application is production-ready.**

## Production cutover (after local gates pass)

**Use the native, non-Docker VPS runbook at `deploy/directadmin/README.md` for concrete siteadmin/root commands, Neo4j offline backup, the existing systemd service, controlled reset, static publishing, and rollback.** The overview below is a summary and does not replace that runbook.

1. Make a filesystem backup of the existing deployed source, frontend assets, SQLite database and `.env`; separately back up Neo4j.
2. Stage the v0.7 source outside the live directory and run `pip install -r requirements.txt`, `npm ci` and `npm run build` in staging.
3. Check production `.env`: retain actual secrets, set `AUTH_DB_PATH` to a persistent absolute path, `AUTH_SECURE_COOKIE=true`, `PUBLIC_ORIGINS=https://explorer.pixelandpiece.com`, `CORS_ORIGINS=https://explorer.pixelandpiece.com`, `DATA_FILE` to the deployed CSV path.
4. Only with explicit intent to discard existing data, stop `problem-explorer.service`, leave Neo4j running and run the confirmed `--reset-all` script from the newly staged `apps/api`. This is irreversible without the backups.
5. Copy tested source and built frontend to the established DirectAdmin application and `public_html` locations; preserve server-specific configs. Start the service and check logs.
6. Register the first production user; promote via `python -m app.bootstrap --promote-email ADDRESS`.
7. Check HTTPS registration, `/api/health`, read-only shared reference, editable copy, research, quota and admin access before inviting users.
8. **Rollback:** restore both the old code/assets and its matching Neo4j + SQLite backups. Restoring only code after destructive reset cannot restore old data.

## Known limitations for the next release

- Search and ranking use target-scoped lexical matching and optional semantic embeddings; the vector index is global but results are target-filtered, which may reduce recall for tiny targets in a large database.
- Source verification remains a human-review operation; a user marking a finding reviewed does not independently verify the URL's assertions.
- Background embeddings use one in-process worker, not a distributed queue; do not run multiple Uvicorn workers against the same queue.
- The frontend still uses Cytoscape, not amCharts. A renderer experiment can follow functional validation.
- Concept versioning, collaborative editing, billing and token-accurate metering are out of scope for v0.7.
