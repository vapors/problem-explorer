#!/usr/bin/env bash
# Read-only preflight for the established DirectAdmin deployment.
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
pe_require_root
for cmd in rsync unzip node npm runuser systemctl curl namei; do pe_need "$cmd"; done
pe_load_config "$(cd "$SCRIPT_DIR/../.." && pwd)"
pe_validate_live
pe_log "Release config: v$RELEASE_VERSION / $DEPLOY_USER / $DEPLOY_DOMAIN"
pe_log 'Checking service-user access to API and published website.'
runuser -u "$DEPLOY_USER" -- bash -c \
  'cd "$1" && test -r "$2" && test -x "$3"' _ \
  "$APP/apps/api" "$APP/apps/api/app/main.py" "$WEB"
pe_log 'Checking Node and npm are available to siteadmin (not only to root).'
runuser -u "$DEPLOY_USER" -- bash -c 'command -v node && command -v npm && node --version && npm --version' \
  || pe_die 'Node/npm missing from the deploy user PATH; install/configure for siteadmin before deployment.' 
pe_log 'Service:'
systemctl show "$API_SERVICE" -p User -p Group -p WorkingDirectory -p ExecStart --no-pager
pe_log 'API and frontend parent paths:'
namei -l "$APP/apps/api/app/main.py"
if [[ -f "$WEB/index.html" ]]; then namei -l "$WEB/index.html"; fi
pe_log 'Checking Neo4j service:'
systemctl is-active neo4j || pe_die 'Neo4j is not active'
pe_log 'Preflight passed (does not imply frontend build or production integrations passed).'
