#!/bin/bash
set -euo pipefail

# Energetica — per-server base setup. Run ONCE per VPS, as root.
#
#   sudo bash scripts/infra/setup-base.sh [--yes]
#
# Installs Apache + modules, Python, certbot, jq and a firewall; creates the shared
# `energetica` group and service user, the admin-owned per-instance config dir, and the lobby
# service with its own user and private state dir. Idempotent: safe to re-run.
#
# After this, run setup-landing.sh (apex vhost) then setup-instance.sh per instance.
# Superseded scripts/vps-setup.sh (removed in this phase).

# The SSH/rsync deploy user. Never varied across this server's history — hardcoded rather
# than a configurable parameter (YAGNI); the OS account named "deploy" must already exist.
readonly DEPLOY_USER="deploy"
# The service user's home. The account must own it: pip keeps its download cache in
# ~/.cache/pip and silently runs without one when HOME is unwritable (#1067). It lives under
# /var/cache because a cache is all it holds.
readonly SERVICE_HOME=/var/cache/energetica
# The lobby service's own user and the private directory that holds lobby.db and the signing
# secret (ADR-0009). Nothing else on the server can read, replace or delete either.
readonly LOBBY_SERVICE_USER=energetica-lobby-service
readonly LOBBY_SERVICE_STATE=/var/lib/energetica-lobby-service
# Where both lived before #1284, readable by every process in the energetica group.
readonly LEGACY_STATE=/var/lib/energetica
AUTO_CONFIRM=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes) AUTO_CONFIRM=true; shift ;;
        *) echo "Unknown option: $1"; echo "Usage: sudo bash setup-base.sh [--yes]"; exit 1 ;;
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
    useradd --system --gid energetica --home-dir "$SERVICE_HOME" --no-create-home --shell /usr/sbin/nologin energetica
    log_success "Created service user 'energetica'"
else
    log_success "Service user 'energetica' already exists"
fi

# useradd was told --no-create-home, so this is what makes the home exist. 0700: nothing but
# the account itself has any reason to read its caches.
install -d -o energetica -g energetica -m 0700 "$SERVICE_HOME"
log_success "$SERVICE_HOME (0700 energetica:energetica, the service user's home)"

# A server provisioned before #1067 has the home on /var/www, and re-running this script is how
# it picks up the fix. usermod refuses to change the home of a user that has running processes,
# which is every energetica-* service, so on a live server this fails until they are stopped.
# Report that rather than abort: everything else this script does is still worth doing, and the
# only cost of carrying on is that pip keeps running without a cache.
current_home="$(getent passwd energetica | cut -d: -f6)"
if [ "$current_home" != "$SERVICE_HOME" ]; then
    if usermod --home "$SERVICE_HOME" energetica; then
        log_success "Moved the service user's home from $current_home to $SERVICE_HOME"
    else
        log_error "Could not move the service user's home from $current_home to $SERVICE_HOME, probably because its services are running."
        log_error "  Stop every service that 'systemctl list-units --type=service \"energetica-*\"' lists,"
        log_error "  except energetica-reaper, which runs as root. Run 'sudo usermod --home $SERVICE_HOME energetica',"
        log_error "  then start them again. No need to re-run this script."
    fi
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
    # deploy user can't use the service account to overwrite game state. The
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
    log_error "Deploy user '$DEPLOY_USER' does not exist — create it first; skipping"
fi

# --- Shared config dir -----------------------------------------------------------
log_section "SHARED CONFIG DIRECTORIES"

# Admin-owned per-instance config. setup-instance.sh creates /etc/energetica/{slug}/.
# root:energetica 0750 → the service (group energetica) can read instance.json but only
# an admin (root, via sudo) can edit it.
install -d -o root -g energetica -m 0750 /etc/energetica
log_success "/etc/energetica (0750 root:energetica)"

# Server-wide config: the lobby's signup toggle (src/energetica/identity/server_config.py — reads
# fresh per request, fails closed when missing/malformed). Admin-edited like instance.json.
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

# --- Lifecycle reaper (the ended_at sweep, T7) ----------------------------------
log_section "LIFECYCLE REAPER"
# announced→active and active→freeze are self-driven from each instance's own clock, but a
# process cannot cleanly stop itself, so freeze→ended is driven from outside: a 5-minute sweep
# that stops + disables any instance whose ended_at has passed. Server-wide (it globs
# /etc/energetica/*/instance.json), so provisioning a new instance needs no timer of its own.
#
# The script is COPIED to /usr/local/sbin rather than run from the checkout: this repo is never
# cloned onto the server (Option A — code arrives by rsync into per-instance dirs), so there is
# no stable in-repo path a root-run unit could point at.
install -m 0755 "$SCRIPT_DIR/reap-instances.sh" /usr/local/sbin/energetica-reap-instances
install -m 0644 "$SCRIPT_DIR/energetica-reaper.service" /etc/systemd/system/energetica-reaper.service
install -m 0644 "$SCRIPT_DIR/energetica-reaper.timer" /etc/systemd/system/energetica-reaper.timer
systemctl daemon-reload
# Enable the TIMER, not the service — the service is the oneshot the timer triggers.
systemctl enable --now energetica-reaper.timer >/dev/null
log_success "energetica-reaper.timer enabled (sweeps every 5 min; 'systemctl list-timers energetica-*' to check)"

