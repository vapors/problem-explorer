# Problem Explorer v0.7.0 — Native DirectAdmin deployment (NO Docker)

**Deployment target:** Ubuntu 24.04 VPS, DirectAdmin-managed Nginx → Apache, native Neo4j Community, FastAPI/Uvicorn via `systemd`, static Vite/React build. These instructions replace the obsolete Docker Compose instructions. **This release is still an integration candidate**: run the local functional test plan in `RELEASE-v0.7.0-INTEGRATION.md` before using it for real users.

**Production domain:** https://explorer.pixelandpiece.com  
**Linux account:** `siteadmin`  
**App:** `/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer`  
**Static frontend:** `/home/siteadmin/domains/explorer.pixelandpiece.com/public_html`  
**API:** `problem-explorer.service`, `127.0.0.1:8181`  
**Neo4j:** existing **native** `neo4j.service`, Bolt `127.0.0.1:7687`  
**Authentication:** SQLite file configured by `AUTH_DB_PATH` (not the Neo4j research database)

> **Existing web proxy:** Your `/api/` Nginx/Apache routing, TLS certificate and removal of HTTP Basic Authentication are already working. **Do not change DirectAdmin templates or regenerate Nginx configuration for an application-code update.** Avoid editing generated vhost files, replacing `public_html` wholesale, installing Docker, or touching Neo4j's installation.

## 0. Roles, prerequisites and release gating

Commands not prefixed by `sudo` are intended to run as **`siteadmin`** (SSH as that account, or `sudo -iu siteadmin` from a root shell). Commands prefixed by `sudo` require root/sudo. Keep separate root access available for starting/stopping services and backing up Neo4j.

Requirements: Linux Python 3.12 and `python3.12 -m venv`, Node/npm supported by the Vite version in `apps/web/package.json`, `unzip`, `rsync`, native Neo4j, and the existing backend venv at `$APP/apps/api/.venv/bin/python`. Do not silently create a new production venv with a different Python release. The current FastAPI service must use **one Uvicorn worker** because background indexing uses an in-process worker.

Check the live installation **before** uploading or modifying it:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
WEB=/home/siteadmin/domains/explorer.pixelandpiece.com/public_html
sudo systemctl cat problem-explorer.service
sudo systemctl status neo4j --no-pager
sudo systemctl status problem-explorer.service --no-pager
sudo ss -ltnp | grep -E ':(7687|8181)\b' || true
sudo nginx -t
python3.12 --version
node --version && npm --version
rsync --version | head -1
ls -l "$APP/apps/api/.venv/bin/python" "$APP/.env" "$WEB/index.html"
```

Review the service's actual `WorkingDirectory` and `ExecStart`; the previously verified version used `WorkingDirectory=$APP/apps/api` and invoked that directory's `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8181 --env-file $APP/.env`. If they differ, investigate **before** continuing. No changes to the unit should be necessary when upgrading this established installation.

## 1. Upload and build a staging copy (siteadmin; does not touch live data)

Upload this v0.7.0 ZIP via SFTP, DirectAdmin File Manager or `scp` into `/home/siteadmin/releases/` (do **not** upload it to `public_html`). Replace `<uploaded-v0.7-zip>` with the name you uploaded.

```bash
mkdir -p /home/siteadmin/releases/problem-explorer-v0.8.0
cd /home/siteadmin/releases/problem-explorer-v0.8.0
unzip -q /home/siteadmin/releases/Problem-Explorer-v0.8.0.zip
STAGE=/home/siteadmin/releases/problem-explorer-v0.8.0

# Independent staging environment: leaves the live venv alone.
python3.12 -m venv "$STAGE/.testvenv"
"$STAGE/.testvenv/bin/python" -m pip install -U pip
"$STAGE/.testvenv/bin/python" -m pip install -r "$STAGE/apps/api/requirements.txt"
(cd "$STAGE" && "$STAGE/.testvenv/bin/python" -m unittest discover -s tests -v)
(cd "$STAGE/apps/web" && if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi && npm run build)
```

**Stop here if any staging install, test or build fails.** In particular, the `requests` package is required by the Google authentication transport; v0.7.0's `requirements.txt` includes it. Passing offline tests does **not** establish that Google login, Neo4j permissions, AI research or browser interactions work in production.

## 2. Review production `.env` (siteadmin)

Your production `.env` already contains secret values. **Do not overwrite it with `.env.example` or upload Windows `.env`.** Print only nonsecret settings:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
grep -E '^(NEO4J_URI|NEO4J_DATABASE|DATA_FILE|AUTH_DB_PATH|AUTH_SECURE_COOKIE|PUBLIC_ORIGINS|CORS_ORIGINS|AUTO_SEED|AUTO_INDEX_SHARED)=' "$APP/.env"
```

