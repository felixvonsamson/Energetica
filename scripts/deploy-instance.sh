#!/bin/bash
set -euo pipefail

# shellcheck source=lib/version-stamp.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/version-stamp.sh"
# shellcheck source=lib/backend-wheel.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/backend-wheel.sh"
# shellcheck source=lib/backend-sync.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/backend-sync.sh"

# Energetica — deploy a single instance (Option A: no git on the server, rsync only).
#
#   ./scripts/deploy-instance.sh --server <ssh-host> --instance <instance> --domain <apex> \
#        [--yes] [--skip-build]
#
# Builds the app for the Run mode in the instance's instance.json (frontend/apps/freeplay or
# frontend/apps/workshop) and the backend wheel locally, rsyncs backend/main.py, the wheel and the bundle to
# the instance dir, installs the project into the server-side venv, and restarts the service.
# The install is not optional: the backend lives under backend/src/ and is imported as an installed
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

# The instance vhost must deny the game's data tables at the path this deploy ships them to,
# before they land there. They include the daily quiz answers (#1070), and #1055 moved them from
# src/energetica/static/data/ to src/energetica/freeplay/data/. Deploys never write the vhost (that
# is root's work, see update-instance-vhost.sh), so a vhost rendered from an older template still
# denies the old path. Refuse to deploy until it has been re-rendered. This runs before anything
# is synced, so a refusal leaves the server exactly as it was.
#
# Since #1363, deploys ship no src/ at all, and the sync deletes the copy earlier deploys left. So
# this guards only an instance that still carries that copy, and it can go once every instance
# has been deployed since.
VHOST_FILE="/etc/apache2/sites-available/energetica-$INSTANCE.conf"
DATA_DENY="<Directory \"$REMOTE_PATH/src/energetica/freeplay/data\">"
if ! ssh "$SSH" "grep -qF '$DATA_DENY' '$VHOST_FILE'"; then
    log_error "The vhost does not deny $REMOTE_PATH/src/energetica/freeplay/data (or $VHOST_FILE is unreadable)."
    echo "It predates the data-table move in #1055. Re-render it before deploying:"
    echo "  ./scripts/push-bootstrap.sh --server $REMOTE_HOST"
    echo "  then on $REMOTE_HOST, as root (not as $REMOTE_USER — it has no sudo for this):"
    echo "    sudo bash /tmp/update-instance-vhost.sh $INSTANCE --domain $DOMAIN"
    exit 1
fi

# The run reaches accounts and sessions only through the lobby service (#1283, ADR-0009), on the
# socket instance.env names. instance.env is rendered once by setup-instance.sh and never touched by
# deploys, so an instance set up before #1283 lacks the variable, and the new code would look for a
# dev socket and answer every request that needs an account with a 503. The unit must also want the
# service's socket. instance.env is group-readable by deploy, so this needs no sudo.
ENV_FILE="/etc/energetica/$INSTANCE/instance.env"
if ! ssh "$SSH" "grep -q '^ENERGETICA_LOBBY_SERVICE_SOCKET=' '$ENV_FILE'" \
    || ! ssh "$SSH" "systemctl show --property=Wants energetica-$INSTANCE | grep -q energetica-lobby-service.socket"; then
    log_error "$INSTANCE's instance.env or unit does not know about the lobby service yet."
    echo "Bring both up to date before deploying:"
    echo "  ./scripts/push-bootstrap.sh --server $REMOTE_HOST"
    echo "  then on $REMOTE_HOST, as root (not as $REMOTE_USER — it has no sudo for this):"
    echo "    sudo bash /tmp/update-instance-unit.sh $INSTANCE"
    exit 1
fi

# The instance's instance.json must parse under the backend this deploy ships. The instance reads
# it on every login and fails closed, so a file the new code rejects locks every player out, even
# on a public Run. That is what happens to a file an operator forgot to migrate by hand (#1060
# added the required `run` block). Check it with this checkout's own code, since that is exactly
# what is about to be installed, and before anything is synced, so a refusal changes nothing.
# The file holds the join token, so it is streamed into the check and never written locally.
#
# The same check reads the Run mode (`run.mode`), which picks the app this deploy builds and ships:
# frontend/apps/freeplay for a persistent-world run, frontend/apps/workshop for a Workshop Run.
# Each app is named after the Run mode it serves. The check prints the mode on stdout and its
# reasons for refusing on stderr, so only the mode is captured into RUN_MODE.
#
# The check needs the backend's dependencies (pydantic) on this machine, which building the wheel
# does not. Without them it cannot run, and the deploy refuses with that as the reason rather than
# go ahead unchecked: an unchecked deploy is exactly the one that could lock players out. The
# exit code tells the two failures apart: 1 means the file is invalid, 2 means the check could not
# run.
CONFIG_FILE="/etc/energetica/$INSTANCE/instance.json"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_PYTHON="$REPO_ROOT/.venv/bin/python"
[ -x "$LOCAL_PYTHON" ] || LOCAL_PYTHON="$(command -v python3 || true)"
CHECK_CONFIG='
import sys
try:
    from pydantic import ValidationError
    from energetica.identity.instance_config import InstanceConfig
