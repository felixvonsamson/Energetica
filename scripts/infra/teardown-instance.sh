#!/bin/bash
set -euo pipefail

# Energetica — remove a game instance from this server for good. Run as root, by hand.
#
#   sudo bash scripts/infra/teardown-instance.sh <instance> --domain <apex-domain> \
#        [--archive-to <dir>] [--keep-cert] [--yes]
#
# This is NOT the reap. Reaping (freeze→ended) is automatic, narrow, and reversible: the timer
# stops + disables the unit and leaves everything else standing (see reap-instances.sh). Teardown
# is the deliberate second act — it destroys the instance's presence on this box:
#
#   1. stop + disable energetica-{instance}, remove the unit
#   2. disable + remove the Apache vhost
#   3. archive the engine pickle (--archive-to), then remove /var/www/energetica-{instance}
#   4. remove /etc/energetica/{instance}/
#   5. retire the landing fragment (see below), re-aggregating instances.json
#   6. optionally release the TLS certificate
#
# What it must NEVER touch is recaps/{instance}.json on the landing dir. That artifact is the
# whole point of the lifecycle: the run's recap is minted at freeze and published OUTSIDE the
# instance, so it survives both the reap and this teardown. The instance can vanish entirely and
# the lobby still renders its recap.
#
# The fragment is subtler, and the rule lives in tested Python (instance_config.retire_fragment):
# the fragment is the ONLY pointer by which the lobby finds a run — my-runs joins memberships
# against it, and the picker reads it through instances.json. So deleting the fragment of a run
# that HAS a recap would strand that recap: on disk, served, and linked from nowhere. A recap
# therefore promotes the fragment from billboard to headstone and it is kept; only a run that
# never froze loses its fragment here.
#
# Destructive and irreversible. Confirm-gated unless --yes, and it names what it will delete first.

DOMAIN="${ENERGETICA_DOMAIN:-}"
ARCHIVE_TO=""
KEEP_CERT=false
AUTO_CONFIRM=false
LANDING_DIR=/var/www/energetica-landing

POSITIONAL=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --archive-to) ARCHIVE_TO="$2"; shift 2 ;;
        --keep-cert) KEEP_CERT=true; shift ;;
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
[ "${#POSITIONAL[@]}" -eq 1 ] || { log_error "Usage: teardown-instance.sh <instance> --domain <apex-domain> [options]"; exit 1; }
INSTANCE="${POSITIONAL[0]}"

[ -n "$DOMAIN" ] || { log_error "--domain is required"; exit 1; }
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
    log_error "Instance slug must be lowercase kebab-case, max 63 chars (a DNS label): '$INSTANCE'"
    exit 1
fi
# The same reserved names setup-instance.sh refuses to create. Tearing either of these down with
# this script would delete the apex landing site or the lobby service out from under every run.
if [ "$INSTANCE" = "landing" ] || [ "$INSTANCE" = "lobby" ]; then
    log_error "'$INSTANCE' is reserved — this script tears down game instances only"
    exit 1
fi

APP_DIR="/var/www/energetica-$INSTANCE"
CONFIG_DIR="/etc/energetica/$INSTANCE"
FQDN="$INSTANCE.$DOMAIN"
VHOST="/etc/apache2/sites-available/energetica-$INSTANCE.conf"
UNIT="/etc/systemd/system/energetica-$INSTANCE.service"
PICKLE="$APP_DIR/instance/engine_data.pck"
RECAP="$LANDING_DIR/recaps/$INSTANCE.json"

log_section "TEAR DOWN INSTANCE: $INSTANCE ($FQDN)"
echo "Will remove:"
echo "  service   $UNIT"
echo "  vhost     $VHOST"
echo "  app dir   $APP_DIR   (game state, venv, code)"
echo "  config    $CONFIG_DIR"
[ "$KEEP_CERT" = true ] && echo "  cert      kept (--keep-cert)" || echo "  cert      /etc/letsencrypt/live/$FQDN (revoked + deleted)"
[ -n "$ARCHIVE_TO" ] && echo "  pickle    archived to $ARCHIVE_TO before deletion" || echo "  pickle    NOT archived (pass --archive-to <dir> to keep it)"
echo

# --- Refuse to destroy a recap that is still recoverable -------------------------
# A recap FILE is not the same as a recap the lobby can render. If the artifact is truncated or
# schema-invalid, the run is still salvageable *right now* — the instance and its player state are
# untouched, and the documented regenerate path (delete the file; the next freeze tick re-mints it)
# still works. A moment later this script will have deleted the service, the venv and the pickle,
# and the recap becomes unrecoverable for good. So this is the one preflight that aborts.
#
# Note there is no --force: the escape hatch is the same `rm` either way. Delete the corrupt file
# and re-run — if the instance re-mints first you keep the recap, and if you accept the loss the
# run simply retires as one that never froze. Both paths are better than a flag that says "yes,
# strand it", which is not an outcome anyone wants.
VENV_PYTHON="$APP_DIR/.venv/bin/python"
if [ -f "$RECAP" ]; then
    if [ -x "$VENV_PYTHON" ] && ! ENERGETICA_LANDING_DIR="$LANDING_DIR" sudo -u energetica -E "$VENV_PYTHON" -c "