# --- Lobby service (ADR-0009) ---------------------------------------------------
log_section "LOBBY SERVICE"
# The one process that opens lobby.db, reached by the lobby backend, every run and the operator
# scripts over /run/energetica/lobby-service.sock. Installed here, not in setup-lobby.sh, because
# runs depend on it too. Its code ships with the lobby (/var/www/energetica-lobby), so until the
# first deploy-lobby.sh a connection to the socket starts a service that fails; nothing connects
# before then.
#
# It runs as its own user, which alone can read lobby.db and the signing secret. The socket stays
# energetica's, so its clients still reach it. Its supplementary group energetica lets it read
# its code in /var/www/energetica-lobby.
if ! getent group "$LOBBY_SERVICE_USER" >/dev/null; then
    groupadd --system "$LOBBY_SERVICE_USER"
fi
if ! id "$LOBBY_SERVICE_USER" &>/dev/null; then
    useradd --system --gid "$LOBBY_SERVICE_USER" --home-dir "$LOBBY_SERVICE_STATE" --no-create-home \
        --shell /usr/sbin/nologin "$LOBBY_SERVICE_USER"
    log_success "Created service user '$LOBBY_SERVICE_USER'"
else
    log_success "Service user '$LOBBY_SERVICE_USER' already exists"
fi
install -d -o "$LOBBY_SERVICE_USER" -g "$LOBBY_SERVICE_USER" -m 0700 "$LOBBY_SERVICE_STATE"
log_success "$LOBBY_SERVICE_STATE (0700 $LOBBY_SERVICE_USER, holds lobby.db and the signing secret)"

# Until #1284 the database was /var/lib/energetica/accounts.db and the secret sat next to it, both
# readable by the energetica group, because runs opened the database and checked cookies
# themselves. Move both into the private dir. The service must be stopped, socket included so no
# request starts it again, and a clean stop folds SQLite's -wal file back into the database.
#
# A run still on code from before #1283 cannot work once they move. deploy-instance.sh refuses to
# deploy that code's successor until instance.env names the lobby service's socket, so a running
# instance whose instance.env lacks it is certainly on old code: refuse while there is one.
if [ -e "$LEGACY_STATE/accounts.db" ] || [ -e "$LEGACY_STATE/secret_key.txt" ]; then
    log_step "Moving accounts.db and the signing secret from $LEGACY_STATE to $LOBBY_SERVICE_STATE..."
    if [ -e "$LOBBY_SERVICE_STATE/lobby.db" ] || [ -e "$LOBBY_SERVICE_STATE/secret_key.txt" ]; then
        log_error "Both $LEGACY_STATE and $LOBBY_SERVICE_STATE hold a database or a secret. Decide which"
        log_error "  to keep, remove the other, and re-run."
        exit 1
    fi
    for env_file in /etc/energetica/*/instance.env; do
        [ -f "$env_file" ] || continue
        slug="$(basename "$(dirname "$env_file")")"
        if systemctl is-active --quiet "energetica-$slug" && ! grep -q '^ENERGETICA_LOBBY_SERVICE_SOCKET=' "$env_file"; then
            log_error "energetica-$slug is running on code that opens $LEGACY_STATE/accounts.db itself."
            log_error "  Run update-instance-unit.sh and deploy-instance.sh for it, or stop it, then re-run."
            exit 1
        fi
    done
    systemctl stop energetica-lobby-service.socket energetica-lobby-service.service
    for suffix in "" -wal -shm .pre-migration; do
        if [ -e "$LEGACY_STATE/accounts.db$suffix" ]; then
            mv "$LEGACY_STATE/accounts.db$suffix" "$LOBBY_SERVICE_STATE/lobby.db$suffix"
        fi
    done
    if [ -e "$LEGACY_STATE/secret_key.txt" ]; then
        mv "$LEGACY_STATE/secret_key.txt" "$LOBBY_SERVICE_STATE/secret_key.txt"
    fi
    chown -R "$LOBBY_SERVICE_USER:$LOBBY_SERVICE_USER" "$LOBBY_SERVICE_STATE"
    find "$LOBBY_SERVICE_STATE" -type f -exec chmod 0600 {} +
    rmdir "$LEGACY_STATE" 2>/dev/null || log_error "$LEGACY_STATE is not empty after the move; check what else is in it"
    log_success "Moved them to $LOBBY_SERVICE_STATE (lobby.db, secret_key.txt; 0600 $LOBBY_SERVICE_USER)"
fi

# The server-wide session-signing secret (ADR-0002), minted once per server. Never overwritten on
# re-run: rotating it ends every live session.
if [ -s "$LOBBY_SERVICE_STATE/secret_key.txt" ]; then
    log_success "Signing secret already exists — leaving it untouched"
else
    (umask 077; python3 -c 'import secrets; print(secrets.token_hex(32))' > "$LOBBY_SERVICE_STATE/secret_key.txt")
    chown "$LOBBY_SERVICE_USER:$LOBBY_SERVICE_USER" "$LOBBY_SERVICE_STATE/secret_key.txt"
    log_success "$LOBBY_SERVICE_STATE/secret_key.txt (0600 $LOBBY_SERVICE_USER)"
fi

# Only the socket is enabled: it starts the service on the first connection. The socket is never
# restarted here, since that would drop connections queued on it; a changed service unit is picked
# up by restarting the service, which deploy-lobby.sh also does on every deploy.
install -m 0644 "$SCRIPT_DIR/energetica-lobby-service.socket" /etc/systemd/system/energetica-lobby-service.socket
install -m 0644 "$SCRIPT_DIR/energetica-lobby-service.service" /etc/systemd/system/energetica-lobby-service.service
systemctl daemon-reload
systemctl enable --now energetica-lobby-service.socket >/dev/null
if systemctl is-active --quiet energetica-lobby-service.service; then
    systemctl restart energetica-lobby-service.service
    log_success "energetica-lobby-service restarted with the installed unit"
fi
log_success "energetica-lobby-service.socket enabled (/run/energetica/lobby-service.sock, 0660 energetica:energetica)"

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
