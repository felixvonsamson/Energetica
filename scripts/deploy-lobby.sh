#!/bin/bash
set -euo pipefail

# shellcheck source=lib/version-stamp.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/version-stamp.sh"
# shellcheck source=lib/backend-wheel.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/backend-wheel.sh"

# Energetica — deploy the lobby service (backend + SPA bundle, rsync only, no git).
#
#   ./scripts/deploy-lobby.sh --server <ssh-host> --domain <apex> \
#        [--yes] [--skip-build]
#
# Builds the lobby bundle and the backend wheel locally, rsyncs the Python backend +
# dist-lobby to /var/www/energetica-lobby, installs the project into the server venv,
# restarts both lobby processes, and health-checks them. The install is not optional:
# the backend lives under src/ and is imported as an installed package, so a deploy that
# skips it leaves the services unable to start.
#
# The lobby is two processes from the one checkout (ADR-0009): the lobby service
# (energetica-lobby-service, which owns lobby.db and runs its schema migrations when it
# starts) and the lobby backend (energetica-lobby, the public web app). The service restarts
# first. Its socket stays open across the restart, so runs and the lobby backend wait for it
# rather than fail.
#
# The first run after setup-lobby.sh is what actually STARTS the lobby backend.

REMOTE_HOST="${DEPLOY_HOST:-}"
# Never varied across this server's history — hardcoded rather than a configurable
# parameter (YAGNI); the OS account named "deploy" must already exist.
readonly REMOTE_USER="deploy"
DOMAIN="${DEPLOY_DOMAIN:-}"
AUTO_CONFIRM=false
SKIP_BUILD=false
REMOTE_PATH=/var/www/energetica-lobby

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
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
[ -n "$DOMAIN" ]      || { log_error "--domain is required (or set DEPLOY_DOMAIN)"; exit 1; }

FQDN="lobby.$DOMAIN"
SSH="${REMOTE_USER}@${REMOTE_HOST}"

# No StrictHostKeyChecking override: SSH's default surfaces an unexpected/first-seen host key
# instead of silently trusting it (CI pre-populates known_hosts).
if ! ssh -o ConnectTimeout=5 "$SSH" exit 2>/dev/null; then
    log_error "Cannot SSH to $SSH"
    exit 1
fi

# --- 1. Deploy precondition: the lobby service units are installed ----------------
# setup-base.sh installs them. A box provisioned before the lobby service existed needs a re-run.
log_step "Checking that the lobby service socket is installed..."
if ! ssh "$SSH" "systemctl is-enabled --quiet energetica-lobby-service.socket"; then
    log_error "energetica-lobby-service.socket is not enabled on the server."
    echo "Re-run setup-base.sh on the server (it is idempotent), then deploy again."
    exit 1
fi
log_success "Lobby service socket installed"

# The lobby service runs as its own user and keeps lobby.db and the signing secret in a private
# dir (#1284). setup-base.sh creates both and moves accounts.db there; a box set up before needs a
# re-run. Deploying first would leave the database readable by every run.
log_step "Checking that the lobby service runs as its own user..."
if [ "$(ssh "$SSH" "systemctl show --property=User --value energetica-lobby-service")" != "energetica-lobby-service" ]; then
    log_error "energetica-lobby-service does not run as the energetica-lobby-service user."
    echo "Re-run setup-base.sh on the server (it is idempotent; see docs/backend/deployment.md), then deploy again."
    exit 1
fi
log_success "Lobby service runs as its own user"

# setup-lobby.sh renders the lobby backend's unit, and only a unit rendered since the lobby service
# existed tells the backend where the service's socket is. Without it the new backend looks for a
# dev socket and answers every login with a 503. Re-running setup-lobby.sh re-renders the unit.
log_step "Checking that the lobby backend's unit knows the lobby service socket..."
if ! ssh "$SSH" "systemctl show --property=Environment energetica-lobby | grep -q ENERGETICA_LOBBY_SERVICE_SOCKET="; then
    log_error "energetica-lobby.service does not set ENERGETICA_LOBBY_SERVICE_SOCKET."
    echo "Re-run setup-lobby.sh on the server (it is idempotent) to install the current unit, then deploy again."
    exit 1