Recommended relevant values for **this actual server** (keep existing password, API key and Google client ID unchanged):

```dotenv
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_DATABASE=neo4j
DATA_FILE=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer/data/problems.csv
AUTH_DB_PATH=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer/apps/api/data/auth.sqlite3
AUTH_SECURE_COOKIE=true
PUBLIC_ORIGINS=https://explorer.pixelandpiece.com
CORS_ORIGINS=https://explorer.pixelandpiece.com
AUTO_SEED=false
AUTO_INDEX_SHARED=false
```

The absolute `AUTH_DB_PATH` shown above resolves to the same populated location previously used with the relative `./data/auth.sqlite3` when FastAPI's working directory is `apps/api`. Do not point it at the *empty* root-level `data/auth.sqlite3` by mistake. If your **current active** `AUTH_DB_PATH` points elsewhere, find and back it up before making a change. The reset procedure below clears user accounts intentionally, but an unrelated path mistake should not be how that happens. Google Cloud should authorize `https://explorer.pixelandpiece.com` as a JavaScript origin for the production Web Client ID.

Keep `.env` readable only by the service owner (`siteadmin`); never publish it, the SQLite database, Python venv or Node source under `public_html`.

## 3. Back up code, frontend, SQLite and Neo4j (maintenance window)

The v0.7.0 reset is **destructive** and should not run without a verified recovery path. Even when you intend to discard existing users/research, take a rollback snapshot first. Perform the backups before changing the running application.

### 3A. Back up application and SQLite (as siteadmin)

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
WEB=/home/siteadmin/domains/explorer.pixelandpiece.com/public_html
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=/home/siteadmin/problem-explorer-backups/v070-$STAMP
umask 077
mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > /home/siteadmin/problem-explorer-backups/v070-last-backup-path.txt

tar -C "$APP" --exclude='./apps/api/.venv' --exclude='./apps/api/data' \
  --exclude='./apps/web/node_modules' --exclude='./apps/web/dist' \
  --exclude='./.env' -czf "$BACKUP/application-code.tar.gz" .
tar -C "$WEB" -czf "$BACKUP/public-html.tar.gz" .
cp -p "$APP/.env" "$BACKUP/production.env"
```

For a consistent authentication snapshot, stop the FastAPI service **as root/sudo** before backing up SQLite or resetting. With the currently verified path:

```bash
sudo systemctl stop problem-explorer.service
python3 - "$APP/apps/api/data/auth.sqlite3" "$BACKUP/auth.sqlite3" <<'PY'
import os, sqlite3, sys
src, dst = sys.argv[1:]
if os.path.isfile(src):
    with sqlite3.connect(f'file:{src}?mode=ro', uri=True) as source, sqlite3.connect(dst) as target:
        source.backup(target)
    print('SQLite backup complete:', dst)
else:
    print('No existing auth SQLite file at', src, '(confirm AUTH_DB_PATH before continuing)')
