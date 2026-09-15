#!/bin/bash
set -euo pipefail

# Energetica — render a provisioned instance's Apache vhost. Run as root, on the server.
#
#   sudo bash scripts/infra/update-instance-vhost.sh <instance> --domain <apex-domain>
#
# This is the ONLY renderer of apache-instance.conf. setup-instance.sh calls it at step 7 rather
# than inlining the substitution, so a change to the template reaches a live instance by running
# this script — not by editing /etc/apache2/sites-available/ by hand on every server, which is
# what every vhost change cost before #1071. setup-instance.sh refuses to run twice on a
# provisioned instance, for reasons that have nothing to do with Apache, so while the render
# lived inside it there was no way at all to re-render the vhost of an instance that existed.
#
# Idempotent and safe to rerun: with the template unchanged it reports that and does nothing.
# It takes no arguments beyond the instance and the apex domain — everything else, the port
# above all, is read from the instance's own /etc/energetica/{instance}/instance.env (#1072),
# the same file the running service gets its port from. A hand-typed port that disagreed with
# the service would render a vhost that passes configtest and proxies to nothing.
#
# Deliver it the way the other infra scripts are delivered — there is no git on the server:
#
#   ./scripts/push-bootstrap.sh --server <ssh-host>     # from your machine
#   sudo bash /tmp/update-instance-vhost.sh <instance> --domain <apex-domain>   # on the VPS, as root
#
# The second line is run on the server by an administrator, not piped through `ssh <host> '…'`:
# that connects as `deploy`, which is granted passwordless sudo for the per-instance pip and
# `systemctl`/`journalctl` on energetica-* and nothing else. `sudo bash` is deliberately not on
# that list — granting it would hand the deploy user the very privilege this script keeps out of
# its reach (see below).
#
# Deliberately NOT run by deploy-instance.sh. Writing /etc/apache2/sites-available/ and
# reloading Apache is equivalent to root — an Apache config can Include arbitrary files, set
# User, and enable CGI — so granting it to the deploy user would dissolve the least-privilege
# split setup-base.sh sets up on purpose. A root-owned wrapper would not rescue it either: the
# template it renders would have to be shipped to the deploy-owned $APP_DIR, and whoever
# controls the template controls the output. Keeping the re-render manual costs one command per
# instance per migration and leaves that split intact.

DOMAIN="${ENERGETICA_DOMAIN:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

POSITIONAL=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
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
[ "${#POSITIONAL[@]}" -eq 1 ] || { log_error "Usage: update-instance-vhost.sh <instance> --domain <apex-domain>"; exit 1; }
INSTANCE="${POSITIONAL[0]}"