fi
log_success "Lobby backend unit is current"

# --- 2. Build ---------------------------------------------------------------------
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building lobby bundle..."
    # No VITE_APEX_DOMAIN here: the lobby derives the apex from its own hostname at
    # runtime (frontend/src/lib/lobby.ts), so the bundle is domain-agnostic.
    ( cd frontend && bun run build:lobby )
    log_success "Lobby bundle built"
else
    log_info "Skipping build (--skip-build)"
fi
build_backend_wheel   # see scripts/lib/backend-wheel.sh for why this is not behind --skip-build

# --- 3. Confirm --------------------------------------------------------------------
echo
log_step "Deployment summary:"
echo "  Lobby:   https://$FQDN"
echo "  Remote:  $SSH:$REMOTE_PATH"
echo "  Steps:   rsync backend → rsync lobby bundle → install backend → restart lobby service → restart lobby backend → health check"
echo
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- 4. rsync backend code ----------------------------------------------------------
# Ship the Python backend (src/energetica/ + src/lobby/ + main_lobby.py) and dist/, which
# holds the wheel built above and installed in step 6. Same exclusions as deploy-instance.sh,
# except that the bundle protected from --delete here is dist-lobby/ rather than dist-app/
# (both are synced separately with --delete below, in their respective scripts).
#
# scripts/ is excluded here and synced separately (step 4b): only scripts/lobby/ belongs
# in the lobby dir (export_instance_to_csv.py is instance-only; scripts/dev/, scripts/lib/,
# scripts/infra/, scripts/*.ts never need to touch the server at all).
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
    --exclude='*.egg-info' \
    --exclude='build/' \
    --exclude='dist-lobby/' \
    --exclude='DEPLOYED_VERSION.json' \
    --exclude='scripts' \
    ./ "$SSH:$REMOTE_PATH/" >/dev/null
log_success "Backend synced"

# --- 4b. rsync lobby-scoped scripts (flattened: scripts/lobby/* → scripts/*) --------------
log_step "Syncing lobby scripts..."
rsync -az --delete ./scripts/lobby/ "$SSH:$REMOTE_PATH/scripts/" >/dev/null
log_success "Lobby scripts synced"

# --- 5. rsync lobby bundle (hashed assets need pruning → --delete) ------------------
log_step "Syncing lobby bundle..."
# Apache reads the bundle via the energetica group (the tree is 2750 deploy:energetica), and
# `rsync -a` preserves permissions — a restrictive local umask would otherwise ship files
# www-data cannot read (SPA 403s after an apparently successful deploy). rsync's --chmod would
# fix perms during transfer, but macOS ships openrsync, which rejects it ("--chmod: invalid
# argument"). So normalise the *local* bundle first and let `rsync -a` carry those perms across
# in a single pass: dirs 755, files 644 (u=rwX gives dirs +x, files stay non-exec). Doing it
# locally rather than as a second server-side chmod keeps the transfer atomic — there is no
# window where Apache serves a just-rsynced file with the wrong perms. World bits are moot —
# others cannot traverse the root.
chmod -R u=rwX,g=rX,o=rX ./frontend/dist-lobby
rsync -az --delete ./frontend/dist-lobby/ "$SSH:$REMOTE_PATH/dist-lobby/" >/dev/null
log_success "Lobby bundle synced"

# --- 6. Install the backend into the server venv --------------------------------------
install_backend_wheel "$SSH" "$REMOTE_PATH"

# --- 6b. Stamp the deployed backend version ----------------------------------------
# The server has no .git (rsync excludes it), so the commit is captured here on the deploy machine
# and written as DEPLOYED_VERSION.json, read by src/energetica/kernel/version.py. Both lobby
# processes run from this checkout and report this stamp. Written before the restarts because the
# lobby backend also reads it, once per process on first use, to name itself in the
# X-Energetica-Caller header it sends the lobby service. If the stamp were written after the
# restarts, the lobby backend would name the previous deploy's commit until its next restart
# (#1356). The cost is that /healthz reports
# the new commit from here on even if a restart below fails, but then the deploy fails loudly.
stamp_deployed_version "$SSH" "$REMOTE_PATH"

