#!/bin/bash
set -euo pipefail

# Energetica — deploy the apex landing site (pure static, no service restart).
#
#   ./scripts/deploy-landing.sh --server <ssh-host> [--user <ssh-user>] [--yes] [--skip-build]
#
# Builds the landing bundle locally and rsyncs it to /var/www/energetica-landing/.
# instances.json and instances/ are owned and written by the instance backends — they are
# excluded from the sync (and from --delete) so a landing deploy never clobbers them.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
AUTO_CONFIRM=false
SKIP_BUILD=false
LANDING_DIR=/var/www/energetica-landing

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --user) REMOTE_USER="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }

[ -n "$REMOTE_HOST" ] || { log_error "--server is required (or set DEPLOY_HOST)"; exit 1; }
SSH="${REMOTE_USER}@${REMOTE_HOST}"

# No StrictHostKeyChecking override: SSH's default surfaces an unexpected/first-seen host key
# instead of silently trusting it (CI pre-populates known_hosts).
if ! ssh -o ConnectTimeout=5 "$SSH" exit 2>/dev/null; then
    log_error "Cannot SSH to $SSH"; exit 1
fi

if [ "$SKIP_BUILD" = false ]; then
    log_step "Building landing bundle..."
    ( cd frontend && bun run build:landing )
    log_success "Landing bundle built"
fi

if [ "$AUTO_CONFIRM" = false ]; then
    echo
    echo "  Landing → $SSH:$LANDING_DIR/  (instances.json + instances/ preserved)"
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

log_step "Syncing landing files..."
# --delete prunes stale assets, but the two excludes are honoured for deletion too, so the
# instance-owned manifest and fragment dir survive.
rsync -az --delete \
    --exclude='instances.json' \
    --exclude='instances/' \
    ./frontend/dist-landing/ "$SSH:$LANDING_DIR/" >/dev/null
log_success "Landing deployed"
