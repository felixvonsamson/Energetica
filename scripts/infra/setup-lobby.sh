#!/bin/bash
set -euo pipefail

# Energetica — provision the lobby service (server-wide SSO + instance picker). Run ONCE
# per VPS, as root, AFTER setup-base.sh and setup-landing.sh.
#
#   sudo bash scripts/infra/setup-lobby.sh --domain <apex-domain> \
#        [--port 8001] [--deploy-user <user>] [--yes]
#
# Creates the lobby dir + venv, the Apache vhost (lobby.{apex}) + TLS, and the
# energetica-lobby.service unit (enabled, NOT started). Like setup-instance.sh it ships
# no code — the first ./scripts/deploy-lobby.sh rsyncs the backend + bundle and starts
# the service.
#
# Requires DNS for lobby.{apex-domain} to already resolve here (for TLS issuance), and
# the shared secret + server.json from setup-base.sh (re-run it first on a box that
# predates them — it is idempotent).

DOMAIN="${ENERGETICA_DOMAIN:-}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
PORT=8001
AUTO_CONFIRM=false
APP_DIR=/var/www/energetica-lobby
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --port) PORT="$2"; shift 2 ;;
        --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        *) echo "Unknown option: $1"; echo "Usage: sudo bash setup-lobby.sh --domain <apex-domain> [--port 8001] [--deploy-user <user>] [--yes]"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }
log_section() { echo; echo -e "${BLUE}━━━ $1 ━━━${NC}"; }

