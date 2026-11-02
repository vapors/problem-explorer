# DirectAdmin native production deployment (Ubuntu 24.04, no Docker)

This is the **canonical non-destructive upgrade procedure** for the existing deployment at `https://explorer.pixelandpiece.com`.

## Current deployment contract

| Resource | Existing production location |
|---|---|
| Account | `siteadmin` |
| Application | `/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer` |
| Published frontend | `/home/siteadmin/domains/explorer.pixelandpiece.com/public_html` |
| API | `problem-explorer.service` listening on `127.0.0.1:8181` |
| Runtime | Pre-existing `apps/api/.venv/bin/python` (**Python 3.12**), one Uvicorn worker |
| Research | Native Neo4j Community, local `bolt://127.0.0.1:7687` |
| Identity/jobs | SQLite (`apps/api/data/auth.sqlite3` unless `AUTH_DB_PATH` says otherwise) |
| Reverse proxy | Existing DirectAdmin Nginx → Apache configuration and HTTPS cert |

**Do not run `app.bootstrap --reset-all`, `--seed-reference`, migrations, or copy the local `.env` during a normal upgrade.** The deployer will never call those commands. Do not rewrite DirectAdmin Nginx templates, touch `/api/` proxy settings, deploy Docker or run system-wide pip.

## Historical one-time installation of the release tooling (v0.8.1)

Only for an installation that does not yet have `deploy.sh`, upload the v0.8.1 Deployment Toolkit ZIP into `/home/siteadmin/releases/`, then as root:

```bash
VERSION=0.8.1
ZIP=/home/siteadmin/releases/Problem-Explorer-v0.8.1-Deployment-Toolkit.zip
STAGE=/home/siteadmin/releases/problem-explorer-v${VERSION}
mkdir -p "$STAGE"
unzip -q "$ZIP" -d "$STAGE"

# Inspect release configuration and run read-only checks first.
cat "$STAGE/deploy/release.env"
sudo bash "$STAGE/deploy/directadmin/preflight.sh"

# Install verified code and web assets with siteadmin ownership.
sudo bash "$STAGE/deploy/directadmin/deploy.sh" "$STAGE"
```

**Filename note:** Use the **documentation-enhanced v0.8.1 ZIP** produced with this guide; the earlier `Readable-Graph-Target-Explorer.zip` predates these scripts. If you rename the ZIP, update only `ZIP=`. Do not try to invoke `preflight.sh` from the original v0.8.1 ZIP.

## Every upgrade (v0.8.1+ toolkit) (one reusable command)

1. Set `RELEASE_VERSION` in the new source package's `deploy/release.env` before packaging.
2. Build/test locally (`scripts/test-local.ps1`) and create the sanitized ZIP (`scripts/package-release.ps1`).
3. Upload to `/home/siteadmin/releases/`.
4. SSH as root and run:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.4.1-Badge-Tooltip-Polish.zip
```

Change only the example ZIP name/path to your actual uploaded archive (it may include a descriptive suffix). The script reads the version **from the release**, checks the service account and Python 3.12, makes an isolated `siteadmin`-owned build tree under `/home/siteadmin/releases/`, runs offline backend tests and `npm ci`/`npm install` + `npm run build` **as siteadmin**, snapshots previous code+frontend, stops only FastAPI, copies source as `siteadmin` with file/dir modes 644/755, reuses the existing venv to check requirements, copies only built Vite assets into public_html, starts FastAPI and retries health checks.

**Permissions fix that prevents prior incidents:** even when root uploads/unpacks the archive, `rsync --chown=siteadmin:siteadmin --chmod=D755,F644` normalizes the target. The script also corrects the specific `apps/api` working-directory ancestors and `public_html` to readable/traversable mode 755; it does **not** relax all home/domain ancestors or chmod 777. Nginx/Apache must retain their existing DirectAdmin access paths.

## Post-deploy checks

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
sudo systemctl status problem-explorer.service --no-pager
sudo journalctl -u problem-explorer.service -n 80 --no-pager
```

Then follow the **v0.9.4 checklist** in [RELEASE-v0.9.4.md](RELEASE-v0.9.4.md), and sign in as admin and as a regular user. Check the administrator Target inventory and **do not delete any live Target during a smoke test**. Verify the reference target cannot be deleted. Compare strict and exploratory concept analyses and confirm missing radar scores are not plotted as zero. Open the reference target; expand the graph; confirm research runs/finding history for the right account; open a private target as its owner; verify a second account cannot access it; confirm shared-target copy, research, concept, match and evaluation. Verify `.htaccess` wasn't modified and no unexpected 403; check the site root if DirectAdmin fails to serve it.

## If the deployment is unhealthy

The deployer prints its `BACKUP` path. Use the matching `rollback.sh` per [RECOVERY-AND-DATA.md](RECOVERY-AND-DATA.md). It restores **code and Vite assets only**, not SQLite or Neo4j. The script deliberately does not automatically roll back; this lets you inspect logs and choose the correct snapshot. Stop making changes until you understand the fault.

## What is deliberately preserved

