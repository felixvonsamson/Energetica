#!/bin/bash
# Energetica post-deploy verification.
#
# Hits the *public* domain (not localhost) so it catches Apache/TLS issues that
# a localhost probe would miss. Designed to catch the failure modes that the
# previous /openapi.json poll could not:
#   - replay job crashed in a background thread → ticks frozen but FastAPI 200s
#   - /app/assets/* serving HTML shell instead of 404
#   - 503s from engine.serve_local while replay runs
#
# Usage:
#   ./scripts/verify-deploy.sh <domain> [--ssh-host <host>] [--login]
#
# Env vars:
#   ENERGETICA_TEST_USER   username for login probe (only if --login)
#   ENERGETICA_TEST_PASS   password for login probe (only if --login)
#
# Examples:
#   ./scripts/verify-deploy.sh energetica-game.org --ssh-host energetica-game --login

set -u

DOMAIN="${1:-}"
SSH_HOST=""
DO_LOGIN=false
shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --ssh-host)
            SSH_HOST="$2"
            shift 2
            ;;
        --login)
            DO_LOGIN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./scripts/verify-deploy.sh <domain> [--ssh-host <host>] [--login]"
            exit 2
            ;;
    esac
done

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./scripts/verify-deploy.sh <domain> [--ssh-host <host>] [--login]"
    exit 2
fi

BASE="https://${DOMAIN}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSES=0
FAILS=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSES=$((PASSES + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILS=$((FAILS + 1))
}

note() {
    echo -e "${YELLOW}…${NC} $1"
}

# Check that required tools are present locally.
for tool in curl jq; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Missing required tool: $tool"
        exit 3
    fi
done

# --- 1. /healthz reachable, status=ok, replay not stuck -----------------------
note "GET ${BASE}/healthz"
HEALTHZ_BODY=$(curl -fsS --max-time 10 "${BASE}/healthz" || true)
if [ -z "$HEALTHZ_BODY" ]; then
    fail "/healthz did not return a body (server unreachable or 5xx)"
else
    STATUS=$(echo "$HEALTHZ_BODY" | jq -r .status)
    case "$STATUS" in
        ok)
            pass "/healthz status=ok"
            ;;
        resimulating)
            PROGRESS=$(echo "$HEALTHZ_BODY" | jq -c .resim_progress)
            fail "/healthz status=resimulating (replay still running: $PROGRESS) — deploy not finished"
            ;;
        degraded|loading_actions)
            fail "/healthz status=$STATUS — body: $HEALTHZ_BODY"
            ;;
        *)
            fail "/healthz unknown status='$STATUS' — body: $HEALTHZ_BODY"
            ;;
    esac

    SCHED_ERRS=$(echo "$HEALTHZ_BODY" | jq -r '.engine.scheduler_exception_count // 0')
    if [ "$SCHED_ERRS" -eq 0 ]; then
        pass "scheduler_exception_count=0"
    else
        fail "scheduler_exception_count=${SCHED_ERRS} — check journalctl for tracebacks"
    fi

    INDEX_PRESENT=$(echo "$HEALTHZ_BODY" | jq -r .static_app_index_present)
    if [ "$INDEX_PRESENT" = "true" ]; then
        pass "static_app_index_present=true"
    else
        fail "static_app_index_present=false — frontend build not deployed"
    fi
fi

# --- 2. /sign-up legacy redirect ---------------------------------------------
note "GET ${BASE}/sign-up (expect 301 → /app/sign-up)"
SIGNUP_RESP=$(curl -sS -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 10 "${BASE}/sign-up")
SIGNUP_CODE=$(echo "$SIGNUP_RESP" | awk '{print $1}')
SIGNUP_LOC=$(echo "$SIGNUP_RESP" | awk '{print $2}')
if [ "$SIGNUP_CODE" = "301" ] && [[ "$SIGNUP_LOC" == *"/app/sign-up"* ]]; then
    pass "/sign-up → 301 /app/sign-up"
else
    fail "/sign-up returned ${SIGNUP_CODE} Location=${SIGNUP_LOC}"
fi

# --- 3. /app/ serves SPA shell -----------------------------------------------
note "GET ${BASE}/app/ (expect 200, contains <div id=\"root\">)"
APP_BODY=$(curl -fsS --max-time 10 "${BASE}/app/" || true)
if echo "$APP_BODY" | grep -q '<div id="root">'; then
    pass "/app/ returns SPA shell"
else
    fail "/app/ missing <div id=\"root\"> — got: $(echo "$APP_BODY" | head -c 200)"
fi

# --- 4. Asset URL extracted from index.html serves with correct content-type --
ASSET_PATH=$(echo "$APP_BODY" | grep -oE '/static/app/assets/[^"]+\.js' | head -n1 || true)
if [ -z "$ASSET_PATH" ]; then
    fail "could not extract a JS asset URL from /app/"