[ "$EUID" -eq 0 ] || { log_error "Must run as root"; exit 1; }
[ -n "$DOMAIN" ] || { log_error "--domain is required"; exit 1; }
# Restrict to a real hostname: guarantees no sed-metachar reaches the vhost substitution, and
# rejects typos that would otherwise only surface as a certbot/Apache failure later.
if ! [[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
    log_error "Invalid domain: '$DOMAIN' (expected a hostname like energetica-game.org)"
    exit 1
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    log_error "Port must be an integer 1024-65535: '$PORT'"
    exit 1
fi
getent group energetica >/dev/null || { log_error "group 'energetica' missing — run setup-base.sh first"; exit 1; }
[ -d /var/www/energetica-landing/instances ] || { log_error "landing not set up — run setup-landing.sh first"; exit 1; }
# The lobby signs the parent-domain cookie with the shared secret and gates signup on
# server.json — both provisioned by setup-base.sh. A box set up before they existed needs
# a (idempotent) re-run, so fail here with that pointer rather than starting a lobby that
# cannot mint sessions / never accepts signups.
[ -s /var/lib/energetica/secret_key.txt ] || { log_error "shared secret missing — re-run setup-base.sh first"; exit 1; }
[ -f /etc/energetica/server.json ] || { log_error "/etc/energetica/server.json missing — re-run setup-base.sh first"; exit 1; }

FQDN="lobby.$DOMAIN"
VHOST=/etc/apache2/sites-available/energetica-lobby.conf
UNIT=/etc/systemd/system/energetica-lobby.service

# The port must be exclusively the lobby's. A collision with an instance would be
# insidious: the lobby unit crash-loops on bind while Apache proxies lobby.{apex}/api to
# the *instance* backend — which also answers /api/v1/lobby/my-runs with a 401, so even
# the deploy health check would pass against the wrong app and SSO would silently never
# work. Check the rendered units (source of truth) and — unless the listener is our own
# already-provisioned lobby (re-run) — the live sockets.
PORT_CONFLICT="$(grep -lE -- "--port $PORT( |\$)" /etc/systemd/system/energetica-*.service 2>/dev/null | grep -v '/energetica-lobby\.service$' || true)"
if [ -n "$PORT_CONFLICT" ]; then
    log_error "Port $PORT is already claimed by: $PORT_CONFLICT — pass a free --port"
    exit 1
fi
if [ ! -f "$UNIT" ] && ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q .; then
    log_error "Port $PORT is already listening on this host — pass a free --port"
    exit 1
fi

log_section "PROVISION LOBBY (port $PORT, $FQDN)"
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "DNS for $FQDN points here? Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- Directories + venv -----------------------------------------------------------
log_section "DIRECTORIES & VENV"
# Lobby dir: deploy (owner) rsyncs code + bundle; the service and Apache (group
# energetica, via setgid) read it. 2750 = rwx owner, r-x group, none world.
install -d -o "$DEPLOY_USER" -g energetica -m 2750 "$APP_DIR"
log_success "$APP_DIR (code + bundle, deploy-owned)"

if [ -x "$APP_DIR/.venv/bin/python" ]; then
    log_success "venv already present at $APP_DIR/.venv"
else
    log_step "Creating venv (populated by first deploy)..."
    # Same least-privilege dance as setup-instance.sh: the venv is owned by the service
    # user (which runs `sudo -u energetica pip install` during deploys) inside the
    # deploy-owned code dir.
    install -d -o energetica -g energetica -m 0750 "$APP_DIR/.venv"
    sudo -u energetica python3 -m venv "$APP_DIR/.venv"
    log_success "venv at $APP_DIR/.venv"
fi

# --- Deploy-precondition sudo grant ------------------------------------------------
log_section "DEPLOY SUDOERS"
# deploy-lobby.sh hard-refuses to deploy while Phase A's instance_membership backfill has
# not run (else the lobby would silently show every existing player zero runs), and only
# the service user can read /var/lib/energetica/accounts.db — so the deploy user needs to
# run that one read-only python check as energetica. `python3 -c *` as energetica grants
# nothing the base pip rule doesn't already imply (pip installs execute arbitrary code as
# energetica), and stays scoped to the service account — never root.
SUDOERS_FILE=/etc/sudoers.d/energetica-deploy-lobby
cat > "$SUDOERS_FILE" <<EOF
$DEPLOY_USER ALL=(energetica) NOPASSWD: /usr/bin/python3 -c *, /bin/python3 -c *
EOF
chmod 440 "$SUDOERS_FILE"
if visudo -cf "$SUDOERS_FILE" >/dev/null; then
    log_success "Configured passwordless sudo for $DEPLOY_USER (python3 -c as energetica)"
else
    rm -f "$SUDOERS_FILE"
    log_error "sudoers syntax invalid — removed $SUDOERS_FILE; deploy-lobby.sh's precondition check will fail closed"
fi

# --- Temporary HTTP vhost for ACME -------------------------------------------------
log_section "TLS PROVISIONING"
if [ -f "/etc/letsencrypt/live/$FQDN/fullchain.pem" ]; then
    # Don't touch the vhost when the cert is already there: on a re-run the live HTTPS
    # vhost would otherwise be clobbered by the bare HTTP one and a mid-script failure
    # (certbot rate limit, configtest) would leave the lobby down and $APP_DIR exposed
    # over plain HTTP until an operator restores it. The full vhost is rendered below
    # either way.
    log_success "Certificate for $FQDN already exists — skipping issuance"
else
    log_step "Writing temporary HTTP vhost for certbot..."
    cat > "$VHOST" <<EOF
<VirtualHost *:80>
    ServerName $FQDN
    DocumentRoot $APP_DIR
</VirtualHost>
EOF
    a2ensite energetica-lobby >/dev/null
    systemctl reload apache2
    log_step "Obtaining certificate via webroot..."
    certbot certonly --webroot -w "$APP_DIR" -d "$FQDN" --non-interactive --agree-tos --register-unsafely-without-email
    log_success "Certificate obtained"
fi

# --- Full vhost ---------------------------------------------------------------------
log_section "LOBBY VHOST"
sed -e "s/@DOMAIN@/$DOMAIN/g" \
    -e "s/@PORT@/$PORT/g" \
    "$SCRIPT_DIR/apache-lobby.conf" > "$VHOST"
a2ensite energetica-lobby >/dev/null
apache2ctl configtest
systemctl reload apache2
log_success "Vhost active: https://$FQDN"

# --- systemd unit (enabled, not started — no code yet) ------------------------------
log_section "SYSTEMD UNIT"
sed -e "s/@DOMAIN@/$DOMAIN/g" \
    -e "s/@PORT@/$PORT/g" \
    "$SCRIPT_DIR/energetica-lobby.service" > "$UNIT"
systemctl daemon-reload
systemctl enable energetica-lobby >/dev/null
log_success "energetica-lobby.service enabled (not started)"

log_section "LOBBY PROVISIONED"
echo "Ship code and start the service from your machine:"
echo "  ./scripts/deploy-lobby.sh --server <ssh-host> --domain $DOMAIN"
echo
echo "Deploy precondition: Phase A (instance_membership table + backfill) must already be"
echo "live in /var/lib/energetica/accounts.db — deploy-lobby.sh refuses otherwise."
