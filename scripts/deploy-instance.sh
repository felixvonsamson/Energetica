#!/bin/bash
set -euo pipefail

# shellcheck source=lib/version-stamp.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/version-stamp.sh"
# shellcheck source=lib/backend-wheel.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/backend-wheel.sh"

# Energetica — deploy a single instance (Option A: no git on the server, rsync only).
#
#   ./scripts/deploy-instance.sh --server <ssh-host> --instance <instance> --domain <apex> \
#        [--yes] [--skip-build]
#
# Builds the app bundle and the backend wheel locally, rsyncs the Python backend + bundle to
# the instance dir, installs the project into the server-side venv, and restarts the service.
# The install is not optional: the backend lives under src/ and is imported as an installed
# package, so a deploy that skips it leaves the service unable to start. On restart the
# instance re-reads /etc/energetica/{instance}/instance.json and re-publishes its landing
# fragment, so admin edits to the policy take effect here.
#
# The first run after setup-instance.sh is what actually STARTS the instance.
# instance.json is admin-owned under /etc/energetica/ and is never touched by deploys.

REMOTE_HOST="${DEPLOY_HOST:-}"
# Never varied across this server's history — hardcoded rather than a configurable
# parameter (YAGNI); the OS account named "deploy" must already exist.
readonly REMOTE_USER="deploy"
INSTANCE=""
DOMAIN="${DEPLOY_DOMAIN:-}"
AUTO_CONFIRM=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --instance) INSTANCE="$2"; shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
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
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || [ "$INSTANCE" = "landing" ] || [ "$INSTANCE" = "lobby" ]; then
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
    ( cd frontend && VITE_APEX_DOMAIN="$DOMAIN" bun run build:app )
    log_success "App bundle built"
else
    log_info "Skipping build (--skip-build)"
fi
build_backend_wheel   # see scripts/lib/backend-wheel.sh for why this is not behind --skip-build

# --- 2. Confirm -----------------------------------------------------------------
echo
log_step "Deployment summary:"
echo "  Instance:  $INSTANCE   (https://$FQDN)"
echo "  Remote:    $SSH:$REMOTE_PATH"
echo "  Steps:     rsync backend → rsync app bundle → install backend → restart → health check (API + app shell)"
echo
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- 3. rsync backend code ------------------------------------------------------
# Ship the Python backend, including dist/ — the wheel built above rides along with the rest of
# the tree and is installed in step 5. Exclude local build artifacts, the local venv, the
# frontend source, and — critically — instance/ and checkpoints/ (server-side game state) and
# the app bundle dir (synced separately with --delete below). --delete prunes removed backend
# files, including any stale wheel in dist/, but never touches the excluded paths. checkpoints/
# MUST be excluded: the service (user
# `energetica`) writes checkpoints/{new,last}_checkpoint.tar.gz at runtime, but rsync arrives
# as `deploy` — shipping the dir hands it to deploy:deploy and the service can no longer
# overwrite it (silent PermissionError on every checkpoint), same reasoning as instance/.
#
# scripts/ is excluded here and synced separately (step 3b): only scripts/instance/ belongs
# in an instance dir (grant-facilitator.py/whitelist-run.py are lobby-only; scripts/dev/,
# scripts/lib/, scripts/infra/, scripts/*.ts never need to touch the server at all).
log_step "Syncing backend code..."
rsync -az --delete \
    --exclude='.git' \
    --exclude='.venv' \
    --exclude='instance/' \
    --exclude='checkpoints/' \
    --exclude='frontend' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='src/energetica/static/app' \
    --exclude='*.egg-info' \
    --exclude='build/' \
    --exclude='DEPLOYED_VERSION.json' \
    --exclude='scripts' \
    ./ "$SSH:$REMOTE_PATH/" >/dev/null
log_success "Backend synced"

# --- 3b. rsync instance-scoped scripts (flattened: scripts/instance/* → scripts/*) --------
log_step "Syncing instance scripts..."
rsync -az --delete ./scripts/instance/ "$SSH:$REMOTE_PATH/scripts/" >/dev/null
log_success "Instance scripts synced"

# --- 4. rsync app bundle (hashed assets need pruning → --delete) ---------------
log_step "Syncing app bundle..."
rsync -az --delete ./src/energetica/static/app/ "$SSH:$REMOTE_PATH/src/energetica/static/app/" >/dev/null
log_success "App bundle synced"

# --- 5. Install the backend into the server venv --------------------------------
install_backend_wheel "$SSH" "$REMOTE_PATH"

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
# Two conditions, not one. /healthz proves uvicorn is serving, but it is reached through the
# ProxyPass — it says nothing about the Alias directives that serve the app bundle off disk. A
# vhost pointing at the wrong path leaves the API perfectly healthy while every player gets a
# 404 for the app itself, which is a deploy that "succeeded" and broke the site. So whether the
# app actually loads is checked too, the same way deploy-lobby.sh already probes its own SPA.

