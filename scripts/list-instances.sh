#!/bin/bash
set -euo pipefail

# Energetica — list the game instances on a server.
#
#   ./scripts/list-instances.sh --server <ssh-host> [--user <ssh-user>]
#
# Canonical source of truth is systemd (energetica-*.service), NOT filesystem globbing of
# /var/www/energetica-* (which would wrongly include the landing dir). The landing site is
# static and has no service, so it never appears here. Port is read from each unit's
# ExecStart --port. See docs/architecture/static-serving-and-deployment.md § Instance discovery.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --user) REMOTE_USER="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

[ -n "$REMOTE_HOST" ] || { echo "--server is required (or set DEPLOY_HOST)" >&2; exit 1; }
SSH="${REMOTE_USER}@${REMOTE_HOST}"

# Remote: enumerate energetica-*.service unit files and report slug/port/active/enabled.
REMOTE_SCRIPT='
for unit in $(systemctl list-unit-files --no-legend "energetica-*.service" | awk "{print \$1}" | grep "^energetica-.*\.service$"); do
    slug=${unit#energetica-}; slug=${slug%.service}
    state=$(systemctl is-active "$unit" 2>/dev/null || true)
    enabled=$(systemctl is-enabled "$unit" 2>/dev/null || true)
    port=$(systemctl show -p ExecStart --value "$unit" 2>/dev/null | grep -oE -- "--port [0-9]+" | awk "{print \$2}" | head -1)
    echo "$slug|${port:-?}|${state:-unknown}|${enabled:-unknown}"
done
'

ROWS=$(ssh "$SSH" "$REMOTE_SCRIPT")
if [ -z "$ROWS" ]; then
    echo "No energetica-*.service units found on $SSH."
    exit 0
fi

{ echo "INSTANCE|PORT|ACTIVE|ENABLED"; echo "$ROWS"; } | column -t -s '|'
