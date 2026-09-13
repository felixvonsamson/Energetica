#!/bin/bash
set -euo pipefail

# Energetica — list the game instances on a server.
#
#   ./scripts/list-instances.sh --server <ssh-host>
#
# Canonical source of truth is systemd (energetica-*.service), NOT filesystem globbing of
# /var/www/energetica-* (which would wrongly include the landing dir). The landing site is
# static and has no service, so it never appears here. Port comes from the instance's
# EnvironmentFile, /etc/energetica/{slug}/instance.env — a plain read, no sudo, because the
# deploy user is in the energetica group (#1072). See
# docs/architecture/static-serving-and-deployment.md § Instance discovery.

REMOTE_HOST="${DEPLOY_HOST:-}"
# Never varied across this server's history — hardcoded rather than a configurable
# parameter (YAGNI); the OS account named "deploy" must already exist.
readonly REMOTE_USER="deploy"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
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
    # No instance.env means either an instance provisioned before the port moved there, or a
    # unit that is not a game instance at all (energetica-lobby, energetica-reaper), so the
    # miss is routine and `|| true` says so on the line rather than relying on this snippet
    # happening to run without `set -e`.
    port=$(sed -n "s/^ENERGETICA_PORT=//p" "/etc/energetica/$slug/instance.env" 2>/dev/null | head -1 || true)
    # Those units still carry a literal --port. systemctl reports ExecStart unexpanded, so for a
    # migrated instance this matches nothing and leaves the port unknown rather than wrong.
    [ -n "$port" ] || port=$(systemctl show -p ExecStart --value "$unit" 2>/dev/null | grep -oE -- "--port [0-9]+" | awk "{print \$2}" | head -1 || true)
    echo "$slug|${port:-?}|${state:-unknown}|${enabled:-unknown}"
done
'

ROWS=$(ssh "$SSH" "$REMOTE_SCRIPT")
if [ -z "$ROWS" ]; then
    echo "No energetica-*.service units found on $SSH."
    exit 0
fi

{ echo "INSTANCE|PORT|ACTIVE|ENABLED"; echo "$ROWS"; } | column -t -s '|'
