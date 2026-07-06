#!/bin/bash
set -euo pipefail

# Energetica — per-server base setup. Run ONCE per VPS, as root.
#
#   sudo bash scripts/infra/setup-base.sh [--deploy-user <user>] [--yes]
#
# Installs Apache + modules, Python, certbot, jq and a firewall; creates the shared
# `energetica` group and service user, the server-wide accounts dir, and the admin-owned
# per-instance config dir. Idempotent: safe to re-run.
#
# After this, run setup-landing.sh (apex vhost) then setup-instance.sh per instance.
# Superseded scripts/vps-setup.sh (removed in this phase).

DEPLOY_USER="${DEPLOY_USER:-deploy}"
AUTO_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
        --yes) AUTO_CONFIRM=true; shift ;;
        *) echo "Unknown option: $1"; echo "Usage: sudo bash setup-base.sh [--deploy-user <user>] [--yes]"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }
log_section() { echo; echo -e "${BLUE}━━━ $1 ━━━${NC}"; }

if [ "$EUID" -ne 0 ]; then
    log_error "Must run as root (use: sudo bash scripts/infra/setup-base.sh)"
    exit 1
fi

log_section "ENERGETICA SERVER BASE SETUP"
echo "Deploy (SSH) user: $DEPLOY_USER"
if [ "$AUTO_CONFIRM" = false ]; then
    read -r -p "Continue? (y/n) " -n 1 -r; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

# --- Packages -------------------------------------------------------------------
log_section "INSTALLING PACKAGES"
log_step "apt update / upgrade..."
apt-get update -y
apt-get upgrade -y
log_step "Installing Apache, Python, certbot, tooling..."
apt-get install -y \
    apache2 \
    python3 python3-venv python3-dev build-essential \
    certbot python3-certbot-apache \
    git curl wget rsync jq
log_success "Packages installed"

log_step "Enabling Apache modules (proxy, wstunnel, ssl, headers, rewrite)..."
a2enmod proxy proxy_http proxy_wstunnel ssl headers rewrite >/dev/null
systemctl restart apache2
log_success "Apache modules enabled"

# --- Shared group + service user ------------------------------------------------
log_section "SHARED GROUP & SERVICE USER"

# Shared group: instance services join it to write fragments into the landing dir;
# www-data (Apache) joins it to READ those fragments and the per-instance instance.json.
if ! getent group energetica >/dev/null; then
    groupadd --system energetica
    log_success "Created group 'energetica'"
else
    log_success "Group 'energetica' already exists"
fi

# Service user that every energetica-{slug}.service runs as. System account, no login.
if ! id energetica &>/dev/null; then
    useradd --system --gid energetica --home-dir /var/www --no-create-home --shell /usr/sbin/nologin energetica
    log_success "Created service user 'energetica'"
else
    log_success "Service user 'energetica' already exists"
fi

# Apache must read group-readable fragments / instance.json files, and traverse the 2750
# per-instance code dirs to serve the static bundle + ACME challenges. www-data picks up the
# new supplementary group only via initgroups at a FULL restart — a graceful reload keeps the
# master's existing group set, so the group would silently not apply and Apache would 403 the
# instance vhost. Restart here so every later setup-landing/instance reload inherits it.
if id www-data &>/dev/null; then
    usermod -aG energetica www-data
    systemctl restart apache2
    log_success "Added www-data to group 'energetica' and restarted Apache"
fi

# Deploy user rsyncs code into instance dirs (group-owned by energetica via setgid).
if id "$DEPLOY_USER" &>/dev/null; then
    usermod -aG energetica "$DEPLOY_USER"
    log_success "Added $DEPLOY_USER to group 'energetica'"

    # deploy-instance.sh runs `sudo -u energetica <instance>/.venv/bin/pip install …` (into the
    # per-instance venv) and `sudo systemctl restart energetica-*` over SSH, so grant exactly
    # those. The (energetica) rule is scoped to the per-instance pip binary — NOT `ALL` — so the
    # deploy user can't use the service account to read accounts.db or overwrite game state. The
    # `*` in the pathname matches only the slug segment (sudoers wildcards do not cross `/` in a
    # pathname); the trailing `*` permits pip's arguments. `systemctl is-active` is a read-only
    # query that needs no root (deploy-instance.sh calls it without sudo), so it is not granted
    # here. status/journalctl are scoped to energetica-* for the operator hint commands. Both
    # /usr/bin and /bin path variants cover merged-/usr and non-merged layouts.
    SUDOERS_FILE=/etc/sudoers.d/energetica-deploy
    cat > "$SUDOERS_FILE" <<EOF
