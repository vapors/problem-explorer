# Recovery & data protection — do not confuse code rollback with data restore

## What `deploy.sh` backs up

Before changing production files, deployment creates an access-restricted directory such as:

<<<<<<< HEAD
`/home/siteadmin/problem-explorer-backups/v0.9.1-predeploy-20261023T200000Z/`
=======
`/home/siteadmin/problem-explorer-backups/v0.8.2-predeploy-20261023T200000Z/`
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8

It contains a `code/` snapshot of the previous application sources (excluding `.env`, SQLite, venv, node_modules and other runtime data), plus `frontend/index.html` and `frontend/assets/`. The file `latest-code-backup.txt` points at the most recent predeploy snapshot. **This is not a user-data backup.** Do not mistake it for a Neo4j dump.

## Roll back a failed code deployment

Find the exact snapshot printed by `deploy.sh`, then as root:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
<<<<<<< HEAD
BACKUP=/home/siteadmin/problem-explorer-backups/v0.9.1-predeploy-REPLACE_WITH_TIMESTAMP
=======
BACKUP=/home/siteadmin/problem-explorer-backups/v0.8.2-predeploy-REPLACE_WITH_TIMESTAMP
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
sudo bash "$APP/deploy/directadmin/rollback.sh" "$BACKUP"
```

The script checks that the snapshot is under the backup directory, restores code and frontend with `siteadmin` ownership, re-checks the existing 3.12 virtualenv requirements, restarts FastAPI and checks the localhost API. It prunes **new Python modules inside the app's code directory only** to match the snapshot. It does not delete research, accounts, `.env`, or public_html-managed files. npm package versions are managed in staging and frontend assets are already compiled; rollback needn't npm-install. If new database migrations were ever added in a future release, this simple code-only rollback would need an explicit versioned migration/rollback plan first.

## Independently back up user data before a release or other risky change

### SQLite: consistent online backup

First confirm `AUTH_DB_PATH` in the production `.env` (do not print password/secret lines). The following uses the known default path; **adjust it if your configuration uses another path**. It uses Python's SQLite backup API rather than copying an active WAL-mode SQLite file:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
SRC="$APP/apps/api/data/auth.sqlite3"
DEST="/home/siteadmin/problem-explorer-backups/auth-$(date -u +%Y%m%dT%H%M%SZ).sqlite3"
sudo install -d -o siteadmin -g siteadmin -m 0700 /home/siteadmin/problem-explorer-backups
sudo -u siteadmin "$APP/apps/api/.venv/bin/python" - "$SRC" "$DEST" <<'PY'
import sqlite3, sys
src, dst = sys.argv[1:]
with sqlite3.connect(f'file:{src}?mode=ro', uri=True) as source, sqlite3.connect(dst) as target:
    source.backup(target)
print('SQLite backup:', dst)
PY
sudo chmod 600 "$DEST"
```

Keep SQLite backups protected: they contain user identities and application state.

### Neo4j Community: offline database dump

Take a verified **offline** Neo4j dump during a planned maintenance window; stop FastAPI first, then Neo4j. Use your installed Neo4j version's `neo4j-admin database dump` syntax and the actual `neo4j` OS user/data directory. Avoid overwriting older dumps, keep enough disk space, and restart Neo4j and FastAPI afterward. Example for a commonly used native layout:

```bash
sudo systemctl stop problem-explorer.service
sudo systemctl stop neo4j
DUMP_DIR="/var/lib/neo4j/backups/$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -d -o neo4j -g neo4j -m 0700 "$DUMP_DIR"
sudo -u neo4j neo4j-admin database dump neo4j --to-path="$DUMP_DIR"
# Verify dump file exists and has size >0 before proceeding.
sudo systemctl start neo4j
sudo systemctl start problem-explorer.service
```

Validate the tool syntax on your particular Neo4j installation before using it. **Do not** run a Neo4j load/restore as routine deployment troubleshooting. Restore from a dump only as a separate, planned, explicitly authorized database-recovery operation. Match Neo4j and SQLite snapshots if restoring both.

## Common failure signatures

- `status=200/CHDIR`: systemd cannot traverse its configured `WorkingDirectory`; `namei -l` will show root-owned 700 ancestors. The deployer normalizes only its known app directories.
- `Could not import module app.main`: often source permissions/visibility or genuine Python import exception. Test as `siteadmin` and inspect journal.
- `502 Bad Gateway`: public web proxy can't reach localhost 8181; test localhost API first; service may need a few seconds after restart.
- `Forbidden / Server unable to read htaccess`: Apache/DirectAdmin cannot traverse the public path or read `.htaccess`; inspect `namei -l` and domain Apache error log. Do not chmod 777, delete `.htaccess`, or change all home directories.
- `/api/health` healthy but UI broken: inspect browser console/network, `npm run build`, index/assets paths, and authenticated API failures. A successful health check says nothing about user-scoped research authorization.
<<<<<<< HEAD

## v0.9.1 note: durable evaluation state

The existing SQLite database now includes additive `evaluation_jobs` rows holding account-scoped job stages and intermediate validated agent results. **Neo4j remains the owner of completed research evaluations.** An SQLite-only restore may lose job progress, whereas a Neo4j-only restore may lose saved results. Back up both independently and coordinate snapshots for disaster recovery; do not run `bootstrap --reset-all`.

## v0.9.3 — per-user view and graph appearance state

The additive `user_graph_views` and `graph_appearance` tables live in `apps/api/data/auth.sqlite3` alongside existing user/usage/job state. The release does not add research content to SQLite. Back up SQLite before deploying because **code rollback is not a database rollback**; the additive tables can safely be left in place after a code rollback. Unlinked manual concepts remain unlinked until an owner explicitly chooses a Problem.


### v0.9.8 concept-status rollback note

Rejecting a concept sets an additive `reviewStatus` property on the existing Neo4j Solution, without deletion. Rollback of code does not roll back these user edits. Back up Neo4j and SQLite separately before upgrades, and restore records deliberately when needed; never reset/reseed in a routine rollout.
=======
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