PY
```

If `AUTH_DB_PATH` is not the path shown, replace the script's source with the **actual configured path**. Confirm backups exist and are nonempty (`ls -lh "$BACKUP"`) before proceeding.

### 3B. Offline Neo4j Community dump (root/sudo required)

A consistent `neo4j-admin database dump` of Neo4j **Community Edition** requires stopping Neo4j. Neo4j must be running again for the Python v0.7 reset/reseed. The commands below assume the usual `neo4j` OS user and `/var/lib/neo4j`; first check those exist on *your* VPS. If your native installation uses another location, adjust the dump directory after inspecting its service/configuration.

```bash
id neo4j
command -v neo4j-admin
sudo systemctl stop neo4j
sudo install -d -o neo4j -g neo4j -m 0700 /var/lib/neo4j/backups
sudo -u neo4j neo4j-admin database dump neo4j --to-path=/var/lib/neo4j/backups
# Do not continue if the dump command failed.
sudo cp /var/lib/neo4j/backups/neo4j.dump "$BACKUP/neo4j.dump"
sudo chown siteadmin:siteadmin "$BACKUP/neo4j.dump"
ls -lh "$BACKUP/neo4j.dump"
sudo systemctl start neo4j
sudo systemctl is-active neo4j
```

If `/var/lib/neo4j/backups/neo4j.dump` already exists, **do not overwrite an earlier backup**. Create a unique dump directory and point `--to-path` there (see Neo4j documentation). Verify `neo4j-admin database dump --help` on your installed version. Protect backup files because they contain user data and potentially secrets.

## 4. Cut over source and frontend (siteadmin; backend remains stopped)

After passing staging build and verifying the backups, copy source into the existing application directory **without replacing** the live `.env`, virtual environment or authentication SQLite data. This command deliberately does not use `--delete`.

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
WEB=/home/siteadmin/domains/explorer.pixelandpiece.com/public_html
STAGE=/home/siteadmin/releases/problem-explorer-v0.8.0

rsync -a \
  --exclude='/.env' --exclude='/.testvenv/' \
  --exclude='/apps/api/.venv/' --exclude='/apps/api/data/' \
  --exclude='/apps/web/node_modules/' --exclude='/apps/web/dist/' \
  --exclude='__pycache__/' --exclude='*.pyc' \
  "$STAGE/" "$APP/"

# Update packages inside the existing systemd service's venv; do not replace the venv.
"$APP/apps/api/.venv/bin/python" -m pip install -r "$APP/apps/api/requirements.txt"
"$APP/apps/api/.venv/bin/python" -m pip check

# Publish only the built frontend, preserving DirectAdmin and other public_html files.
rsync -a \
  --chown=siteadmin:siteadmin \
  --chmod=Du+rwx \
  --exclude='/.env' \
  --exclude='/.testvenv/' \
  --exclude='/apps/api/.venv/' \
  --exclude='/apps/api/data/' \
  --exclude='/apps/web/node_modules/' \
  --exclude='/apps/web/dist/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  "$STAGE/" "$APP/"
  
```

**No automatic database migration or reseed takes place during code copying.** Old hashed assets may remain in `public_html`; that is preferable to deleting unknown DirectAdmin-managed files. Clean them up only after reviewing the site's contents.

## 5. Optional, explicitly destructive v0.7.0 reset + reference seed

You authorized discarding old users and old research when moving to v0.7.0. **Only run this step when you deliberately want to delete ALL Neo4j nodes and registered SQLite accounts**. FastAPI must remain stopped, **Neo4j must be running**, and `DATA_FILE` must point to the deployment's 498-row CSV. This resets all targets, private work, research, concepts, credentials/sessions, usage and indexing jobs.

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo systemctl is-active neo4j
cd "$APP/apps/api"
./.venv/bin/python -m app.bootstrap --reset-all --confirm DELETE-ALL-RESEARCH-AND-USERS
```

Expected: the CLI prints a snapshot path for SQLite and `Seeded 498 reference problems under one shared Target.` This creates **one** shared target, `reference-longevity`, containing four streams and 498 problems. **Do not rerun it to troubleshoot a startup error.** If you need only to seed an otherwise empty/initialized database, use `python -m app.bootstrap --seed-reference` **instead**; it refuses to reseed an existing reference.

## 6. Start service, verify endpoints and grant first admin

Root/sudo commands:

```bash
+
```

After a clean reset, `/api/health` should report `"ok":true`, `"neo4j":true` and `"targets":1`. It should not require login. Static frontend and API are served by the already-existing DirectAdmin proxy. Open the site and register your first account. Then, as `siteadmin`, promote the **registered** email (do not use placeholder text):

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
cd "$APP/apps/api"
./.venv/bin/python -m app.bootstrap --promote-email YOUR_REGISTERED_EMAIL
```

Sign out and back in; confirm Administration appears. Test Google sign-in, private targets, shared reference browsing/copy, graph expansion, problem details, research, discovery, concept creation, matching, evaluation and quota changes. Verify that a second user cannot read another user's unshared target via the UI **or direct APIs**. Avoid inviting others until those checks pass; a healthy `/api/health` is not enough to establish security.

## 7. DirectAdmin, systemd and root-only maintenance reference