except ImportError as exc:
    print(f"  {exc}", file=sys.stderr)
    sys.exit(2)
try:
    config = InstanceConfig.model_validate_json(sys.stdin.read())
except ValidationError as exc:
    # include_input=False keeps the values in the file, the join token among them, off the terminal.
    for error in exc.errors(include_input=False):
        print("  " + ".".join(str(part) for part in error["loc"]) + ": " + error["msg"], file=sys.stderr)
    sys.exit(1)
print(config.run.mode)
'
if [ -z "$LOCAL_PYTHON" ]; then
    log_error "No Python found to check $CONFIG_FILE. Create the project venv — see docs/getting-started/installation.md."
    exit 1
fi
if ! CONFIG_JSON="$(ssh "$SSH" "cat '$CONFIG_FILE'")"; then
    log_error "Cannot read $CONFIG_FILE on $REMOTE_HOST. setup-instance.sh writes it; has it run?"
    exit 1
fi
CHECK_STATUS=0
RUN_MODE=$(printf '%s' "$CONFIG_JSON" | PYTHONPATH="$REPO_ROOT/backend/src" "$LOCAL_PYTHON" -c "$CHECK_CONFIG") || CHECK_STATUS=$?
unset CONFIG_JSON
case "$CHECK_STATUS" in
    0) ;;
    1)
        log_error "$CONFIG_FILE is not valid for the backend this deploy ships (reasons above)."
        echo "Fix it on $REMOTE_HOST as root, then deploy again. For a missing run block, see"
        echo "docs/backend/deployment.md § Adding the Run mode to existing instances."
        exit 1
        ;;
    *)
        log_error "Could not check $CONFIG_FILE: $LOCAL_PYTHON cannot import the backend (reason above)."
        echo "The check needs the backend's dependencies. Create the project venv — see"
        echo "docs/getting-started/installation.md — then deploy again. Nothing was changed on the server."
        exit 1
        ;;
esac
# The mode names a directory under frontend/apps/ and is compared with the bundle's stamp below,
# so refuse anything but the two apps an instance can serve rather than build or ship another one.
# These are the modes of RunModeTag in backend/src/energetica/identity/instance_config.py; a new mode needs
# an app, and a line here.
case "$RUN_MODE" in
    freeplay) APP_LABEL="the persistent world's app" ;;
    workshop) APP_LABEL="the Workshop's app" ;;
    *)
        log_error "$CONFIG_FILE has Run mode '$RUN_MODE', which no app in frontend/apps/ serves."
        exit 1
        ;;
esac
APP_DIST="frontend/apps/$RUN_MODE/dist"

# Every build stamps the app it built into build-info.json (buildInfoPlugin in
# frontend/vite.shared.ts). This reads that name from a stamp on stdin, or prints nothing if there
# is no stamp or it names no app. Used twice: on the local build before syncing, and on the bundle
# Apache serves after the restart.
stamped_app() {
    jq -r '.app // empty' 2>/dev/null || true
}

# --- 1. Build -------------------------------------------------------------------
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building $APP_LABEL (Run mode: $RUN_MODE)..."
    # VITE_APEX_DOMAIN bakes the apex into the bundle so cross-origin links resolve:
    # the app's "Learn more" links point back to https://$DOMAIN (the Apache landing),
    # not the instance subdomain. Without it landingHref() falls back to a same-origin
    # relative path, which 404s on the instance vhost (it only serves /app/*).
    ( cd frontend && VITE_APEX_DOMAIN="$DOMAIN" bun run "build:$RUN_MODE" )
    log_success "App bundle built"
else
    log_info "Skipping build (--skip-build)"
fi
# Check the local bundle's stamp before anything is synced, so a missing bundle (say, --skip-build
# with nothing built) changes nothing on the server.
LOCAL_APP=$( { stamped_app < "$APP_DIST/build-info.json"; } 2>/dev/null || true)
if [ "$LOCAL_APP" != "$RUN_MODE" ]; then
    log_error "$APP_DIST/build-info.json names app '${LOCAL_APP:-none}', but $INSTANCE's Run mode is '$RUN_MODE'."
    echo "Build it (drop --skip-build, or run 'bun run build:$RUN_MODE' in frontend/), then deploy again."
    exit 1
fi
build_backend_wheel   # see scripts/lib/backend-wheel.sh for why this is not behind --skip-build