# --- 7. Restart the lobby service, then check it over its socket -------------------
# It runs pending schema migrations before serving, so a failed migration shows up here as a
# service that does not stay up. The deploy user is in the energetica group, so it may connect.
log_step "Restarting energetica-lobby-service (runs pending migrations)..."
if ! ssh "$SSH" "sudo systemctl restart energetica-lobby-service"; then
    log_error "Restart command failed"
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby-service -n 50'"
    exit 1
fi
SERVICE_HEALTH=$(ssh "$SSH" "curl -s --max-time 30 --unix-socket /run/energetica/lobby-service.sock http://lobby-service/internal/v1/healthz" || true)
if ! echo "$SERVICE_HEALTH" | grep -q '"status":"ok"'; then
    log_error "lobby service is not healthy: ${SERVICE_HEALTH:-no answer}"
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby-service -n 50'"
    exit 1
fi
log_success "Lobby service healthy: $SERVICE_HEALTH"

# --- 7b. Restart the lobby backend (first deploy: starts) ----------------------------
log_step "Restarting energetica-lobby..."
if ! ssh "$SSH" "sudo systemctl restart energetica-lobby"; then
    log_error "Restart command failed"
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby -n 50'"
    exit 1
fi
if ! ssh "$SSH" "systemctl is-active --quiet energetica-lobby"; then
    log_error "Service failed to start"
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby -n 50'"
    exit 1
fi
log_success "Lobby backend is running"

# --- 8. Health check ------------------------------------------------------------------
# /healthz exists (and is now proxied — see apache-lobby.conf) but only reports the
# already-stamped commit, not whether the just-deployed code is actually serving
# correctly, so four probes cover that chain instead:
#   - SPA shell 200 → Apache serves the bundle;
#   - unauthenticated my-runs 401 → vhost → proxy → uvicorn wiring is up;
#   - login with a nonexistent user → 401 USER_NOT_FOUND proves the lobby backend reaches
#     the lobby service and the service reads lobby.db (my-runs alone rejects at the
#     cookie check, before calling the service, so it cannot prove that — a broken path
#     answers 503 or 500 here). The probe username is 22 chars, above signup's 18-char
#     cap, so it can never be a real account.
#   - instances.json 200 → the manifest Alias off the landing dir serves the picker's
#     "open runs". Every instance deployment publishes the manifest, so on a box with a
#     run a 404/403 means the Alias or the file's permissions are broken.
log_step "Waiting for https://$FQDN to answer..."
HEALTH_DEADLINE=$(( $(date +%s) + 120 ))
HEALTH_OK=false
while [ "$(date +%s)" -lt "$HEALTH_DEADLINE" ]; do
    SPA_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$FQDN/" || true)
    API_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$FQDN/api/v1/lobby/my-runs" || true)
    MANIFEST_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$FQDN/instances.json" || true)
    LOGIN_BODY=$(curl -s --max-time 5 -H 'Content-Type: application/json' \
        -d '{"username":"__deploy_healthcheck__","password":"deploy-probe"}' \
        "https://$FQDN/api/v1/auth/login" || true)
    if [ "$SPA_CODE" = "200" ] && [ "$API_CODE" = "401" ] && [ "$MANIFEST_CODE" = "200" ] \
        && echo "$LOGIN_BODY" | grep -q "USER_NOT_FOUND"; then
        HEALTH_OK=true; break
    fi
    sleep 5
done
if [ "$HEALTH_OK" != true ]; then
    log_error "lobby did not become healthy within 120s (spa=$SPA_CODE my-runs=$API_CODE manifest=$MANIFEST_CODE login=$LOGIN_BODY)"
    [ "$MANIFEST_CODE" = "200" ] || echo "instances.json is published by each instance backend on startup — if missing, restart an instance; if it 403s, check its permissions in /var/www/energetica-landing/."
    echo "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby -f' (and -u energetica-lobby-service)"
    exit 1
fi
log_success "Lobby healthy (SPA 200, my-runs 401, manifest 200, lobby service reachable)"

echo
log_success "Deployed lobby → https://$FQDN"
log_info "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby -f'"