| Task | Root/sudo command | Notes |
|---|---|---|
| Inspect backend unit | `sudo systemctl cat problem-explorer.service` | Existing `WorkingDirectory`, `.venv` and port 8181 should remain unchanged |
| Start / stop / restart API | `sudo systemctl start\|stop\|restart problem-explorer.service` | Execute the individual command as needed; keep stopped for reset |
| API logs | `sudo journalctl -u problem-explorer.service -n 100 --no-pager` | Inspect traceback if health or login fails |
| Neo4j service | `sudo systemctl status neo4j --no-pager` | Native Neo4j only |
| Check Nginx | `sudo nginx -t` | Don't replace the Nginx or Apache proxy configuration |
| Reload Nginx if an actual config change was made | `sudo systemctl reload nginx` | **Not needed** for ordinary frontend/backend code deployment |
| Regenerate DirectAdmin vhosts after changing a supported custom template | `sudo da build rewrite_confs` | **Not needed** for this release; may affect multiple domains |

Root should **not** run `npm ci`, application Python/pip or the bootstrap CLI in normal operation: use `siteadmin` so files do not become root-owned. The script needs write permissions to the existing `apps/api/data` directory and source tree. The external Neo4j service must remain bound to loopback and should never expose Bolt 7687 or Neo4j Browser 7474 to the internet.

DirectAdmin documentation confirms that native Nginx/Apache setups use persistent custom templates, and rewriting via `da build rewrite_confs` is appropriate only when such templates actually change. This release does not require any vhost changes.

## 8. Rollback, including database restore after a reset

If deployment tests fail, stop the API. Restore both the **previous code/frontend** and the **matching Neo4j/SQLite snapshots** if you ran `--reset-all`. A code-only rollback cannot recover deleted research.

**As siteadmin**, substitute the actual timestamped backup directory created in step 3:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
WEB=/home/siteadmin/domains/explorer.pixelandpiece.com/public_html
BACKUP=/home/siteadmin/problem-explorer-backups/v070-REPLACE_WITH_TIMESTAMP
sudo systemctl stop problem-explorer.service
tar -C "$APP" -xzf "$BACKUP/application-code.tar.gz"
tar -C "$WEB" -xzf "$BACKUP/public-html.tar.gz"
cp -p "$BACKUP/production.env" "$APP/.env"
```

If you reset the SQLite users, restore the SQLite backup **while FastAPI remains stopped**, to the same configured `AUTH_DB_PATH`; remove only the associated stale `-wal` and `-shm` sidecars after confirming the source/target paths:

```bash
AUTH_FILE="$APP/apps/api/data/auth.sqlite3"    # adjust if your actual AUTH_DB_PATH differs
rm -f "${AUTH_FILE}-wal" "${AUTH_FILE}-shm"
cp -p "$BACKUP/auth.sqlite3" "$AUTH_FILE"
```

If you reset Neo4j, the native **Community Edition offline restore** requires root/sudo, stopping Neo4j, and loading the saved dump as the Neo4j OS user. Only execute this if `$BACKUP/neo4j.dump` is confirmed correct:

```bash
sudo systemctl stop neo4j
sudo install -d -o neo4j -g neo4j -m 0700 /var/lib/neo4j/backups/restore-v070
sudo install -o neo4j -g neo4j -m 0600 "$BACKUP/neo4j.dump" /var/lib/neo4j/backups/restore-v070/neo4j.dump
sudo -u neo4j neo4j-admin database load neo4j --from-path=/var/lib/neo4j/backups/restore-v070 --overwrite-destination=true
sudo systemctl start neo4j
sudo systemctl start problem-explorer.service
```

Test the API and old UI afterward. Reinstall the previous release's `requirements.txt` into the live venv if its dependencies differ; code/data restoration does not automatically downgrade Python packages. Restoring archives without deleting newly introduced source files may leave benign unused files; inspect before performing a cleanup.

## References

- [Neo4j: Offline dump on Community Edition](https://neo4j.com/docs/operations-manual/current/backup-restore/offline-backup/)
- [Neo4j: Load a database dump](https://neo4j.com/docs/operations-manual/current/backup-restore/restore-dump/)
- [DirectAdmin: Customizing Nginx with Nginx/Apache](https://docs.directadmin.com/webservices/nginx/customizing-nginx.html)
