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

## One-time installation of the release tooling (this v0.8.1 package)

Because the currently installed app may not yet contain `deploy.sh`, first upload the v0.8.1 source ZIP into `/home/siteadmin/releases/`, then as root:

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

## Every subsequent version (one reusable command)

1. Set `RELEASE_VERSION` in the new source package's `deploy/release.env` before packaging.
2. Build/test locally (`scripts/test-local.ps1`) and create the sanitized ZIP (`scripts/package-release.ps1`).
3. Upload to `/home/siteadmin/releases/`.
4. SSH as root and run:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.8.2.zip
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

Then sign in to the browser as an admin and a regular user. Open the reference target; expand the graph; confirm research runs/finding history for the right account; open a private target as its owner; verify a second account cannot access it; confirm shared-target copy, research, concept, match and evaluation. Verify `.htaccess` wasn't modified and no unexpected 403; check the site root if DirectAdmin fails to serve it.

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

## promote user to admin
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
cd "$APP/apps/api"
./.venv/bin/python -m app.bootstrap --promote-email scott.milich@me.com