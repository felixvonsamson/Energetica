#!/bin/bash
set -euo pipefail

# Energetica — deploy the lobby service (backend + SPA bundle, rsync only, no git).
#
#   ./scripts/deploy-lobby.sh --server <ssh-host> --domain <apex> \
#        [--user <ssh-user>] [--yes] [--skip-build] [--skip-deps]
#
# Builds the lobby bundle locally, rsyncs the Python backend + dist-lobby to
# /var/www/energetica-lobby, (re)installs deps into the server venv, restarts the
# service, and health-checks the live vhost.
#
# HARD PRECONDITION (checked before anything ships): the instance_membership table must
# exist in the server-wide accounts.db — i.e. Phase A (write-on-settle + backfill) is
# live on the box. Deploying the lobby before it means every existing player sees ZERO
# runs with no error (docs/architecture/lobby.md § Phasing), so this refuses, not warns.
#
# The first run after setup-lobby.sh is what actually STARTS the lobby.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
DOMAIN="${DEPLOY_DOMAIN:-}"
AUTO_CONFIRM=false
SKIP_BUILD=false
SKIP_DEPS=false
REMOTE_PATH=/var/www/energetica-lobby

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
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
[ -n "$DOMAIN" ]      || { log_error "--domain is required (or set DEPLOY_DOMAIN)"; exit 1; }

FQDN="lobby.$DOMAIN"
SSH="${REMOTE_USER}@${REMOTE_HOST}"

# No StrictHostKeyChecking override: SSH's default surfaces an unexpected/first-seen host key
# instead of silently trusting it (CI pre-populates known_hosts).
if ! ssh -o ConnectTimeout=5 "$SSH" exit 2>/dev/null; then
    log_error "Cannot SSH to $SSH"
    exit 1
fi

# --- 1. Deploy precondition: Phase A backfill is live ----------------------------
# Read-only sqlite check, run as the service user (the only non-root reader of
# accounts.db; setup-lobby.sh grants exactly this). ANY failure — missing table,
# missing db, missing sudo grant — refuses the deploy: an unverifiable precondition
# is treated as an unmet one.
log_step "Checking deploy precondition (instance_membership table in accounts.db)..."
if ! ssh "$SSH" 'sudo -u energetica python3 -c '\''
import sqlite3, sys
try:
    conn = sqlite3.connect("file:/var/lib/energetica/accounts.db?mode=ro", uri=True)
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?",
        ("table", "instance_membership"),
    ).fetchone()
except Exception as exc:
    print(f"cannot read accounts.db: {exc}", file=sys.stderr)
    sys.exit(2)
sys.exit(0 if row else 1)
'\'''; then
    log_error "instance_membership is not present in /var/lib/energetica/accounts.db (or it could not be verified)."
    echo "Phase A must be deployed first: its write-on-settle code creates the table and"
    echo "scripts/backfill-instance-membership.py backfills existing players. Without it the"
    echo "lobby would show every existing player zero runs, silently. Refusing to deploy."
    exit 1
fi
log_success "Phase A precondition met"

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

# --- 3. Confirm --------------------------------------------------------------------
echo
log_step "Deployment summary:"
echo "  Lobby:   https://$FQDN"
echo "  Remote:  $SSH:$REMOTE_PATH"
echo "  Steps:   rsync backend → rsync lobby bundle → pip install → restart → health check"
echo
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- 4. rsync backend code ----------------------------------------------------------
# Ship the Python backend (energetica/ + lobby/ + main_lobby.py). Same exclusions as
# deploy-instance.sh, plus dist-lobby (synced separately with --delete below).
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
    --exclude='dist-lobby/' \
    ./ "$SSH:$REMOTE_PATH/" >/dev/null
log_success "Backend synced"

# --- 5. rsync lobby bundle (hashed assets need pruning → --delete) ------------------
log_step "Syncing lobby bundle..."
rsync -az --delete ./frontend/dist-lobby/ "$SSH:$REMOTE_PATH/dist-lobby/" >/dev/null
log_success "Lobby bundle synced"

# --- 6. Install deps into the server venv -------------------------------------------
if [ "$SKIP_DEPS" = false ]; then
    log_step "Installing Python deps into server venv..."
    ssh "$SSH" "sudo -u energetica $REMOTE_PATH/.venv/bin/pip install -q -r $REMOTE_PATH/requirements.txt"
    log_success "Deps installed"
else
    log_info "Skipping deps (--skip-deps)"
fi

# --- 7. Restart (first deploy: starts) -----------------------------------------------
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
log_success "Service is running"

# --- 8. Health check ------------------------------------------------------------------
# The lobby exposes no /healthz; an unauthenticated my-runs returning 401 proves the whole
# chain (Apache vhost → proxy → uvicorn → accounts.db read path) is up, and the SPA shell
# returning 200 proves the bundle is served.
log_step "Waiting for https://$FQDN to answer..."
HEALTH_DEADLINE=$(( $(date +%s) + 120 ))
HEALTH_OK=false
while [ "$(date +%s)" -lt "$HEALTH_DEADLINE" ]; do
    API_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$FQDN/api/v1/lobby/my-runs" || true)
    SPA_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$FQDN/" || true)
    if [ "$API_CODE" = "401" ] && [ "$SPA_CODE" = "200" ]; then
        HEALTH_OK=true; break
    fi
    sleep 5
done
[ "$HEALTH_OK" = true ] || { log_error "lobby did not become healthy within 120s (api=$API_CODE spa=$SPA_CODE)"; echo "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby -f'"; exit 1; }
log_success "Lobby healthy (api 401 unauthenticated, SPA 200)"

echo
log_success "Deployed lobby → https://$FQDN"
log_info "Logs: ssh $SSH 'sudo journalctl -u energetica-lobby -f'"
