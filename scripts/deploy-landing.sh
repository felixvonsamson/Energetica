#!/bin/bash
set -euo pipefail

# Energetica — deploy the apex landing site (pure static, no service restart).
#
#   ./scripts/deploy-landing.sh --server <ssh-host> --domain <apex> \
#        [--user <ssh-user>] [--yes] [--skip-build]
#
# Builds the landing bundle locally and rsyncs it to /var/www/energetica-landing/.
# instances.json and instances/ are owned and written by the instance backends — they are
# excluded from the sync (and from --delete) so a landing deploy never clobbers them.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
DOMAIN="${DEPLOY_DOMAIN:-}"
AUTO_CONFIRM=false
SKIP_BUILD=false
LANDING_DIR=/var/www/energetica-landing

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
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
    # --domain is only needed to bake VITE_APEX_DOMAIN into the build; a --skip-build
    # rsync-only deploy doesn't require it.
    [ -n "$DOMAIN" ] || { log_error "--domain is required for the build (or set DEPLOY_DOMAIN; or pass --skip-build)"; exit 1; }
    log_step "Building landing bundle..."
    # VITE_APEX_DOMAIN bakes the apex into the bundle so instanceSignupHref() emits
    # absolute https://{slug}.$DOMAIN/app/sign-up links to each instance subdomain.
    # Without it the CTA falls back to a same-origin /app/sign-up, which 404s on the
    # pure-static apex vhost.
    ( cd frontend && VITE_APEX_DOMAIN="$DOMAIN" bun run build:landing )
    log_success "Landing bundle built"
fi

if [ "$AUTO_CONFIRM" = false ]; then
    echo
    echo "  Landing → $SSH:$LANDING_DIR/  (instances.json + instances/ preserved)"
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

log_step "Syncing landing files..."
# --delete prunes stale assets, but the excludes are honoured for deletion too, so the
# instance-owned manifest/fragment dir and the separately-synced static/ tree survive.
rsync -az --delete \
    --exclude='instances.json' \
    --exclude='instances/' \
    --exclude='static/' \
    ./frontend/dist-landing/ "$SSH:$LANDING_DIR/" >/dev/null
log_success "Landing bundle deployed"

# rsync -a applies the source dir's mode to $LANDING_DIR itself, stripping the setgid +
# group-write bits setup-landing.sh set (2775). Those bits are load-bearing: the instance
# backends (group energetica) atomically write instances.json *into this dir*, so without
# group-write the aggregate write fails with EPERM — and because the instances/ fragment dir
# is --excluded (keeps its 2775), per-instance fragments still write while the aggregate
# manifest silently goes stale (a new instance never appears in the lobby picker). openrsync
# (macOS) lacks --chmod, so re-assert the mode over ssh after the sync. The deploy user owns
# $LANDING_DIR, so it can restore the setgid bit.
ssh "$SSH" "chmod 2775 '$LANDING_DIR'"
log_success "Landing dir perms re-asserted (2775, setgid energetica)"

# The landing + wiki pages reference /static/images/... (e.g. landing_page banners, wiki
# figures). The apex is pure-static, so unlike the game vhost (which Aliases /static/images
# into the instance code dir) these must be shipped into the landing DocumentRoot itself.
log_step "Syncing landing static images..."
# The landing bundle ships no static/ tree, so pre-create the target path (old client-side
# rsync, e.g. macOS, lacks --mkpath). The deploy user owns $LANDING_DIR (setgid energetica).
ssh "$SSH" "mkdir -p '$LANDING_DIR/static/images'"
rsync -az --delete ./energetica/static/images/ "$SSH:$LANDING_DIR/static/images/" >/dev/null
log_success "Static images deployed"