# --- Validation -----------------------------------------------------------------
# Both values are substituted into the template with sed and into shell paths, so they are
# checked before anything is rendered. The patterns are the ones setup-instance.sh applies to
# the same two arguments: a real hostname and a DNS label carry no sed metacharacter, which is
# what makes the plain substitution below safe.
[ -n "$DOMAIN" ] || { log_error "--domain is required"; exit 1; }
if ! [[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
    log_error "Invalid domain: '$DOMAIN' (expected a hostname like energetica-game.org)"
    exit 1
fi
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
    log_error "Instance slug must be lowercase kebab-case, max 63 chars (a DNS label): '$INSTANCE'"
    exit 1
fi
# The landing site and the lobby have their own vhosts and their own templates; rendering this
# one over either would replace a working site with a proxy to an instance that does not exist.
if [ "$INSTANCE" = "landing" ] || [ "$INSTANCE" = "lobby" ]; then
    log_error "'$INSTANCE' is reserved — this script renders game-instance vhosts only"
    exit 1
fi

TEMPLATE="$SCRIPT_DIR/apache-instance.conf"
ENV_FILE="/etc/energetica/$INSTANCE/instance.env"
VHOST="/etc/apache2/sites-available/energetica-$INSTANCE.conf"
ENABLED_LINK="/etc/apache2/sites-enabled/energetica-$INSTANCE.conf"
FQDN="$INSTANCE.$DOMAIN"

[ -f "$TEMPLATE" ] || { log_error "Template missing: $TEMPLATE (push it with ./scripts/push-bootstrap.sh)"; exit 1; }

# The instance must already exist. instance.env is written by setup-instance.sh before the vhost
# it also writes, so its absence means either a slug that was never provisioned (a typo, most
# likely) or an instance provisioned before #1072 moved the port here — and the second one is
# worth saying out loud, because the migration is the fix for it.
if [ ! -f "$ENV_FILE" ]; then
    log_error "$ENV_FILE does not exist — '$INSTANCE' is not provisioned on this server."
    log_error "If it IS running, it predates #1072 and has no EnvironmentFile yet; migrate it first."
    exit 1
fi

# One line, one value, no shell: the env file is systemd's, whose parser is not a shell, and
# list-instances.sh reads the port out of it exactly this way.
PORT="$(sed -n 's/^ENERGETICA_PORT=//p' "$ENV_FILE" | head -1)"
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    log_error "No usable ENERGETICA_PORT in $ENV_FILE (read: '${PORT:-<missing>}')"
    exit 1
fi

# The rendered vhost names the certificate files unconditionally, and Apache refuses to load a
# vhost whose SSLCertificateFile is not there. Checking first turns "the whole server's config
# is now broken" into a message naming the instance and the certificate it is missing.
if [ ! -f "/etc/letsencrypt/live/$FQDN/fullchain.pem" ]; then
    log_error "No certificate at /etc/letsencrypt/live/$FQDN/fullchain.pem — the vhost would not load."
    log_error "Issue one first (certbot certonly --webroot -w /var/www/energetica-$INSTANCE -d $FQDN)."
    exit 1
fi

log_section "INSTANCE VHOST: $INSTANCE (port $PORT, $FQDN)"

# --- Render ---------------------------------------------------------------------
# Rendered to a scratch file first, so the comparison below is against the finished article and
# the live vhost is never a half-written file.
RENDERED="$(mktemp)"
BACKUP=""
WAS_ENABLED=false
# INSTALLED: the new vhost is on disk at $VHOST. COMMITTED: Apache has tested it and loaded it.
# Anything that ends this run between those two is a failure, whatever ended it.
INSTALLED=false
COMMITTED=false

# Put the previous state back, exactly as it was found. Apache's configuration is server-wide: a
# file that fails configtest fails every LATER reload too, certbot's renewal hook included, so a
# bad render for one instance would quietly cost every instance on the box its TLS renewal.
# Reports failure rather than dying on it — the caller is already handling one failure and needs
# to say what state it left behind.
restore_previous_vhost() {
    local failed=0
    # Disable before removing, not after: Debian's a2dissite refuses to act once the file is
    # gone from sites-available, which would strand a sites-enabled symlink pointing at nothing
    # — itself a configuration error, and exactly what this function exists to prevent.
    if [ "$WAS_ENABLED" = false ]; then
        a2dissite "energetica-$INSTANCE" >/dev/null || failed=1
    fi
    if [ -n "$BACKUP" ]; then
        cp -p "$BACKUP" "$VHOST" || failed=1
    else
        rm -f "$VHOST" || failed=1
    fi
    return "$failed"
}

# The rollback hangs off the trap rather than off the configtest branch alone, because that
# branch is not the only way out of the window between INSTALLED and COMMITTED: a2ensite can
# fail under `set -e`, and an operator can Ctrl-C while configtest runs. Either one would
# otherwise leave the untested render installed and take the backup to the grave with it.
cleanup() {
    if [ "$INSTALLED" = true ] && [ "$COMMITTED" = false ]; then
        if restore_previous_vhost; then
            log_error "Rolled back: $VHOST is as it was, and Apache was never reloaded."
        else
            log_error "ROLLBACK FAILED — $VHOST may still hold the rejected render, and the next"
            log_error "reload of Apache (certbot's renewal hook triggers one) would fail on it."
            log_error "Fix it by hand now: apache2ctl configtest will name the problem."
        fi
    fi
    rm -f "$RENDERED" ${BACKUP:+"$BACKUP"}
}
# Set before the first thing worth cleaning up, so no failure can slip in ahead of it. The
# signal traps exit rather than clean up themselves, which runs cleanup once, through EXIT.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

sed -e "s/@INSTANCE@/$INSTANCE/g" \
    -e "s/@PORT@/$PORT/g" \
    -e "s/@DOMAIN@/$DOMAIN/g" \
    "$TEMPLATE" > "$RENDERED"

if [ -f "$VHOST" ] && [ -e "$ENABLED_LINK" ] && cmp -s "$RENDERED" "$VHOST"; then
    log_success "$VHOST is already up to date — nothing to do"
    exit 0
fi

if [ -e "$ENABLED_LINK" ]; then WAS_ENABLED=true; fi
if [ -f "$VHOST" ]; then
    BACKUP="$(mktemp)"
    cp -p "$VHOST" "$BACKUP"
fi

log_step "Installing the rendered vhost and testing the configuration..."
INSTALLED=true
install -m 0644 -o root -g root "$RENDERED" "$VHOST"
a2ensite "energetica-$INSTANCE" >/dev/null

if ! apache2ctl configtest; then
    log_error "The rendered vhost failed configtest. Apache has NOT been reloaded, so the site"
    log_error "is still serving as it was."
    exit 1   # the EXIT trap rolls back and reports what it managed to restore
fi
if ! systemctl reload apache2; then
    log_error "The vhost passed configtest but Apache would not reload, so it is still running"
    log_error "the previous configuration. Investigate with:"
    log_error "  systemctl status apache2; journalctl -u apache2 -n 50"
    exit 1
fi
COMMITTED=true
log_success "Vhost rendered and active: https://$FQDN"
