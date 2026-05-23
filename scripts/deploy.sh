#!/bin/bash
set -e

# Energetica Deployment Script
# This script safely deploys changes to the production VPS
# Usage: ./scripts/deploy.sh [OPTIONS]
#
# Options:
#   --force              Allow deployment with uncommitted local changes (use with caution)
#   --yes                Skip confirmation prompt
#   --skip-backend       Skip git sync and service restart (frontend-only deployment)
#   --skip-frontend-build Skip building frontend locally (for backend-only changes)
#   --rm_instance        Remove the instance folder on the server before deploying (DESTRUCTIVE)
#
# Environment variables (skip interactive prompts):
#   DEPLOY_HOST          SSH host alias (e.g. energetica-game or energetica-edu)
#   DEPLOY_USER          SSH user (default: deploy)
#   DEPLOY_DOMAIN        Domain name (e.g. energetica-game.org)

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
REMOTE_PATH="/var/www/energetica"
DOMAIN="${DEPLOY_DOMAIN:-}"
LOCAL_BUILT_FRONTEND="./energetica/static/app"
ALLOW_DIRTY=false
AUTO_CONFIRM=false
SKIP_BACKEND=false
SKIP_FRONTEND_BUILD=false
RM_INSTANCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            ALLOW_DIRTY=true
            shift
            ;;
        --yes)
            AUTO_CONFIRM=true
            shift
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            shift
            ;;
        --skip-frontend-build)
            SKIP_FRONTEND_BUILD=true
            shift
            ;;
        --rm_instance)
            RM_INSTANCE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./scripts/deploy.sh [OPTIONS]"
            echo "Options: --force, --yes, --skip-backend, --skip-frontend-build, --rm_instance"
            exit 1
            ;;
    esac
done

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Colour

# Helper functions
log_step() {
    echo -e "${YELLOW}→ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Select target server if not provided via environment variables
if [ -z "$REMOTE_HOST" ] || [ -z "$DOMAIN" ]; then
    echo ""
    echo -e "${BLUE}Select deployment target:${NC}"
    echo ""
    PS3="Target: "
    select CHOICE in \
        "energetica-game  →  energetica-game.org" \
        "energetica-edu   →  energetica-edu.org"; do
        case $REPLY in
            1) REMOTE_HOST="${DEPLOY_HOST:-energetica-game}"; DOMAIN="${DEPLOY_DOMAIN:-energetica-game.org}"; break ;;
            2) REMOTE_HOST="${DEPLOY_HOST:-energetica-edu}";  DOMAIN="${DEPLOY_DOMAIN:-energetica-edu.org}";  break ;;
            *) echo -e "${RED}Invalid selection. Please try again.${NC}" ;;
        esac
    done
    echo ""
    log_success "Target: $REMOTE_HOST ($DOMAIN)"
fi

# Verify SSH host is reachable
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "exit" 2>/dev/null; then
    log_error "Cannot connect to ${REMOTE_HOST}"
    echo ""
    echo "Make sure your SSH config includes:"
    echo "  Host ${REMOTE_HOST}"
    echo "      HostName <your-vps-domain-or-ip>"
    echo "      User ${REMOTE_USER}"
    echo ""
    echo "Or set environment variables:"
    echo "  export DEPLOY_HOST=<hostname>"
    echo "  export DEPLOY_USER=<username>"
    exit 1
fi

