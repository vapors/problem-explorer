#!/usr/bin/env bash
# Common paths and safety helpers. Source from deployment scripts; never deploy alone.
set -Eeuo pipefail

pe_log() { printf '[Problem Explorer] %s\n' "$*"; }
pe_die() { printf '[Problem Explorer] ERROR: %s\n' "$*" >&2; exit 1; }
pe_require_root() { [[ $(id -u) -eq 0 ]] || pe_die 'Run this script as root (sudo bash ...).'; }
pe_need() { command -v "$1" >/dev/null 2>&1 || pe_die "Required command missing: $1"; }

pe_load_config() {
  local root=$1
  [[ -f "$root/deploy/release.env" ]] || pe_die "Missing $root/deploy/release.env"
  # Only run trusted releases created by you. Do not use untrusted ZIP archives.
  # shellcheck disable=SC1090
  source "$root/deploy/release.env"
<<<<<<< HEAD
  [[ ${RELEASE_VERSION:-} =~ ^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || pe_die 'RELEASE_VERSION must be like X.Y.Z or X.Y.Z.W'
=======
  [[ ${RELEASE_VERSION:-} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || pe_die 'RELEASE_VERSION must be like 0.8.1'
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
  [[ ${DEPLOY_USER:-} =~ ^[a-z_][a-z0-9_-]*$ ]] || pe_die 'Invalid DEPLOY_USER'
  [[ ${DEPLOY_DOMAIN:-} =~ ^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$ ]] || pe_die 'Invalid DEPLOY_DOMAIN'
  [[ ${API_SERVICE:-} =~ ^[a-zA-Z0-9_.@-]+$ ]] || pe_die 'Invalid API_SERVICE'
  DEPLOY_GROUP=$(id -gn "$DEPLOY_USER") || pe_die "User does not exist: $DEPLOY_USER"
  HOME_DIR=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
  [[ -n "$HOME_DIR" && -d "$HOME_DIR" ]] || pe_die 'Cannot resolve deploy user home directory'
  APP="$HOME_DIR/domains/$DEPLOY_DOMAIN/problem-explorer"
  WEB="$HOME_DIR/domains/$DEPLOY_DOMAIN/public_html"
  RELEASES="$HOME_DIR/releases"
  BACKUPS="$HOME_DIR/problem-explorer-backups"
  VENV_PY="$APP/apps/api/.venv/bin/python"
}

pe_validate_live() {
  [[ -d "$APP/apps/api/app" && -d "$WEB" ]] || pe_die "Existing application or public_html missing: $APP / $WEB"
  [[ -f "$APP/.env" ]] || pe_die "Production .env missing ($APP/.env); refusing to deploy"
  [[ -f "$WEB/index.html" ]] || pe_die "Public index.html missing ($WEB/index.html); safe rollback snapshot unavailable"
  [[ -x "$VENV_PY" ]] || pe_die "Existing Python 3.12 virtualenv missing: $VENV_PY"
  "$VENV_PY" -c 'import sys; assert sys.version_info[:2] == (3,12), sys.version' \
    || pe_die 'Existing API virtualenv must use Python 3.12'
  local user work
  user=$(systemctl show "$API_SERVICE" -p User --value)
  work=$(systemctl show "$API_SERVICE" -p WorkingDirectory --value)
  [[ "$user" == "$DEPLOY_USER" ]] || pe_die "Service runs as $user; expected $DEPLOY_USER"
  [[ "$work" == "$APP/apps/api" ]] || pe_die "Service working directory differs: $work"
}

pe_rsync_source() {
  # Not --delete. Never copy credentials/databases/venvs from either release or backup.
  rsync -a --chown="$DEPLOY_USER:$DEPLOY_GROUP" --chmod=D755,F644 \
    --include='/.env.example' --exclude='**/.env*' \
    --exclude='/.git/' --exclude='/.testvenv/' --exclude='/.build/' \
    --exclude='/.npm-cache/' --exclude='**/.npm/' \
    --exclude='/apps/api/.venv/' --exclude='/apps/api/data/' \
    --exclude='/apps/web/node_modules/' --exclude='/apps/web/dist/' \
    --exclude='__pycache__/' --exclude='*.pyc' \
    --exclude='*.sqlite3' --exclude='*.sqlite3-*' \
    --exclude='*.dump' --exclude='*.log' \
    "$1/" "$2/"
}

pe_health() {
  local url=$1
  # curl --retry alone can retry transient connection errors, but JSON/HTTP validation follows.
  local response
  response=$(curl --silent --show-error --fail --retry 12 --retry-connrefused --retry-delay 2 \
    --connect-timeout 3 --max-time 12 "$url") || return 1
  printf '%s' "$response" | "$VENV_PY" -c \
    'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True and d.get("neo4j") is True, d' \
    || return 1
  pe_log "Healthy: $url"
}
