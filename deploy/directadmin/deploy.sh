#!/usr/bin/env bash
# Deploy a trusted release ZIP or extracted release directory on the established VPS.
# Invocation (as root): bash deploy/directadmin/deploy.sh /home/siteadmin/releases/Problem-Explorer-vX.Y.Z[.W].zip
# For the first install of the tool: unpack the release ZIP and invoke this script there, with its directory as argument.
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
pe_require_root
for cmd in rsync unzip systemctl runuser curl npm node mktemp; do pe_need "$cmd"; done

[[ $# -eq 1 ]] || pe_die 'Usage: sudo bash deploy/directadmin/deploy.sh RELEASE.zip|EXTRACTED_RELEASE_DIR'
INPUT=$1
[[ -f "$INPUT" || -d "$INPUT" ]] || pe_die "Release archive/directory not found: $INPUT"

# Isolate extraction from build. Extraction is never performed into the live app.
ROOT_TMP=$(mktemp -d /tmp/pe-release-XXXXXXXX)
trap 'rm -rf -- "$ROOT_TMP"' EXIT
if [[ -f "$INPUT" ]]; then
  case "$INPUT" in *.zip) ;; *) pe_die 'Expected a .zip file' ;; esac
  unzip -q "$INPUT" -d "$ROOT_TMP/incoming"
  SRC="$ROOT_TMP/incoming"
else
  SRC=$(cd -- "$INPUT" && pwd)
fi
[[ -f "$SRC/apps/web/package.json" && -f "$SRC/apps/api/requirements.txt" ]] \
  || pe_die 'ZIP must contain apps/web and apps/api at the archive root (no extra folder).'
[[ -s "$SRC/data/problems.csv" ]] \
  || pe_die 'Release is missing data/problems.csv (reference dataset required by offline tests). Repackage the release; do not reset or reseed production data.'
pe_load_config "$SRC"
pe_validate_live

pe_log "Preparing v$RELEASE_VERSION for $DEPLOY_DOMAIN as $DEPLOY_USER"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0750 "$RELEASES" "$BACKUPS"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BUILD=$(mktemp -d "$RELEASES/.pe-build-v${RELEASE_VERSION}-${STAMP}-XXXXXXXX")
chown "$DEPLOY_USER:$DEPLOY_GROUP" "$BUILD"
chmod 0750 "$BUILD"
# Unpack/copy as root, but normalize ownership/modes BEFORE running npm or Python.
pe_rsync_source "$SRC" "$BUILD"
pe_log 'Checking Node and npm are available to the deploy user.'
runuser -u "$DEPLOY_USER" -- bash -c 'command -v node && command -v npm'

pe_log 'Testing backend contracts with the existing Python 3.12 venv (non-destructive).'
runuser -u "$DEPLOY_USER" -- bash -c \
  'cd "$1" && "$2" -m unittest discover -s tests -v' _ "$BUILD" "$VENV_PY"
pe_log 'Installing frontend dependencies and building as the deploy user.'
runuser -u "$DEPLOY_USER" -- bash -c '
  set -Eeuo pipefail
  cd "$1/apps/web"
  export npm_config_cache="$1/.npm-cache"
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  npm run test:lenses
  npm run test:graph
  npm run test:concepts
  npm run test:tooltips
  npm run test:publication
  npm run test:onboarding
  npm run test:research-ux
  npm run test:graph-intelligence
  npm run test:badge-layout
  npm run test:ux-v099
  npm run test:ux-v0991
  npm run build
' _ "$BUILD"
[[ -s "$BUILD/apps/web/dist/index.html" ]] || pe_die 'Vite produced no index.html'

# A code/static rollback snapshot, not a database backup.
BACKUP="$BACKUPS/v${RELEASE_VERSION}-predeploy-${STAMP}"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0700 "$BACKUP/code" "$BACKUP/frontend"
pe_log "Saving rollback snapshot: $BACKUP"
pe_rsync_source "$APP" "$BACKUP/code"
[[ ! -f "$WEB/index.html" ]] || rsync -a --chown="$DEPLOY_USER:$DEPLOY_GROUP" \
  "$WEB/index.html" "$BACKUP/frontend/index.html"