- Live `$APP/.env`, credentials and Google SSO configuration.
- Live `$APP/apps/api/data/` and the SQLite identity/jobs database.
- Live `$APP/apps/api/.venv/` (Python 3.12).
- Native Neo4j server and its entire data directory.
- Other DirectAdmin-owned `public_html` contents, `.htaccess`, `.well-known`, custom templates and proxy configuration.
- Existing user-created research Targets, evidence, concepts and usage state.

The deployer **never** runs `--delete` over `public_html` or the entire application. Old hashed assets can accumulate; clean only after reviewing ownership/use. This is an upgrade tool for an already provisioned VPS; first-time VPS provisioning and database recovery are separate procedures.

## v0.9.1 deployment notes

The deploy script and `siteadmin` ownership normalization are unchanged. SQLite adds only `evaluation_jobs` metadata on startup; no migration/reset command is required. The second in-process worker shares the **same single Uvicorn process**, so do not increase the systemd worker count. Completed evaluations continue to reside in Neo4j. Review `docs/RELEASE-v0.9.1.md` for the New Target wizard, two-agent queue, evidence-review checks, and **opt-in** approved feed import. Public forum collection stays disabled if `SOCIAL_FEED_ALLOWED_HOSTS` is not set.


## v0.9.2 — runtime lenses

No database migration or new server dependency. Run the usual root-safe deployment. Verify the default lens is Classic, select another lens while a branch is expanded, and confirm zoom, open panels, current target, review statuses, scores, and queued evaluation jobs remain unchanged. See [RELEASE-v0.9.2.md](RELEASE-v0.9.2.md). Do not reset either database.

## v0.9.3 — graph continuity and preferences

The source-only upgrade preserves the live `.env`, Neo4j, the Python 3.12 venv, and `apps/api/data/auth.sqlite3`. On startup, two **additive SQLite tables** (`user_graph_views`, `graph_appearance`) are created if missing. Never run `bootstrap --reset-all`. Existing target and concept content is not migrated or rewritten.

After deployment test as two different accounts: expand/zoom one target, switch away and back, confirm only that account's view returns; save a concept while zoomed and confirm the graph root is not recreated; verify manual unlinked concepts remain in Concept Studio; confirm graph appearance controls are admin-only and a dark/light palette update repaints bubbles without moving them. Use `Reset saved graph view` to clear a test account's saved view.

The deployment gate now includes `npm run test:graph`, followed by `tsc --noEmit && vite build` and the existing Python unit suite. Do not treat an API health check as a substitute for the browser tests.

## v0.9.4 — Concept branch interaction regression

The reusable deployment script now runs `npm run test:concepts` in addition to the existing lens and graph checks. The full `npm run build` must succeed before publishing.

Inspect the exact target's concept branch after logging in. Click the count badge on the Problem perimeter to expand/collapse saved concepts; click the Problem's label to see Problem details; click a concept to open its distinct Concept Workspace modal. Choose matching or analysis from that modal and confirm the respective floating window loads the same saved concept. Repeat after sign-out/sign-in with restored saved view.

No migration, database reset, reseed, vhost rewrite, or DirectAdmin proxy change is required. Follow [RELEASE-v0.9.4.md](RELEASE-v0.9.4.md) for details.

### v0.9.5 publication upgrade

No Neo4j schema migration, new Python environment, database reset, or proxy change is required. Use the normal root-safe deploy command with the v0.9.5 ZIP. After deploying, check Administration → Targets and use an independent test account to verify hiding and public-access behavior before retiring the original reference library from directory listing. See [RELEASE-v0.9.5.md](RELEASE-v0.9.5.md).

### v0.9.6 guided onboarding upgrade

Deploy `Problem-Explorer-v0.9.6-Guided-Onboarding.zip` with the existing root-safe deployment script. The deployment runs `npm run test:onboarding`, the existing frontend contract tests, and `npm run build` before publishing as `siteadmin`. No FastAPI routes, Neo4j constraints, SQLite tables or webserver configuration changed. After deployment, create a **test** Target and verify four-step wizard navigation, source-labeled draft generation, per-stream save, and return-to-graph behavior. A healthy API alone does not confirm this workflow. See [RELEASE-v0.9.6.md](RELEASE-v0.9.6.md).

### v0.9.7 Workspace & Research UX

Deploy `Problem-Explorer-v0.9.7-Workspace-Research-UX.zip` using the established `deploy.sh`. The script runs `npm run test:research-ux` in addition to existing source-contract suites and the full `npm run build` before publishing. A successful build must be followed by manual testing of the rejected-findings recovery view, status totals, wizard Skip behavior and standalone concept generator. No database migration, seed or proxy modifications; see [RELEASE-v0.9.7.md](RELEASE-v0.9.7.md).


### v0.9.8 Research Graph Intelligence & Studio Context

Deploy `Problem-Explorer-v0.9.8.2-Badge-Geometry-Hover.zip` with the existing root-safe DirectAdmin deployer. It runs `npm run test:badge-layout` along with the previous frontend regression gates, then `npm run build`; deployment is not published on build failure. No destructive migration or reset. Verify badge positioning, collapsed/expanded display, tooltip independence, and Graph Appearance controls in a live browser. See [RELEASE-v0.9.8.1.md](RELEASE-v0.9.8.1.md).


For v0.9.9 workflow/graph changes and acceptance checks, see [RELEASE-v0.9.9.md](RELEASE-v0.9.9.md).
