#!/bin/bash
set -euo pipefail

# Energetica — push the bootstrap infra scripts to a server, ahead of running them.
#
#   ./scripts/push-bootstrap.sh --server <ssh-host>
#
# setup-base.sh, setup-landing.sh, setup-lobby.sh, setup-instance.sh, teardown-instance.sh,
# update-instance-vhost.sh, render-instance-json.sh and reap-instances.sh (plus their
# Apache/systemd/environment templates) live in scripts/infra/, but this is Option A (no git checkout on the server, ever
# — see docs/backend/deployment.md), so there is nothing for the normal deploy-instance.sh /
# deploy-lobby.sh rsync to target before the first instance or the lobby exists. These scripts
# must be delivered by hand.
#
# Destination is /tmp, deliberately not a fixed persistent path: these files are meant to be
# synced immediately before running, then treated as stale. Anyone who needs to run one again
# later should re-sync first rather than trust whatever is still sitting in /tmp.
#
# Flattened (scripts/infra/* → /tmp/*, no /tmp/infra/ nesting), matching the rest of this
# repo's convention that wherever a sysadmin is standing, what they need is directly there.

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

[ -n "$REMOTE_HOST" ] || { echo "✗ --server is required (or set DEPLOY_HOST)"; exit 1; }
SSH="${REMOTE_USER}@${REMOTE_HOST}"

# setup-instance.sh checks its --mode against the Run modes the backend accepts, but the backend
# is not on the server until the first deploy. Ask the local backend instead and push the answer
# alongside the scripts as /tmp/run-modes.
RUN_MODES="$(mktemp)"
trap 'rm -f "$RUN_MODES"' EXIT
echo "→ Listing the Run modes the backend accepts..."
./.venv/bin/python -c 'from energetica.identity.instance_config import run_modes; print("\n".join(run_modes()))' \
    > "$RUN_MODES" || { echo "✗ Could not list Run modes (is .venv set up? see docs/README.md)"; exit 1; }

echo "→ Pushing scripts/infra/ → ${SSH}:/tmp/ (flattened)..."
rsync -az ./scripts/infra/ "${SSH}:/tmp/"
rsync -az --chmod=F644 "$RUN_MODES" "${SSH}:/tmp/run-modes"

echo "✓ Bootstrap scripts are in /tmp on ${REMOTE_HOST}. Run them from there, e.g.:"
echo "    ssh ${SSH}"
echo "    sudo bash /tmp/setup-base.sh"