if [[ -d "$WEB/assets" ]]; then
  rsync -a --chown="$DEPLOY_USER:$DEPLOY_GROUP" "$WEB/assets/" "$BACKUP/frontend/assets/"
fi
printf '%s\n' "$BACKUP" > "$BACKUPS/latest-code-backup.txt"
chown "$DEPLOY_USER:$DEPLOY_GROUP" "$BACKUPS/latest-code-backup.txt"
chmod 0600 "$BACKUPS/latest-code-backup.txt"

pe_log 'Checking existing virtualenv requirements as the deploy user (no global pip).'
runuser -u "$DEPLOY_USER" -- "$VENV_PY" -m pip install \
  -r "$BUILD/apps/api/requirements.txt" --disable-pip-version-check
runuser -u "$DEPLOY_USER" -- "$VENV_PY" -m pip check

# If a copy/publish command fails after the service stops, preserve the exact snapshot
# and provide a recovery instruction rather than silently leaving an ambiguous state.
trap 'printf "[Problem Explorer] FAILURE: inspect logs, then restore code with: sudo bash %s/deploy/directadmin/rollback.sh %s\n" "$APP" "$BACKUP" >&2' ERR
pe_log 'Stopping FastAPI (Neo4j remains running).' 
systemctl stop "$API_SERVICE"
pe_log 'Publishing app source (explicit ownership; credentials and DB excluded).'
pe_rsync_source "$BUILD" "$APP"
# Enforce the ownership and traversal of the known API ancestors that caused 200/CHDIR.
chown "$DEPLOY_USER:$DEPLOY_GROUP" "$APP" "$APP/apps" "$APP/apps/api"
chmod 0755 "$APP" "$APP/apps" "$APP/apps/api"

pe_log 'Publishing only Vite dist output; preserving other DirectAdmin public_html content.'
# The domain document root must be searchable by the webserver. Do not change its parents.
chown "$DEPLOY_USER:$DEPLOY_GROUP" "$WEB"
chmod 0755 "$WEB"
rsync -a --chown="$DEPLOY_USER:$DEPLOY_GROUP" --chmod=D755,F644 \
  --exclude='.htaccess' --exclude='cgi-bin/' --exclude='.well-known/' \
  "$BUILD/apps/web/dist/" "$WEB/"

pe_log 'Starting FastAPI and checking local and public endpoints.'
systemctl reset-failed "$API_SERVICE" || true
systemctl start "$API_SERVICE"
if ! pe_health 'http://127.0.0.1:8181/api/health'; then
  pe_log "DEPLOYMENT NOT HEALTHY. Restore with: sudo bash $APP/deploy/directadmin/rollback.sh '$BACKUP'"
  pe_die 'Local API health check failed; see journalctl -u problem-explorer.service. Backup preserved.'
fi
if ! pe_health "https://$DEPLOY_DOMAIN/api/health"; then
  pe_log 'Local API is working, but public proxy health failed. Do not change Nginx blindly.'
  pe_die 'Check HTTPS proxy and vhost health. No database changes were made.'
fi
if ! curl --silent --show-error --fail --retry 3 --retry-delay 2 \
  --output /dev/null "https://$DEPLOY_DOMAIN/"; then
  pe_log 'Public homepage returned an error; inspect DirectAdmin Apache permissions and logs.'
  pe_die 'Deployment needs attention; rollback snapshot preserved.'
fi
pe_log "DEPLOYED v$RELEASE_VERSION. Backup: $BACKUP"
rm -rf -- "$BUILD"
pe_log 'Temporary build workspace cleaned after successful health checks.' 
pe_log 'No database bootstrap, reset, seed, migrations or DirectAdmin vhost changes were executed.'
