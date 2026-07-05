#!/bin/bash
set -euo pipefail

# Energetica — deploy a single instance (Option A: no git on the server, rsync only).
#
#   ./scripts/deploy-instance.sh --server <ssh-host> --instance <instance> --domain <apex> \
#        [--user <ssh-user>] [--yes] [--skip-build] [--skip-deps]
#
# Builds the app bundle locally, rsyncs the Python backend + bundle to the instance dir,
# (re)installs deps into the server-side venv, and restarts the service. On restart the
# instance re-reads /etc/energetica/{instance}/instance.json and re-publishes its landing
# fragment, so admin edits to the policy take effect here.
#
# The first run after setup-instance.sh is what actually STARTS the instance.
# instance.json is admin-owned under /etc/energetica/ and is never touched by deploys.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
INSTANCE=""
DOMAIN="${DEPLOY_DOMAIN:-}"
AUTO_CONFIRM=false
SKIP_BUILD=false
SKIP_DEPS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --instance) INSTANCE="$2"; shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
        --user) REMOTE_USER="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --skip-deps) SKIP_DEPS=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }
log_info()    { echo -e "${BLUE}ℹ $1${NC}"; }

[ -n "$REMOTE_HOST" ] || { log_error "--server is required (or set DEPLOY_HOST)"; exit 1; }
[ -n "$INSTANCE" ]    || { log_error "--instance is required"; exit 1; }
[ -n "$DOMAIN" ]      || { log_error "--domain is required (or set DEPLOY_DOMAIN)"; exit 1; }

# Validate the slug here too: it is interpolated into remote paths and `systemctl`
# commands, so a malformed value would target the wrong path or split the remote command.
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || [ "$INSTANCE" = "landing" ] || [ "$INSTANCE" = "lobby" ]; then
    log_error "Invalid instance slug: '$INSTANCE' (lowercase kebab-case, not 'landing'/'lobby')"
    exit 1
fi

# jq is used locally to parse /healthz. If it is missing the parse would silently yield empty
# output and the health-check loop would burn its full timeout before falsely reporting failure
# on an otherwise-successful deploy — so fail fast and loud here instead.
command -v jq >/dev/null || { log_error "jq is required on this machine (used to parse /healthz). Install it (e.g. 'brew install jq')."; exit 1; }

REMOTE_PATH="/var/www/energetica-$INSTANCE"
FQDN="$INSTANCE.$DOMAIN"
SSH="${REMOTE_USER}@${REMOTE_HOST}"

# No StrictHostKeyChecking override: SSH's default surfaces an unexpected/first-seen host key
# instead of silently trusting it. A host the operator already configured connects without a
# prompt; CI pre-populates known_hosts.
if ! ssh -o ConnectTimeout=5 "$SSH" exit 2>/dev/null; then
    log_error "Cannot SSH to $SSH"
    exit 1
fi

# --- 1. Build -------------------------------------------------------------------
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building app bundle (vite build + service worker)..."
    # VITE_APEX_DOMAIN bakes the apex into the bundle so cross-origin links resolve:
    # the app's "Learn more" links point back to https://$DOMAIN (the Apache landing),
    # not the instance subdomain. Without it landingHref() falls back to a same-origin
    # relative path, which 404s on the instance vhost (it only serves /app/*).
    ( cd frontend && VITE_APEX_DOMAIN="$DOMAIN" bun run build )
    log_success "App bundle built"
else
    log_info "Skipping build (--skip-build)"
fi

# --- 2. Confirm -----------------------------------------------------------------
echo
log_step "Deployment summary:"
echo "  Instance:  $INSTANCE   (https://$FQDN)"
echo "  Remote:    $SSH:$REMOTE_PATH"
echo "  Steps:     rsync backend → rsync app bundle → pip install → restart → health check"
echo
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- 3. rsync backend code ------------------------------------------------------
# Ship the Python backend. Exclude build artifacts, the local venv, the frontend source,
# and — critically — instance/ (server-side game state) and the app bundle dir (synced
# separately with --delete below). --delete prunes removed backend files but never touches
# the excluded paths.
log_step "Syncing backend code..."
rsync -az --delete \
    --exclude='.git' \
    --exclude='.venv' \
    --exclude='instance/' \
    --exclude='frontend' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='energetica/static/app' \
    ./ "$SSH:$REMOTE_PATH/" >/dev/null
log_success "Backend synced"

# --- 4. rsync app bundle (hashed assets need pruning → --delete) ---------------
log_step "Syncing app bundle..."
rsync -az --delete ./energetica/static/app/ "$SSH:$REMOTE_PATH/energetica/static/app/" >/dev/null
log_success "App bundle synced"

# --- 5. Install deps into the server venv --------------------------------------
if [ "$SKIP_DEPS" = false ]; then
    log_step "Installing Python deps into server venv..."
    ssh "$SSH" "sudo -u energetica $REMOTE_PATH/.venv/bin/pip install -q -r $REMOTE_PATH/requirements.txt"
    log_success "Deps installed"
else
    log_info "Skipping deps (--skip-deps)"
fi

# --- 6. Restart (first deploy: starts) -----------------------------------------
log_step "Restarting energetica-$INSTANCE..."
if ! ssh "$SSH" "sudo systemctl restart energetica-$INSTANCE"; then
    log_error "Restart command failed"
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -n 50'"
    exit 1
fi
# `is-active` is a read-only query — no sudo needed (and so not granted in the deploy sudoers).
if ! ssh "$SSH" "systemctl is-active --quiet energetica-$INSTANCE"; then
    log_error "Service failed to start"
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -n 50'"
    exit 1
fi
log_success "Service is running"

# --- 7. Health check ------------------------------------------------------------
log_step "Waiting for /healthz status=ok on https://$FQDN..."
HEALTH_DEADLINE=$(( $(date +%s) + 600 ))
HEALTH_OK=false
while [ "$(date +%s)" -lt "$HEALTH_DEADLINE" ]; do
    HZ=$(curl -fsS --max-time 5 "https://$FQDN/healthz" 2>/dev/null || true)
    if [ -n "$HZ" ]; then
        STATUS=$(echo "$HZ" | jq -r '.status' 2>/dev/null || echo "")
        SCHED_ERRS=$(echo "$HZ" | jq -r '.engine.scheduler_exception_count // 0' 2>/dev/null || echo 0)
        if [ "$STATUS" = "ok" ] && [ "$SCHED_ERRS" = "0" ]; then
            HEALTH_OK=true; break
        elif [ "$SCHED_ERRS" != "0" ]; then
            log_error "Scheduler exception on server (count=$SCHED_ERRS)"
            exit 1
        fi
    fi
    sleep 5
done
[ "$HEALTH_OK" = true ] || { log_error "/healthz did not reach status=ok within 600s"; echo "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -f'"; exit 1; }
log_success "/healthz status=ok"

echo
log_success "Deployed $INSTANCE → https://$FQDN"
log_info "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -f'"