import sys
sys.path.insert(0, '$APP_DIR')
from energetica import instance_config
sys.exit(0 if instance_config.load_recap('$INSTANCE') is not None else 1)
"; then
        log_error "The recap at $RECAP exists but does NOT load — it is corrupt or schema-invalid."
        log_error "Tearing down now would strand it: the lobby would advertise 'View recap' forever"
        log_error "over a file that never renders, with the game state needed to re-mint it deleted."
        echo
        echo "Recover it while the instance is still here:"
        echo "  sudo rm $RECAP     # the next freeze tick re-mints it (mint-once guard self-heals)"
        echo "Then re-run this script. If the run is genuinely unsalvageable, delete the file anyway"
        echo "and re-run — it will then retire as a run that never froze."
        exit 1
    fi
    log_success "recap $RECAP loads — it is KEPT, and so is the fragment that points at it"
else
    log_step "no recap at $RECAP — this run never froze, so its fragment will be removed too"
fi

if [ "$AUTO_CONFIRM" = false ]; then
    echo
    read -r -p "This is irreversible. Type the instance slug to confirm: " -r
    [ "$REPLY" = "$INSTANCE" ] || { echo "Cancelled."; exit 0; }
fi

# --- 1. Archive the pickle BEFORE anything is deleted ---------------------------
# Done first, while every path still exists: an archive taken after a partial teardown is worth
# less than no archive at all, because it looks like a complete one.
if [ -n "$ARCHIVE_TO" ]; then
    log_section "ARCHIVE GAME STATE"
    if [ -f "$PICKLE" ]; then
        install -d -m 0750 "$ARCHIVE_TO"
        ARCHIVE_PATH="$ARCHIVE_TO/$INSTANCE-$(date -u +%Y%m%dT%H%M%SZ)-engine_data.pck"
        cp -p "$PICKLE" "$ARCHIVE_PATH"
        log_success "Archived $ARCHIVE_PATH"
    else
        log_error "No pickle at $PICKLE — nothing to archive (continuing)"
    fi
fi

# --- 2. Retire the fragment (before the venv it needs is deleted) ---------------
# The keep-or-delete rule lives in energetica.instance_config.retire_fragment, which also
# re-aggregates instances.json. Run it through THIS instance's venv, which means it has to happen
# before step 5 removes the app dir. If the venv is already gone (a half-finished earlier
# teardown), say so loudly rather than silently skipping — a stale fragment left in the manifest
# points the picker at a subdomain that no longer answers.
log_section "LANDING FRAGMENT"
if [ -x "$VENV_PYTHON" ]; then
    ENERGETICA_LANDING_DIR="$LANDING_DIR" ENERGETICA_INSTANCE_CONFIG_DIR=/etc/energetica \
        sudo -u energetica -E "$VENV_PYTHON" -c "
import sys
sys.path.insert(0, '$APP_DIR')
from energetica import instance_config
deleted = instance_config.retire_fragment('$INSTANCE')
print('deleted' if deleted else 'kept')
" && log_success "Fragment retired and instances.json re-aggregated"
else
    log_error "No venv at $VENV_PYTHON — could NOT retire the fragment."
    log_error "Re-aggregate by hand from another instance's venv, or the picker will keep listing $INSTANCE."
fi

# --- 3. Service ------------------------------------------------------------------
log_section "SERVICE"
if [ -f "$UNIT" ]; then
    systemctl stop "energetica-$INSTANCE" 2>/dev/null || true
    systemctl disable "energetica-$INSTANCE" >/dev/null 2>&1 || true
    rm -f "$UNIT"
    systemctl daemon-reload
    log_success "energetica-$INSTANCE.service stopped, disabled and removed"
else
    log_success "No unit at $UNIT — already removed"
fi

# --- 4. Apache vhost -------------------------------------------------------------
log_section "VHOST"
if [ -f "$VHOST" ]; then
    a2dissite "energetica-$INSTANCE" >/dev/null 2>&1 || true
    rm -f "$VHOST"
    apache2ctl configtest
    systemctl reload apache2
    log_success "Vhost disabled and removed; Apache reloaded"
else
    log_success "No vhost at $VHOST — already removed"
fi

# --- 5. Directories ---------------------------------------------------------------
log_section "DIRECTORIES"
rm -rf "$APP_DIR"
log_success "Removed $APP_DIR"
rm -rf "$CONFIG_DIR"
log_success "Removed $CONFIG_DIR"

# --- 6. Certificate ----------------------------------------------------------------
log_section "CERTIFICATE"
if [ "$KEEP_CERT" = true ]; then
    log_success "Keeping the certificate for $FQDN (--keep-cert)"
elif [ -d "/etc/letsencrypt/live/$FQDN" ]; then
    # Without this the renewal timer keeps trying to renew a cert for a subdomain that no longer
    # has a vhost, and every renewal fails the http-01 challenge — noisy, and it counts against
    # the Let's Encrypt failure rate limit for the apex.
    certbot delete --cert-name "$FQDN" --non-interactive || log_error "certbot delete failed — remove the cert by hand"
    log_success "Certificate for $FQDN released"
else
    log_success "No certificate for $FQDN — nothing to release"
fi

log_section "INSTANCE TORN DOWN"
if [ -f "$RECAP" ]; then
    echo "The run's recap outlived it, as designed:"
    echo "  $RECAP  → https://lobby.$DOMAIN/runs/$INSTANCE/recap"
else
    echo "This run had no recap (it never reached freeze), so nothing of it remains."
fi
echo
echo "Not touched (server-wide, shared by every run):"
echo "  /var/lib/energetica/accounts.db — accounts and instance_membership rows persist."
echo "  A membership row for a torn-down run with no recap now has no fragment to join against,"
echo "  so my-runs filters it out. Harmless; purging those rows is a separate chore."
echo
echo "DNS for $FQDN can now be removed."