# Main deployment flow
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Energetica Production Deployment     ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    # Step 1: Build frontend (unless skipped)
    if [ "$SKIP_FRONTEND_BUILD" = false ]; then
        log_step "Building frontend..."
        cd frontend
        bun run build
        BUILD_EXIT_CODE=$?
        cd ..

        if [ $BUILD_EXIT_CODE -ne 0 ]; then
            log_error "Frontend build failed"
            exit 1
        fi
        log_success "Frontend built successfully"
        echo ""
    else
        log_info "Skipping frontend build (--skip-frontend-build)"
        echo ""
    fi

    # Step 2: Check git status
    log_step "Checking git status..."
    DIRTY_STATUS=$(git status --porcelain)
    if [ -n "$DIRTY_STATUS" ]; then
        if [ "$ALLOW_DIRTY" = false ]; then
            log_error "Uncommitted changes found in local repository"
            git status
            echo ""
            echo "You can deploy anyway with: ./scripts/deploy.sh --force"
            exit 1
        else
            log_info "⚠ Deploying with uncommitted local changes:"
            git status --short
            echo ""
        fi
    fi

    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    CURRENT_COMMIT_FULL=$(git rev-parse HEAD)
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    if [ -z "$DIRTY_STATUS" ]; then
        log_success "Repository clean"
    fi
    log_info "Branch: $CURRENT_BRANCH"
    log_info "Commit: $CURRENT_COMMIT"
    echo ""

    # Step 3: Confirm deployment
    log_step "Deployment summary:"
    echo "  Repository:    ${CURRENT_BRANCH} (${CURRENT_COMMIT})"
    echo "  Domain:        https://$DOMAIN"
    echo "  Remote:        ${REMOTE_HOST}:${REMOTE_PATH}"
    echo ""
    echo "This will:"
    if [ "$SKIP_BACKEND" = false ]; then
        if [ "$RM_INSTANCE" = true ]; then
            echo "  0. ⚠  Remove instance folder on the server (rm -r instance)"
        fi
        echo "  1. Verify commits are pushed to remote"
        echo "  2. Pull latest code on VPS"
        echo "  3. Sync frontend files via rsync"
        echo "  4. Restart the game server (~10-30s downtime)"
    else
        if [ "$RM_INSTANCE" = true ]; then
            echo "  0. ⚠  Remove instance folder on the server (rm -r instance)"
        fi
        echo "  1. Sync frontend files via rsync only"
        echo "     (no git sync, no service restart)"
    fi
    echo ""

    if [ "$RM_INSTANCE" = true ]; then
        echo -e "${RED}WARNING: --rm_instance will permanently delete the instance folder on the server.${NC}"
        echo -e "${RED}All game data (saves, databases, logs) will be lost. This cannot be undone.${NC}"
        echo ""
        if true; then
            read -p "Type \"wipe\" to confirm: " WIPE_CONFIRM
            echo
            if [ "$WIPE_CONFIRM" != "wipe" ]; then
                echo "Not confirmed. Deployment cancelled."
                exit 0
            fi
            echo ""
        fi
    fi

    if [ "$AUTO_CONFIRM" = false ]; then
        read -p "Continue? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Deployment cancelled."
            exit 0
        fi
        echo ""
    fi

    # Step 4: Verify code is pushed (skip if skip-backend)
    if [ "$SKIP_BACKEND" = false ]; then
        log_step "Checking if code is pushed..."
        git fetch origin > /dev/null 2>&1
        REMOTE_COMMIT_FULL=$(git rev-parse origin/${CURRENT_BRANCH} 2>/dev/null || echo "")

        if [ "$CURRENT_COMMIT_FULL" != "$REMOTE_COMMIT_FULL" ]; then
            log_error "Local commits are not pushed to remote"
            echo ""
            echo "Push your changes first: git push origin ${CURRENT_BRANCH}"
            exit 1
        fi
        log_success "Code is pushed to remote"
        echo ""

        # Step 5: Sync code on remote (fetch + reset to match origin exactly)
        log_step "Syncing code on remote..."
        ssh "${REMOTE_USER}@${REMOTE_HOST}" "sudo -u www-data git -C ${REMOTE_PATH} fetch origin ${CURRENT_BRANCH} && sudo -u www-data git -C ${REMOTE_PATH} reset --hard origin/${CURRENT_BRANCH}" > /dev/null
        log_success "Code updated on VPS"
        echo ""
    fi

    # Step 6 (optional): Remove instance folder
    if [ "$RM_INSTANCE" = true ]; then
        log_step "Removing instance folder on server..."
        ssh "${REMOTE_USER}@${REMOTE_HOST}" "sudo -u www-data rm -r ${REMOTE_PATH}/instance"
        log_success "Instance folder removed"
        echo ""
    fi

    # Step 7: Sync frontend files
    log_step "Syncing frontend files..."
    rsync -avz --delete "$LOCAL_BUILT_FRONTEND/" "${REMOTE_HOST}:${REMOTE_PATH}/energetica/static/app/" > /dev/null 2>&1
    rsync -avz "./energetica/static/service-worker.js" "${REMOTE_HOST}:${REMOTE_PATH}/energetica/static/service-worker.js" > /dev/null 2>&1
    log_success "Frontend synced"
    echo ""

    # Step 8: Restart backend service (skip if skip-backend)
    if [ "$SKIP_BACKEND" = false ]; then
        log_step "Restarting game server..."
        ssh "${REMOTE_USER}@${REMOTE_HOST}" "sudo systemctl restart energetica"
        sleep 1
        echo ""

        # Step 8: Verify service is running
        log_step "Verifying service is running..."
        if ! ssh "${REMOTE_USER}@${REMOTE_HOST}" "sudo systemctl is-active --quiet energetica"; then
            log_error "Service failed to start"
            echo "Check logs with: ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo journalctl -u energetica -n 50'"
            exit 1
        fi
        log_success "Service is running"
        echo ""

        # Step 9: Wait for /healthz to be reachable and report status=ok.
        # During cold start the actions-history parse blocks port bind for minutes,
        # and the replay job can run for minutes more before serve_local flips false.
        # Keep polling until status=ok, scheduler errors >0, or we hit the deadline.
        log_step "Waiting for /healthz status=ok on https://${DOMAIN}..."
        HEALTH_TIMEOUT_SECONDS=600
        HEALTH_POLL_INTERVAL=5
        HEALTH_DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
        HEALTH_OK=false
        while [ "$(date +%s)" -lt "$HEALTH_DEADLINE" ]; do
            HZ=$(curl -fsS --max-time 5 "https://${DOMAIN}/healthz" 2>/dev/null || true)
            if [ -n "$HZ" ]; then
                STATUS=$(echo "$HZ" | jq -r .status 2>/dev/null || echo "")
                SCHED_ERRS=$(echo "$HZ" | jq -r '.engine.scheduler_exception_count // 0' 2>/dev/null || echo 0)
                if [ "$STATUS" = "ok" ] && [ "$SCHED_ERRS" = "0" ]; then
                    HEALTH_OK=true
                    break
                elif [ "$SCHED_ERRS" != "0" ]; then
                    log_error "Scheduler exception detected on server (count=${SCHED_ERRS})"
                    echo "Check logs: ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo journalctl -u energetica -n 200'"
                    exit 1
                elif [ "$STATUS" = "resimulating" ]; then
                    PROGRESS=$(echo "$HZ" | jq -c .resim_progress 2>/dev/null || echo "")
                    echo "  …replay in progress: ${PROGRESS}"
                fi
            fi
            sleep $HEALTH_POLL_INTERVAL
        done

        if [ "$HEALTH_OK" = false ]; then
            log_error "/healthz did not reach status=ok within ${HEALTH_TIMEOUT_SECONDS}s"
            echo "Check logs: ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo journalctl -u energetica -f'"
            exit 1
        fi
        log_success "/healthz status=ok"
        echo ""

        # Step 10: Full post-deploy verification (tick advancement is the honest check).
        log_step "Running scripts/verify-deploy.sh ${DOMAIN}..."
        if ! ./scripts/verify-deploy.sh "${DOMAIN}" --ssh-host "${REMOTE_HOST}"; then
            log_error "Post-deploy verification failed"
            exit 1
        fi
        log_success "Post-deploy verification passed"
        echo ""
    fi

    # Success!
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✓ Deployment Complete!               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    log_info "Site: https://$DOMAIN"
    log_info "Logs: ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo journalctl -u energetica -f'"
    log_info "To rollback: ./scripts/rollback.sh"
    echo ""
}

# Run main
main "$@"
