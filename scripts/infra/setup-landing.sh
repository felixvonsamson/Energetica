#!/bin/bash
set -euo pipefail

# Energetica — apex landing site setup. Run ONCE per VPS, as root, AFTER setup-base.sh.
#
#   sudo bash scripts/infra/setup-landing.sh --domain <apex-domain> [--deploy-user <user>] [--yes]
#
# Creates the landing DocumentRoot and the instance-fragment dir (setgid energetica so
# every instance service can publish into it), then provisions the apex vhost + TLS.
# The landing build itself is shipped later by ./scripts/deploy-landing.sh.
#
# Requires DNS for <apex-domain> to already resolve to this server (for TLS issuance).

DOMAIN="${ENERGETICA_DOMAIN:-}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
AUTO_CONFIRM=false
LANDING_DIR=/var/www/energetica-landing
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        *) echo "Unknown option: $1"; echo "Usage: sudo bash setup-landing.sh --domain <apex-domain> [--deploy-user <user>] [--yes]"; exit 1 ;;
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
getent group energetica >/dev/null || { log_error "group 'energetica' missing — run setup-base.sh first"; exit 1; }

log_section "ENERGETICA LANDING SETUP ($DOMAIN)"
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "DNS for $DOMAIN points at this server? Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- Directories ----------------------------------------------------------------
log_section "LANDING DIRECTORIES"
# Landing root: deploy (owner) rsyncs the static bundle; instance services (group, via
# setgid) write instances.json here. 2775 = rwx for owner+group, r-x world (Apache).
install -d -o "$DEPLOY_USER" -g energetica -m 2775 "$LANDING_DIR"
# Fragment dir: every instance backend writes {slug}.json here. Setgid keeps new files
# group=energetica regardless of which instance's service created them.
install -d -o "$DEPLOY_USER" -g energetica -m 2775 "$LANDING_DIR/instances"
log_success "$LANDING_DIR and $LANDING_DIR/instances (2775, setgid energetica)"

# --- Temporary HTTP vhost for ACME ---------------------------------------------
log_section "TLS PROVISIONING"
VHOST=/etc/apache2/sites-available/energetica-landing.conf
log_step "Writing temporary HTTP vhost for certbot..."
cat > "$VHOST" <<EOF
<VirtualHost *:80>
    ServerName $DOMAIN
    DocumentRoot $LANDING_DIR
</VirtualHost>
EOF
a2ensite energetica-landing >/dev/null
systemctl reload apache2

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_success "Certificate for $DOMAIN already exists — skipping issuance"
else
    log_step "Obtaining certificate via webroot..."
    certbot certonly --webroot -w "$LANDING_DIR" -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
    log_success "Certificate obtained"
fi

# --- Full vhost (HTTP→HTTPS + static) ------------------------------------------
log_section "INSTALLING APEX VHOST"
sed "s/@DOMAIN@/$DOMAIN/g" "$SCRIPT_DIR/apache-main.conf" > "$VHOST"
a2ensite energetica-landing >/dev/null
apache2ctl configtest
systemctl reload apache2
log_success "Apex vhost active: https://$DOMAIN"

log_section "LANDING SETUP COMPLETE"
echo "Ship the landing build from your machine: ./scripts/deploy-landing.sh --server <ssh-host>"
