# Local installation & upgrades — Windows

Base directory: `C:\Projects\problem-explorer` (the scripts discover their own root, so other paths are fine). Frontend is React/TypeScript/Vite, API is FastAPI in Python 3.12, and research is a **separate local Neo4j Community** instance. Do not use the VPS's production databases or credentials locally.

## Prerequisites

- Windows PowerShell 5.1 or PowerShell 7; Python **3.12** and `py.exe`; supported Node.js + npm.
- Neo4j Community listening locally at `bolt://127.0.0.1:7687` with an independent local password.
- `start-dev.cmd` currently expects native Neo4j at `C:\Tools\neo4j-community-2026.10.0`. Adjust its `NEO4J` variable if installed elsewhere; the helper only launches Neo4j when port 7687 is not already listening.

## Initial local install

Extract the release into `C:\Projects\problem-explorer`, preserving `apps/`, `deploy/`, `docs/`, and `scripts/`. Then run PowerShell from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

It creates `apps/api/.venv` **using Python 3.12 only**, installs Python dependencies into that venv (including `requests`), installs frontend npm packages locally inside `apps/web`, and runs the full TypeScript/Vite build. It creates `.env` from `.env.example` **only if one does not exist**. It will not overwrite settings or touch databases.

Edit the **local** `.env` with Neo4j's local password, local-only OpenAI key if used, and the local `DATA_FILE` path. Confirm `AUTH_DB_PATH=./data/auth.sqlite3` resolves relative to `apps/api` as intended. Keep `PUBLIC_ORIGINS` and `CORS_ORIGINS` on localhost (the Vite dev server defaults to port 5173).

Start the application by double-clicking `start-dev.cmd`, or run it from a Command Prompt. Verify `http://127.0.0.1:8000/api/health` and then open `http://localhost:5173`.

**Seeding:** Nothing in the setup scripts runs `app.bootstrap --reset-all` or reseeds Neo4j. Only initialize a *new and empty* local database deliberately using your existing bootstrap tools; do not reset an established workspace when upgrading.

## Each new local release

1. Back up your working source and local `.env`, SQLite database and Neo4j before any manual data changes.
2. Replace reviewed **source files only**. Do not extract a release over your local `.env`, `apps/api/data`, `.venv` or `node_modules` without excluding those paths.
3. Run `scripts/setup-local.ps1` to reconcile packages, then `scripts/test-local.ps1` for offline contracts and a production frontend build.
4. Launch `start-dev.cmd`. Check Google sign-in, target access, graph details, problem research, concepts and evaluation against local data.
5. Keep the generated `apps/web/package-lock.json` in version control for reproducible `npm ci` installs. The v0.8.1 archive shipped without a lockfile.

## Typical tests

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-local.ps1
```

Offline API tests do not exercise live Neo4j authorization or web UI behavior; run those separately before publishing. Local builds use installed npm dependencies, not public runtime CDNs.
<<<<<<< HEAD

## v0.9.1 evaluation worker

A second SQLite-backed worker starts in the existing FastAPI **one-worker** process; no Celery or Redis installation is required. Start the same `start-dev.cmd` and use the normal `apps/api/.venv` Python 3.12 environment. The New Target wizard and evaluated concept histories are target-scoped. RSS/Atom collection is disabled until you explicitly allowlist a lawful, approved feed host in the *local* `.env`.


## v0.9.2 presentation lenses

`apps/web/src/types/terminology.ts` defines Classic and optional lens overrides; `apps/web/src/contexts/TerminologyContext.tsx` supplies the active lens. In `apps/web`, run `npm run test:lenses`, then `npm run build`. No backend migrations are needed. Switching lenses only changes UI wording.

## v0.9.3 — graph regression

From `apps/web`, run `npm run test:lenses`, `npm run test:graph`, then `npm run build`. The new graph preferences tables are initialized in the existing SQLite database during FastAPI startup; no manual migration is required. Switching lenses or color palettes must not dispose the chart root.

### v0.9.6 onboarding regression

From `apps/web`, run `npm run test:onboarding` followed by `npm run build`. For browser testing, select each of the four lenses, create a test Target, generate two or more stream taxonomies, review collapsed categories, and confirm saving Next does not duplicate previously completed streams.

### v0.9.7 Workspace & Research UX

From `apps/web`, run `npm run test:research-ux`, all previous contract tests and `npm run build`. The status/counter backend regressions run under `python -m unittest discover -s tests`. Confirm lens-specific wizard prompts, Skip/Save semantics, live review counts, rejected recovery and problem-origin concept display in a real browser.


### v0.9.8 Graph and Studio UX tests

In `apps/web`, run `npm run test:graph-intelligence` and `npm run test:badge-layout` alongside existing checks, then `npm run build`. On the API side run `python -m unittest discover -s tests -v` from repository root with the API in `PYTHONPATH` and active venv. Test concept rejection, restoration and graph hierarchy counts against local Neo4j with two accounts.
=======
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
