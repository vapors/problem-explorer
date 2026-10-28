# Problem Explorer v0.8.1 — Immersive Network Workspace

Problem Explorer is a target-scoped, evidence-led research and solution-design environment built with React/TypeScript, amCharts 5, FastAPI, Neo4j Community and SQLite.

The app uses a full-viewport network with independently draggable/resizable/collapsible panels, including the Target Explorer. Graph labels can display up to three lines; visual display labels remove seed catalog prefixes without altering Neo4j content. Research, concepts, matching, discovery and evaluation remain scoped to the active target and current signed-in account.

## Installation and release operations — start here

**[`docs/README.md`](docs/README.md)** is the maintained documentation index.

- Local Windows development: [`docs/LOCAL-WINDOWS.md`](docs/LOCAL-WINDOWS.md)
- Native Ubuntu 24.04 / DirectAdmin production upgrades: [`docs/DIRECTADMIN.md`](docs/DIRECTADMIN.md)
- Versioned packaging and updates: [`docs/RELEASE-PROCESS.md`](docs/RELEASE-PROCESS.md)
- Recovery and data backup: [`docs/RECOVERY-AND-DATA.md`](docs/RECOVERY-AND-DATA.md)

Change `RELEASE_VERSION` in **`deploy/release.env`** when preparing the next release. Deployment scripts do not need editing for new versions.

### One-time local setup (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

Then configure the **local** `.env` and run `start-dev.cmd`. Use Python 3.12, local npm packages (`@amcharts/amcharts5`, `react-rnd`) and a local Neo4j instance.

### Existing DirectAdmin VPS upgrade (root may invoke; app runs as siteadmin)

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.8.2.zip
```

Only use the command once this release's deployment helper has been installed; first-time helper setup is in `docs/DIRECTADMIN.md`. Substitute the uploaded ZIP's actual filename. The deployer performs a build, offline tests, source/asset backup, permissions normalization, rollout and health checks. It **never** resets SQLite or Neo4j, replaces `.env`, changes DirectAdmin proxy templates, or runs system-wide pip.

### Database boundaries

- **SQLite** stores users, Google SSO identities, quota usage and indexing jobs in the current configured `AUTH_DB_PATH` (normally `apps/api/data/auth.sqlite3`).
- **Neo4j Community** stores targets, streams, categories, problems, findings, sources, concept drafts and associations. Sharing and private target permissions are enforced in API routes.

**No migration, reseeding, or destructive bootstrap is part of a normal upgrade.** Do not use the historical `--reset-all` procedure to fix deployment errors.

### Verification

The release has offline contract tests under `tests/`. Frontend build (`npm run build`), live Neo4j behavior, Google SSO and two-user isolation require checks in the actual target environment. See the v0.8.1 release notes for UI implementation details.