$DEPLOY_USER ALL=(energetica) NOPASSWD: /var/www/energetica-*/.venv/bin/pip *
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart energetica-*, /bin/systemctl restart energetica-*, /usr/bin/systemctl status energetica-*, /bin/systemctl status energetica-*, /usr/bin/journalctl -u energetica-*, /bin/journalctl -u energetica-*
EOF
    chmod 440 "$SUDOERS_FILE"
    if visudo -cf "$SUDOERS_FILE" >/dev/null; then
        log_success "Configured passwordless sudo for $DEPLOY_USER (energetica + systemctl energetica-*)"
    else
        rm -f "$SUDOERS_FILE"
        log_error "sudoers syntax invalid — removed $SUDOERS_FILE; deploys will prompt for a password"
    fi
else
    log_error "Deploy user '$DEPLOY_USER' does not exist — create it or pass --deploy-user; skipping"
fi

# --- Server-wide accounts dir ---------------------------------------------------
log_section "SHARED STATE DIRECTORIES"

# accounts.db itself is created lazily by the first instance backend (or the migration
# script) on first connect — an empty/absent file is a valid fresh SQLite db. The dir
# is group-writable + setgid so the service user (which connects as energetica) owns the
# created db with the right group. See energetica/accounts/db.py.
install -d -o energetica -g energetica -m 2770 /var/lib/energetica
log_success "/var/lib/energetica (2770 energetica:energetica)"

# Admin-owned per-instance config. setup-instance.sh creates /etc/energetica/{slug}/.
# root:energetica 0750 → the service (group energetica) can read instance.json but only
# an admin (root, via sudo) can edit it.
install -d -o root -g energetica -m 0750 /etc/energetica
log_success "/etc/energetica (0750 root:energetica)"

# Server-wide cookie-signing secret (ADR-0002): minted once per server, read by the lobby
# and — from the Phase C cutover — every instance, so a session minted by the lobby
# validates everywhere. root:energetica 0640 → services read via group, only an admin
# rotates it. Never overwritten on re-run (rotating it invalidates every live session).
if [ -s /var/lib/energetica/secret_key.txt ]; then
    log_success "Shared secret already exists — leaving it untouched"
else
    (umask 037; python3 -c 'import secrets; print(secrets.token_hex(32))' > /var/lib/energetica/secret_key.txt)
    chown root:energetica /var/lib/energetica/secret_key.txt
    log_success "/var/lib/energetica/secret_key.txt (0640 root:energetica)"
fi

# Server-wide config: the lobby's signup toggle (energetica/server_config.py — reads fresh
# per request, fails closed when missing/malformed). Admin-edited like instance.json.
if [ -f /etc/energetica/server.json ]; then
    log_success "/etc/energetica/server.json already exists — leaving admin's copy untouched"
else
    echo '{"signups_enabled": true}' > /etc/energetica/server.json
    chown root:energetica /etc/energetica/server.json
    chmod 0640 /etc/energetica/server.json
    log_success "/etc/energetica/server.json (signups_enabled=true, 0640 root:energetica)"
fi

# --- Certbot Apache-reload hook (shared by landing + every instance) -----------
log_section "CERTBOT RENEWAL HOOK"
install -d /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-apache.sh <<'HOOK'
#!/bin/bash
systemctl reload apache2
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-apache.sh
log_success "Apache reload-on-renewal hook installed"

# --- Firewall -------------------------------------------------------------------
log_section "FIREWALL"
if command -v ufw >/dev/null; then
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    log_success "ufw configured (22, 80, 443)"
else
    log_error "ufw not present — skipping firewall (install ufw or configure manually)"
fi

log_section "BASE SETUP COMPLETE"
echo "Next:"
echo "  1. sudo bash scripts/infra/setup-landing.sh --domain <apex-domain>"
echo "  2. sudo bash scripts/infra/setup-instance.sh <instance> <port> --domain <apex-domain>"
echo "  3. From your machine: ./scripts/deploy-instance.sh --server <ssh-host> --instance <instance> --domain <apex-domain>"
