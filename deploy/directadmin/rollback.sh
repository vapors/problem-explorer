#!/usr/bin/env bash
# Restore code + static frontend snapshot only. Does NOT restore/authenticate/alter Neo4j or SQLite.
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
pe_require_root
for cmd in rsync systemctl curl runuser; do pe_need "$cmd"; done
pe_load_config "$(cd "$SCRIPT_DIR/../.." && pwd)"
pe_validate_live
[[ $# -eq 1 ]] || pe_die 'Usage: sudo bash deploy/directadmin/rollback.sh /home/siteadmin/problem-explorer-backups/vX-predeploy-YYYY...'
BACKUP=$(realpath -e -- "$1") || pe_die 'Backup not found'
case "$BACKUP" in "$BACKUPS"/*) ;; *) pe_die "Backup must be inside $BACKUPS" ;; esac
[[ -d "$BACKUP/code/apps/api/app" && -f "$BACKUP/frontend/index.html" ]] \
  || pe_die 'Backup does not include code + frontend/index.html. Refusing incomplete restore.'
pe_log "Restoring code and frontend from $BACKUP (NO DATABASE RESTORE)"
systemctl stop "$API_SERVICE"
pe_rsync_source "$BACKUP/code" "$APP"
# These are exclusively application-managed Python modules: remove newly introduced modules on rollback.
rsync -a --delete --chown="$DEPLOY_USER:$DEPLOY_GROUP" --chmod=D755,F644 \
  --exclude='__pycache__/' "$BACKUP/code/apps/api/app/" "$APP/apps/api/app/"
rsync -a --chown="$DEPLOY_USER:$DEPLOY_GROUP" --chmod=F644 \
  "$BACKUP/frontend/index.html" "$WEB/index.html"
if [[ -d "$BACKUP/frontend/assets" ]]; then
  rsync -a --chown="$DEPLOY_USER:$DEPLOY_GROUP" --chmod=D755,F644 \
    "$BACKUP/frontend/assets/" "$WEB/assets/"
fi
chown "$DEPLOY_USER:$DEPLOY_GROUP" "$APP" "$APP/apps" "$APP/apps/api" "$WEB"
chmod 0755 "$APP" "$APP/apps" "$APP/apps/api" "$WEB"
runuser -u "$DEPLOY_USER" -- "$VENV_PY" -m pip install \
  -r "$APP/apps/api/requirements.txt" --disable-pip-version-check
systemctl reset-failed "$API_SERVICE" || true
systemctl start "$API_SERVICE"
pe_health 'http://127.0.0.1:8181/api/health' || pe_die 'Rollback started but API unhealthy; inspect journal.'
pe_log 'Code and static frontend restored. Database state was unchanged.'