else
    note "GET ${BASE}${ASSET_PATH}"
    ASSET_RESP=$(curl -sS -o /dev/null -w "%{http_code} %{content_type}" --max-time 10 "${BASE}${ASSET_PATH}")
    ASSET_CODE=$(echo "$ASSET_RESP" | awk '{print $1}')
    ASSET_CT=$(echo "$ASSET_RESP" | awk '{print $2}')
    if [ "$ASSET_CODE" = "200" ] && [[ "$ASSET_CT" == text/javascript* || "$ASSET_CT" == application/javascript* ]]; then
        pass "asset ${ASSET_PATH} serves as ${ASSET_CT}"
    else
        fail "asset ${ASSET_PATH} returned ${ASSET_CODE} ${ASSET_CT}"
    fi
fi

# --- 5. /app/assets/<missing> returns 404 (regression for PR #791) -----------
note "GET ${BASE}/app/assets/does-not-exist.js (expect 404)"
MISSING_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}/app/assets/does-not-exist.js")
if [ "$MISSING_CODE" = "404" ]; then
    pass "/app/assets/<missing> returns 404"
else
    fail "/app/assets/<missing> returned ${MISSING_CODE} — should be 404, not the HTML shell"
fi

# --- 6. /api/v1/players unauth requires auth ---------------------------------
note "GET ${BASE}/api/v1/players unauthenticated (expect 401/403, not 200)"
PLAYERS_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}/api/v1/players")
case "$PLAYERS_CODE" in
    401|403)
        pass "/api/v1/players unauth → ${PLAYERS_CODE}"
        ;;
    303)
        # The log_action middleware rewrites 401 to a 303 → /app/login for browser GETs.
        pass "/api/v1/players unauth → 303 (middleware redirect to /app/login)"
        ;;
    200)
        fail "/api/v1/players unauth returned 200 — endpoint is PUBLIC, expected auth required"
        ;;
    *)
        fail "/api/v1/players unauth returned ${PLAYERS_CODE} (expected 401/403/303)"
        ;;
esac

# --- 7. Login probe (optional) -----------------------------------------------
if [ "$DO_LOGIN" = true ]; then
    if [ -z "${ENERGETICA_TEST_USER:-}" ] || [ -z "${ENERGETICA_TEST_PASS:-}" ]; then
        fail "--login passed but ENERGETICA_TEST_USER / ENERGETICA_TEST_PASS not set"
    else
        note "POST ${BASE}/api/v1/auth/login (expect 200)"
        LOGIN_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
            -X POST "${BASE}/api/v1/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"${ENERGETICA_TEST_USER}\",\"password\":\"${ENERGETICA_TEST_PASS}\"}")
        if [ "$LOGIN_CODE" = "200" ]; then
            pass "auth/login → 200"
        else
            fail "auth/login returned ${LOGIN_CODE} — ticks may be frozen or creds wrong"
        fi
    fi
fi

# --- 8. Tick advancement — the honest "is the game alive" check ---------------
note "Polling total_t for 30s (must increment — replay-job-died canary)"
T_START=$(echo "$HEALTHZ_BODY" | jq -r '.engine.total_t // 0' 2>/dev/null || echo 0)
sleep 30
HEALTHZ_BODY_2=$(curl -fsS --max-time 10 "${BASE}/healthz" || true)
T_END=$(echo "$HEALTHZ_BODY_2" | jq -r '.engine.total_t // 0' 2>/dev/null || echo 0)
if [ "$T_END" -gt "$T_START" ]; then
    pass "total_t advanced ${T_START} → ${T_END} over 30s"
else
    fail "total_t stuck at ${T_END} over 30s — replay job likely crashed; check journalctl"
fi

# --- 9. Scheduler exceptions in journalctl (only if we can SSH) ---------------
if [ -n "$SSH_HOST" ]; then
    note "Checking journalctl on ${SSH_HOST} for scheduler exceptions over last 5 minutes"
    JOURNAL_ERRS=$(ssh "$SSH_HOST" "sudo journalctl -u energetica --since '5 minutes ago' 2>/dev/null | grep -cE 'Traceback|Error in job|apscheduler.*error'" || echo "0")
    if [ "$JOURNAL_ERRS" = "0" ]; then
        pass "no scheduler exceptions in journalctl (last 5m)"
    else
        fail "${JOURNAL_ERRS} scheduler exception(s) in journalctl (last 5m) — ssh ${SSH_HOST} 'sudo journalctl -u energetica -n 100'"
    fi
fi

# --- Summary -----------------------------------------------------------------
echo ""
if [ "$FAILS" -eq 0 ]; then
    echo -e "${GREEN}All ${PASSES} checks passed.${NC}"
    exit 0
else
    echo -e "${RED}${FAILS} check(s) failed${NC} (${PASSES} passed)."
    exit 1
fi
