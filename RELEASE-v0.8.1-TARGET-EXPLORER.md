# Problem Explorer v0.8.1 — Readable Graph & Floating Target Explorer

## Changes from v0.8.0

- The **Target Explorer** is now an independent `react-rnd` window, with the same draggable, resizable, collapsible and close/reopen behavior as the other panels.
- The explorer contains the active target selector, target creation, directory access, a hierarchical tree of streams → categories → problems, search filtering, expand/collapse controls, and problem-detail modal entry points.
- **Target Overview** is now a lightweight overview (scope, metrics, contextual workflow links) rather than a duplicate problem list. The window is initially closed, leaving room for the network and the new explorer. The toolbar can reopen it.
- The Navigation panel remains independently accessible; the graph itself remains the immersive background layer.
- amCharts preview labels use up to **three lines**, with typography and modest bubble sizing based on node type/title. Seed stream prefixes such as `Stream 4 —` and category prefixes such as `4A.` are removed **in visual labels only**. Full original text remains accessible in tooltips; all Neo4j names, IDs and search content remain untouched.
- Added `/api/targets/{tid}/research/activity` for account-scoped research-run and finding counts/history. The Research panel displays saved sessions for the signed-in account and selected Target, helping confirm what persisted and which problem each run belongs to.
- Research run and sourced finding creation are now committed within a single Neo4j write transaction (with an ownership recheck). **No existing research or target data was migrated or reset.**

## Relevant source

- `apps/web/src/TargetExplorer.tsx` — new explorer view using existing `/streams`, `/hierarchy` and `/problems` endpoints.
- `apps/web/src/networkLabels.ts` — pure view-label formatting; no changes to stored names.
- `apps/web/src/FloatingPanel.tsx` — new `targetExplorer` panel layout.
- `apps/web/src/NetworkCanvas.tsx` — multiline label/bubble adapters.
- `apps/web/src/main.tsx`, `apps/web/src/style.css` — toolbar, UI integration and theme-aware explorer styling.
- `apps/api/app/research.py` — research activity and transaction changes.
- `tests/test_api_contract.py` — 13 offline checks including current-user research filtering and single-transaction save.

## Verification performed here

- **Passed:** 13 offline FastAPI/Python contract/unit tests, Python 3.13 test harness (this is NOT a deployment runtime).
- **Passed:** TypeScript's TSX *syntax transpilation* for all five source files (no frontend dependency resolution or type-checking).
- **Passed:** local pure-helper checks for 3-line labels and removal of `Stream 4 —` and `4A.` from UI labels.
- **Not run:** `npm run build`, because this environment cannot resolve `registry.npmjs.org` (`EAI_AGAIN`). The user's local Windows Python 3.12 venv and server venv are unchanged.
- **Not run:** real Neo4j, authenticated browser/Google SSO, live user-isolation, DirectAdmin deployment or visual QA.

## Safe upgrade on the existing DirectAdmin host

**This is an incremental source update, NOT a clean install.** There is no database schema migration and **no bootstrap/reset/reseed step**. Back up current source, generated web assets, SQLite and Neo4j according to your operational policy before changing a working production installation.

1. Upload and unpack the ZIP to `/home/siteadmin/releases/problem-explorer-v0.8.1`. Avoid unpacking or copying as root where practicable; ensure `siteadmin` can read the release.
2. From `apps/web/` in that staging directory, run `npm install --no-audit --no-fund` and `npm run build`. Do not publish if the TypeScript compiler or Vite build fails. No runtime CDN dependencies are used.
3. Run `python -m unittest discover -s tests -v` using the **existing Python 3.12 environment** (or a temporary 3.12 test venv). Do not run system-wide pip or use Python 3.14.
4. Stop only `problem-explorer.service`, and copy the code and `dist` using `rsync` with explicit `siteadmin` ownership/permitted modes. **Exclude:** production `.env`, `apps/api/data/` (SQLite), `apps/api/.venv/`, `apps/web/node_modules/`, `apps/web/dist/` and temporary files. The `public_html` files must remain traversable/readable by the site's web server. Do not overwrite other public_html files.
5. If requirements changed, use `$APP/apps/api/.venv/bin/python -m pip install -r $APP/apps/api/requirements.txt` (existing Python 3.12 venv). Verify `requests` remains installed.
6. Restart the service, check logs for `Application startup complete`, and retry local `/api/health` before public `/api/health` and homepage (the service may take seconds to start).
7. Sign in as two separate users to test target isolation and the Research history. Check shared read-only behavior, the target directory/copy flow, and the new graph labels/bubble sizing.

**Important:** The older `deploy/directadmin/README.md` describes a v0.7.0 clean installation with an explicitly destructive reset. Do not execute its reset instructions for this upgrade. Do not change DirectAdmin's Nginx/Apache templates or service definition.
