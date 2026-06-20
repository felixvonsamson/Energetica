#!/bin/bash
set -euo pipefail

# Energetica — provision a single game instance. Run per instance, as root, AFTER
# setup-base.sh and setup-landing.sh.
#
#   sudo bash scripts/infra/setup-instance.sh <instance> <port> --domain <apex-domain> \
#        [--name "<display name>"] [--no-advertise] [--starts-at <ISO-8601-UTC>] [--yes]
#
# Creates the instance dir + venv, the admin-owned /etc/energetica/{instance}/instance.json,
# the Apache vhost + TLS, and the energetica-{instance}.service unit (enabled, NOT started).
#
# This script does NOT ship application code — there is no git on the server (Option A).
# The FIRST run of ./scripts/deploy-instance.sh rsyncs the backend, installs deps into the
# venv, and starts the service (which then publishes its landing fragment).
#
# Requires DNS for {instance}.{apex-domain} to already resolve here (for TLS issuance).

DOMAIN="${ENERGETICA_DOMAIN:-}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
NAME=""
ADVERTISED="true"
STARTS_AT=""
AUTO_CONFIRM=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

POSITIONAL=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
        --name) NAME="$2"; shift 2 ;;
        --no-advertise) ADVERTISED="false"; shift ;;
        --starts-at) STARTS_AT="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        -*) echo "Unknown option: $1"; exit 1 ;;
        *) POSITIONAL+=("$1"); shift ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }
log_section() { echo; echo -e "${BLUE}━━━ $1 ━━━${NC}"; }

[ "$EUID" -eq 0 ] || { log_error "Must run as root"; exit 1; }
[ "${#POSITIONAL[@]}" -eq 2 ] || { log_error "Usage: setup-instance.sh <instance> <port> --domain <apex-domain> [options]"; exit 1; }
INSTANCE="${POSITIONAL[0]}"
PORT="${POSITIONAL[1]}"

# --- Validation -----------------------------------------------------------------
[ -n "$DOMAIN" ] || { log_error "--domain is required"; exit 1; }
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
    log_error "Instance slug must be lowercase kebab-case ([a-z0-9][a-z0-9-]*[a-z0-9]): '$INSTANCE'"
    exit 1
fi
if [ "$INSTANCE" = "landing" ]; then
    log_error "'landing' is reserved for the apex landing site"
    exit 1
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    log_error "Port must be an integer 1024-65535: '$PORT'"
    exit 1
fi
getent group energetica >/dev/null || { log_error "group 'energetica' missing — run setup-base.sh first"; exit 1; }
[ -d /var/www/energetica-landing/instances ] || { log_error "landing not set up — run setup-landing.sh first"; exit 1; }

