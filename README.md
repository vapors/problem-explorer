# Problem Explorer v0.8.0 — Immersive Network Workspace

**Local upgrade candidate. Not deployed to production.**

Problem Explorer remains one integrated, target-scoped research platform. v0.8 replaces the persistent sidebar/Cytoscape split view with a full-viewport amCharts 5 force-directed ontology. Every existing workflow now opens as a floating, draggable, resizable, collapsible panel. A light/dark monochrome theme persists per browser.

## Preserved functionality and data isolation

- **Neo4j Community** owns Targets, Streams, Categories, Problems, Findings, source relationships, concept drafts, saved concepts, matches and evaluations. No graph data was moved to SQLite.
- **SQLite** (`apps/api/data/auth.sqlite3`, overridable by `AUTH_DB_PATH`) retains authentication, Google SSO, usage allowances and indexing-job state.
- All original target-scoped endpoints for research, discovery, taxonomy, concept generation, matching, evaluation, admin, directory, ownership and sharing remain in place.
- Shared Targets remain read-only; copying makes an independently editable structural clone. The copy does not duplicate findings, runs, embeddings or concepts.
- Background embedding jobs and daily AI request allowances remain governed by the API. No database reset or migration is performed by this release.
- This release adds a read-only, target-authorized `GET /api/targets/{tid}/amcharts-tree` endpoint. It uses Neo4j `elementId()` for renderer keys and lateral `crossLinks`; each Problem also carries the existing numeric `recordId` for CRUD/detail endpoint compatibility.

## Local setup (Windows)

1. Preserve the existing root `.env`, installed Neo4j Community, **Python 3.12** venv at `apps/api/.venv/`, SQLite data and graph data.
2. Copy source files over the existing checkout **without deleting** `.env`, `.venv`, `apps/api/data/` or other persistent user data.
3. **Run npm locally from `apps/web/`**, not globally and not from a CDN:

   ```powershell
   cd C:\Projects\problem-explorer\apps\web
   npm install @amcharts/amcharts5
   npm install react-rnd
   npm run build
   ```

   The ZIP does not include `node_modules` or a regenerated npm lockfile because the npm registry was inaccessible in the packaging environment. The first `npm install` creates `package-lock.json` using real resolved package metadata; keep that generated lockfile in source control for subsequent `npm ci` builds. Do **not** reuse the v0.7.0 package lock with the new manifest.

4. Run `start-dev.cmd` as before. It uses `apps/api/.venv/Scripts/python.exe`, not system Python 3.14. The existing `requests` dependency remains in `apps/api/requirements.txt` for Google identity transport.
5. Verify the target picker, nested drill-down, problem modal and every research workflow. If live Neo4j or authentication fails, check the existing local settings rather than resetting data.

## UI controls

- Drag a panel by its title bar only; forms, tables and editable text do not initiate dragging.
- Resize from the edges; collapse via the up chevron; close and reopen from **Workspaces** or its navigation entries.
- **Overview** returns the target summary and searchable problem list; the reset-layout icon restores default panel coordinates.
- Single-click on a Target, Stream or Category uses native hierarchy expand/collapse; clicking a Problem opens its detail modal. Source links and concept/research actions remain available there.
- The theme icon toggles the exact light/dark monotone palette; pan/zoom controls live on the graph canvas.

## Validation status

- Python compilation and all **11 offline API contract tests** pass.
- All three TSX components parse with the TypeScript parser.
- **Frontend typechecking/build, live Neo4j Cypher integration and end-to-end browser interactions were NOT validated here:** the npm registry was unreachable and there is no live database or configured local application in this sandbox.
- Do not deploy to production before `npm run build` passes on the actual installation and shared/read-only, workflow and cross-link tests pass with Neo4j.

See `RELEASE-v0.8.0-NETWORK-WORKSPACE.md` for the changed-file map, acceptance checklist and rollback plan.

## Reset and 498-problem reference seed (destructive)

**Never run this against production as a casual update.** It deletes *all Neo4j nodes*, including old research and users' graph data. It also deletes registered accounts, sessions, usage counters and embedding jobs in the configured authentication SQLite database. Your `.env`, Neo4j server installation, and source CSV are retained. The command automatically makes a timestamped SQLite snapshot; **back up Neo4j separately** before running. Stop FastAPI before resetting; leave Neo4j running.

From `apps/api` using the real virtual environment:

```powershell
.\.venv\Scripts\python.exe -m app.bootstrap --reset-all --confirm DELETE-ALL-RESEARCH-AND-USERS
```

On an **empty Neo4j database**, seed only the original reference without resetting users:

```powershell
.\.venv\Scripts\python.exe -m app.bootstrap --seed-reference
```

The seed operation refuses to reseed if `reference-longevity` already exists. At startup, `AUTO_SEED` is intentionally ignored—there are no implicit destructive operations.

### First administrator

After starting FastAPI, register your own account normally, then stop or leave the server online and run from `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m app.bootstrap --promote-email YOUR_REGISTERED_EMAIL
```

Sign out and sign back in to see **Administration**. For future accounts, change roles and daily AI limits inside the admin UI.

## Production safeguards

The existing DirectAdmin VPS uses `/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer/`, `problem-explorer.service` on port 8181, a native Neo4j service, and Nginx/Apache reverse proxying. **Do not deploy this candidate over your functioning v0.7.0 production server before successful local build and integration tests.** See `deploy/directadmin/README.md` for the **native Ubuntu 24.04 / DirectAdmin / systemd / Neo4j deployment runbook**, and `RELEASE-v0.8.0-NETWORK-WORKSPACE.md` for the v0.8 test matrix.

Set `AUTH_SECURE_COOKIE=true` and both `CORS_ORIGINS` and `PUBLIC_ORIGINS` to `https://explorer.pixelandpiece.com` for production. Keep `AUTH_DB_PATH` an absolute persistent path. Set a correct `DATA_FILE` location for the 498-problem CSV. Do not deploy `.env` or SQLite/Neo4j databases with source.

## Further validation

From the project root run `apps/api/.venv/Scripts/python.exe -m unittest discover -s tests -v` (Windows) or the corresponding Python 3.12 interpreter. Run `npm run build` from `apps/web` after npm installs the new packages. On production staging, always run both sets of checks before service cutover.