# --- 2. Confirm -----------------------------------------------------------------
echo
log_step "Deployment summary:"
echo "  Instance:  $INSTANCE   (https://$FQDN)"
echo "  App:       $RUN_MODE   ($APP_DIST/ → dist-app/)"
echo "  Remote:    $SSH:$REMOTE_PATH"
echo "  Steps:     rsync backend → rsync app bundle → install backend → restart → health check (API + served app + app shell)"
echo
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- 3. rsync backend code ------------------------------------------------------
# Ships backend/main.py to the top of the instance dir, where the unit runs it, and the wheel built above, which step 5 installs. Nothing
# else: see scripts/lib/backend-sync.sh for the allowlist and for what --delete leaves alone.
sync_backend "$SSH:$REMOTE_PATH" dist-app main.py

# --- 3b. rsync instance-scoped scripts (flattened: scripts/instance/* → scripts/*) --------
log_step "Syncing instance scripts..."
# -rlptz, not -az: -g would copy the local group onto the server dir (see scripts/lib/backend-sync.sh).
rsync -rlptz --delete ./scripts/instance/ "$SSH:$REMOTE_PATH/scripts/" >/dev/null
log_success "Instance scripts synced"

# --- 4. rsync app bundle (hashed assets need pruning → --delete) ---------------
# The bundle is built to frontend/apps/{freeplay,workshop}/dist/ but lands at the instance root as
# dist-app/ whatever the Run mode, the same flattening deploy-lobby.sh does with dist-lobby/: the
# server carries no frontend source, so a frontend/ directory holding nothing but build output
# would be misleading. Both apps land at the same path so that the vhost serves either one
# unchanged. The persistent world's service worker is inside its bundle (the app's build:sw writes
# it there), so it needs no rsync of its own.
# APP_BUNDLE_SUBPATH in backend/src/energetica/freeplay/routers/health.py names this same path.
log_step "Syncing app bundle..."
# -rlptz, not -az: -g would copy the local group onto the server dir (see scripts/lib/backend-sync.sh).
rsync -rlptz --delete "./$APP_DIST/" "$SSH:$REMOTE_PATH/dist-app/" >/dev/null
log_success "App bundle synced"

# --- 5. Install the backend into the server venv --------------------------------
install_backend_wheel "$SSH" "$REMOTE_PATH"

# --- 5b. Stamp the deployed backend version -------------------------------------
# The server has no .git (the deploy ships no source tree), so the commit is captured here on the
# deploy machine and written to the instance root as DEPLOYED_VERSION.json, read by
# backend/src/energetica/kernel/version.py. Written before the restart because the backend also reads it,
# once per process on first use, to name itself in the X-Energetica-Caller header it sends the
# lobby service. If the stamp were written after the restart, a run would name the previous
# deploy's commit until its next restart (#1356). The cost is that /healthz reports the new commit from here on even if
# the restart below fails, but then the deploy fails loudly.
stamp_deployed_version "$SSH" "$REMOTE_PATH"

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
# Three conditions: /healthz is ok, the app loads, and the app Apache serves is the one for this
# Run mode (checked after the loop). Whether the app loads is a separate check from /healthz:
# /healthz proves uvicorn is serving, but it is reached through the
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
        echo "  ssh $SSH 'ls -l $REMOTE_PATH/dist-app/index.html'"
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
# The app Apache serves must be the one for this Run mode. Each app assumes it is on an instance of
# its own mode and nothing checks it at runtime, so this is the only guard against serving the
# wrong app. The stamp is fetched through Apache, the same Alias the app is served from, rather
# than read from /healthz: /healthz reads dist-app/ off disk, which proves what was synced but not
# what a vhost pointing somewhere else would serve. The app has loaded by now, so the answer will
# not change by waiting: check once.
SERVED_APP=$(curl -fsS --max-time 5 "https://$FQDN/static/app/build-info.json" 2>/dev/null | stamped_app || true)
if [ "$SERVED_APP" != "$RUN_MODE" ]; then
    log_error "https://$FQDN/static/app/build-info.json names app '${SERVED_APP:-none}', but $INSTANCE's Run mode is '$RUN_MODE'."
    echo "Players are getting the wrong app. Compare what was synced with what Apache serves:"
    echo "  ssh $SSH 'cat $REMOTE_PATH/dist-app/build-info.json'"
    echo "  ssh $SSH 'grep static /etc/apache2/sites-available/energetica-$INSTANCE.conf'"
    exit 1
fi
log_success "/healthz status=ok, the app and its bundle load, and Apache serves the $RUN_MODE app"

echo
log_success "Deployed $INSTANCE → https://$FQDN"
log_info "Logs: ssh $SSH 'sudo journalctl -u energetica-$INSTANCE -f'"