# Sets APP_DETAIL to the reason on failure, for the error message below.
APP_DETAIL=""
app_is_served() {
    local shell code asset asset_code
    # /app/ rather than the index.html behind it: that is the route a player lands on (the bare
    # root redirects to it), and it exercises DocumentRoot and the SPA FallbackResource as well
    # as the Alias. A wrong Alias path makes the fallback target unresolvable, so this 404s.
    shell=$(curl -s --max-time 5 -w '\n%{http_code}' "https://$FQDN/app/" 2>/dev/null || true)
    code=$(printf '%s' "$shell" | tail -n1 || true)
    if [ "$code" != "200" ]; then
        APP_DETAIL="/app/ returned '$code'"
        return 1
    fi
    # The shell names its own hashed bundle, so fetch one. Serving the shell only proves the
    # fallback resolves; it does not prove the hashed assets beside it are readable — a bundle
    # rsynced under a restrictive umask gives Apache files it cannot read, which is a 403 on
    # every asset behind a 200 on the shell (the same failure deploy-lobby.sh guards against).
    # Apache deliberately does NOT mask a missing asset with the shell, so a 404 here is real.
    asset=$(printf '%s' "$shell" | grep -o '/static/app/assets/[A-Za-z0-9._-]*\.js' | head -n1 || true)
    if [ -z "$asset" ]; then
        APP_DETAIL="/app/ returned 200 but the shell references no hashed bundle (stale or truncated index.html)"
        return 1
    fi
    asset_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$FQDN$asset" 2>/dev/null || true)
    if [ "$asset_code" != "200" ]; then
        APP_DETAIL="the app shell loads but its bundle $asset returned '$asset_code'"
        return 1
    fi
    return 0
}

log_step "Waiting for /healthz status=ok and the app to load on https://$FQDN..."
HEALTH_DEADLINE=$(( $(date +%s) + 600 ))
HEALTH_OK=false
HEALTH_STATUS=""
while [ "$(date +%s)" -lt "$HEALTH_DEADLINE" ]; do
    HZ=$(curl -fsS --max-time 5 "https://$FQDN/healthz" 2>/dev/null || true)
    if [ -n "$HZ" ]; then
        HEALTH_STATUS=$(echo "$HZ" | jq -r '.status' 2>/dev/null || echo "")
        SCHED_ERRS=$(echo "$HZ" | jq -r '.engine.scheduler_exception_count // 0' 2>/dev/null || echo 0)
        if [ "$SCHED_ERRS" != "0" ]; then
            log_error "Scheduler exception on server (count=$SCHED_ERRS)"
            exit 1
        fi
        if [ "$HEALTH_STATUS" = "ok" ] && app_is_served; then
            HEALTH_OK=true; break
        fi
    fi
    sleep 5
done
if [ "$HEALTH_OK" != true ]; then
    if [ "$HEALTH_STATUS" = "ok" ]; then
        # The backend is fine and Apache is not serving the app — almost always the vhost.
        log_error "/healthz is ok but the app does not load: $APP_DETAIL (gave up after 600s)."
        echo "Apache serves the app bundle off disk via the Alias directives in the instance vhost."
        echo "Check they match where the bundle now lives, and that Apache can read it:"
        echo "  ssh $SSH 'grep static /etc/apache2/sites-available/energetica-$INSTANCE.conf'"
        echo "  ssh $SSH 'ls -l $REMOTE_PATH/src/energetica/static/app/index.html'"
        # Deploys never write the vhost, on purpose (that is root's work, not the deploy user's
        # — see update-instance-vhost.sh), so a vhost left behind by a change to the template is
        # re-rendered by hand, and this is where an operator finds that out.
        echo "If the vhost predates a change to scripts/infra/apache-instance.conf, re-render it:"
        echo "  ./scripts/push-bootstrap.sh --server $REMOTE_HOST"
        echo "  then on $REMOTE_HOST, as root (not as $REMOTE_USER — it has no sudo for this):"
        echo "    sudo bash /tmp/update-instance-vhost.sh $INSTANCE --domain $DOMAIN"
    else
        log_error "/healthz did not reach status=ok within 600s (last status: '${HEALTH_STATUS:-unreachable}')"
        echo "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -f'"
    fi
    exit 1
fi
log_success "/healthz status=ok, app and its bundle load"

# --- 8. Stamp the deployed backend version -------------------------------------
# Written only now — after the new process is confirmed serving — so /healthz never reports a
# commit that failed to activate. The server has no .git (rsync excludes it), so the commit is
# captured here on the deploy machine and written to the instance root as DEPLOYED_VERSION.json.
# It is excluded from the rsync --delete above, so between restart and this write /healthz keeps
# reporting the *previous* commit rather than a wrong one. Read by src/energetica/utils/version.py.
stamp_deployed_version "$SSH" "$REMOTE_PATH"

echo
log_success "Deployed $INSTANCE → https://$FQDN"
log_info "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -f'"