# Defaults for instance.json.
[ -n "$NAME" ] || NAME="$(echo "$INSTANCE" | awk -F- 'BEGIN{OFS=" "}{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1)) substr($i,2)}}1')"
[ -n "$STARTS_AT" ] || STARTS_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# instance.json is JSON rendered from the template via sed. A display name containing a
# double-quote or backslash would break the JSON; the sed replacement metacharacters
# (& / \) would corrupt the substitution itself. Reject the JSON-breakers (auto defaults
# never contain them) and escape the sed-special chars for both interpolated values.
case "$NAME" in
    *[\"\\]*) log_error "--name must not contain double-quotes or backslashes"; exit 1 ;;
esac
sed_escape() { printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'; }

APP_DIR="/var/www/energetica-$INSTANCE"
CONFIG_DIR="/etc/energetica/$INSTANCE"
FQDN="$INSTANCE.$DOMAIN"
VHOST="/etc/apache2/sites-available/energetica-$INSTANCE.conf"
UNIT="/etc/systemd/system/energetica-$INSTANCE.service"

log_section "PROVISION INSTANCE: $INSTANCE (port $PORT, $FQDN)"
echo "  name:       $NAME"
echo "  advertised: $ADVERTISED"
echo "  starts_at:  $STARTS_AT"
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "DNS for $FQDN points here? Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- 1-2. Directories + venv ----------------------------------------------------
log_section "DIRECTORIES & VENV"
# Instance dir: deploy (owner) rsyncs code; the service (group energetica, via setgid)
# reads it. 2750 = rwx owner, r-x group, none world.
install -d -o "$DEPLOY_USER" -g energetica -m 2750 "$APP_DIR"
# Engine working dir: the service writes the pickle/logs here, so it is owned by the
# service user. Excluded from deploy rsync (game state must survive deploys).
install -d -o energetica -g energetica -m 2770 "$APP_DIR/instance"
log_success "$APP_DIR (code, deploy-owned) and $APP_DIR/instance (game state, service-owned)"

if [ -x "$APP_DIR/.venv/bin/python" ]; then
    log_success "venv already present at $APP_DIR/.venv"
else
    log_step "Creating venv (populated by first deploy)..."
    sudo -u energetica python3 -m venv "$APP_DIR/.venv"
    log_success "venv at $APP_DIR/.venv"
fi

# --- 3. Admin-owned instance.json ----------------------------------------------
log_section "INSTANCE CONFIG"
install -d -o root -g energetica -m 0750 "$CONFIG_DIR"
if [ -f "$CONFIG_DIR/instance.json" ]; then
    log_success "$CONFIG_DIR/instance.json already exists — leaving admin's copy untouched"
else
    sed -e "s/@NAME@/$(sed_escape "$NAME")/g" \
        -e "s/@ADVERTISED@/$ADVERTISED/g" \
        -e "s/@STARTS_AT@/$(sed_escape "$STARTS_AT")/g" \
        "$SCRIPT_DIR/instance.json.tmpl" > "$CONFIG_DIR/instance.json"
    chown root:energetica "$CONFIG_DIR/instance.json"
    # 0640: service (group) reads; only root (admin, via sudo) edits. Edit later for a
    # private/unadvertised instance — changes take effect on the instance's next login.
    chmod 0640 "$CONFIG_DIR/instance.json"
    log_success "Rendered $CONFIG_DIR/instance.json (public, advertised=$ADVERTISED)"
fi

# --- 4-5. Temporary HTTP vhost for ACME ----------------------------------------
log_section "TLS PROVISIONING"
log_step "Writing temporary HTTP vhost for certbot..."
cat > "$VHOST" <<EOF
<VirtualHost *:80>
    ServerName $FQDN
    DocumentRoot $APP_DIR
</VirtualHost>
EOF
a2ensite "energetica-$INSTANCE" >/dev/null
systemctl reload apache2

# --- 6. Certificate -------------------------------------------------------------
if [ -f "/etc/letsencrypt/live/$FQDN/fullchain.pem" ]; then
    log_success "Certificate for $FQDN already exists — skipping issuance"
else
    log_step "Obtaining certificate via webroot..."
    certbot certonly --webroot -w "$APP_DIR" -d "$FQDN" --non-interactive --agree-tos --register-unsafely-without-email
    log_success "Certificate obtained"
fi
# Apache reload-on-renewal hook was installed once by setup-base.sh; nothing to do here.

# --- 7. Full vhost --------------------------------------------------------------
log_section "INSTANCE VHOST"
sed -e "s/@INSTANCE@/$INSTANCE/g" \
    -e "s/@PORT@/$PORT/g" \
    -e "s/@DOMAIN@/$DOMAIN/g" \
    "$SCRIPT_DIR/apache-instance.conf" > "$VHOST"
a2ensite "energetica-$INSTANCE" >/dev/null
apache2ctl configtest
systemctl reload apache2
log_success "Vhost active: https://$FQDN"

# --- 9. systemd unit (enabled, not started — no code yet) ----------------------
log_section "SYSTEMD UNIT"
sed -e "s/@INSTANCE@/$INSTANCE/g" \
    -e "s/@PORT@/$PORT/g" \
    "$SCRIPT_DIR/energetica.service" > "$UNIT"
systemctl daemon-reload
systemctl enable "energetica-$INSTANCE" >/dev/null
log_success "energetica-$INSTANCE.service enabled (not started)"

log_section "INSTANCE PROVISIONED"
echo "Ship code and start the service from your machine:"
echo "  ./scripts/deploy-instance.sh --server <ssh-host> --instance $INSTANCE --domain $DOMAIN"
echo
echo "For a private/unadvertised instance, edit the policy before first login:"
echo "  sudo \$EDITOR $CONFIG_DIR/instance.json   # set advertised/access.policy + allowed_usernames"
