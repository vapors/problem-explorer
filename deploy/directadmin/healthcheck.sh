#!/usr/bin/env bash
# Read-only production health verification, with startup retries.
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
pe_load_config "$(cd "$SCRIPT_DIR/../.." && pwd)"
[[ -x "$VENV_PY" ]] || pe_die "Missing $VENV_PY"
pe_health 'http://127.0.0.1:8181/api/health'
pe_health "https://$DEPLOY_DOMAIN/api/health"
curl --silent --show-error --fail --output /dev/null "https://$DEPLOY_DOMAIN/" || pe_die 'Homepage returned non-2xx'
pe_log 'API + homepage reachable. Authenticated UX and data isolation still require browser checks.'
