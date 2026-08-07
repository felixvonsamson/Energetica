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

# --- Resolve a Python that can import `energetica` -------------------------------
# Two steps below need it: validating the recap, and retiring the fragment. Both call landing-dir
# logic (load_recap / retire_fragment) that reads nothing but the landing dir and knows nothing
# about the game domain, so ANY deployed copy on this box answers identically. Prefer this
# instance's own venv, then the lobby's, then any sibling instance's.
#
# Resolved as a hard precondition rather than checked at each use, because the failure mode of
# "no interpreter" differs from the failure mode of every other missing path here. A missing unit
# or vhost means the work is already done; a missing interpreter means we cannot tell whether the
# recap is readable or retire the fragment correctly — and this script's next act is to delete the
# state that would let anyone fix it afterwards. Not being able to check must never read as a
# clean check, so it stops the whole thing.
CODE_ROOT=""
for candidate in "$APP_DIR" /var/www/energetica-lobby /var/www/energetica-*; do
    if [ -x "$candidate/.venv/bin/python" ] && [ -f "$candidate/energetica/instance_config.py" ]; then
        CODE_ROOT="$candidate"
        break
    fi
done
if [ -z "$CODE_ROOT" ]; then
    log_error "Found no deployed Energetica code with a usable venv on this server."
    log_error "Looked in $APP_DIR, /var/www/energetica-lobby, and every /var/www/energetica-*."
    log_error "Without one this script cannot verify the recap or retire the landing fragment,"
    log_error "and it would delete the state needed to repair either. Refusing to continue."
    echo
    echo "Deploy any instance or the lobby first, then re-run."
    exit 1
fi

# Run a snippet against the landing dir. Dropped to the service user so anything it rewrites
# (instances.json) keeps the ownership the instance backends expect, rather than becoming
# root-owned behind their backs.
#
# Run from a throwaway cwd, because importing `energetica` constructs the dormant GameEngine,
# whose __init__ does Path("instance").mkdir() — RELATIVE to the working directory. An admin
# running this from /root or a home dir would otherwise either litter an empty instance/ there or,
# where the service user cannot write, fail the import outright and make a permission error look
# like a corrupt recap. A temp dir the service user owns is writable by definition and takes the
# stray directory with it.
run_landing_py() {
    local workdir rc=0
    workdir="$(mktemp -d)"
    # mktemp -d is 0700 root-owned; without this the service user cannot even cd into it.
    # A failure here returns non-zero rather than tripping set -e, so the caller reports it as
    # "could not check" instead of the script dying with no explanation.
    if ! chown energetica "$workdir"; then
        rm -rf "$workdir"
        return 1
    fi
    (
        cd "$workdir" || exit 1
        ENERGETICA_LANDING_DIR="$LANDING_DIR" ENERGETICA_INSTANCE_CONFIG_DIR=/etc/energetica \
            sudo -u energetica -E "$CODE_ROOT/.venv/bin/python" -c "
import sys
sys.path.insert(0, '$CODE_ROOT')
from energetica import instance_config
$1
"
    ) || rc=$?
    rm -rf "$workdir"
    return "$rc"
}

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
#
# Exit 3 means specifically "read it, it does not parse". Anything else non-zero means the check
# itself failed — a broken interpreter, an import error, a permissions problem — which is NOT
# evidence about the recap and must not be reported as such. Both abort, but they abort with the
# truth, because "could not check" and "checked, it is broken" call for different fixes.
RECAP_CHECK_RC=0
if [ -f "$RECAP" ]; then
    run_landing_py "sys.exit(0 if instance_config.load_recap('$INSTANCE') is not None else 3)" || RECAP_CHECK_RC=$?
    if [ "$RECAP_CHECK_RC" -ne 0 ] && [ "$RECAP_CHECK_RC" -ne 3 ]; then
        log_error "Could not verify the recap at $RECAP (checker exited $RECAP_CHECK_RC, ran against $CODE_ROOT)."
        log_error "That is a failure of the check, not a verdict on the recap. Refusing to tear down"
        log_error "an instance whose recap might still be readable — fix the checker and re-run."
        exit 1
    fi
    if [ "$RECAP_CHECK_RC" -eq 3 ]; then
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

# --- 2. Retire the fragment (before the code it needs may be deleted) -----------
# The keep-or-delete rule lives in energetica.instance_config.retire_fragment, which also
# re-aggregates instances.json. Done before step 5 removes the app dir, since that dir is the
# preferred CODE_ROOT. A failure here aborts rather than warning: leaving a stale fragment behind
# while the rest of the teardown proceeds would point the picker at a subdomain that no longer
# answers, and by then the run is gone — the same "don't destroy what you couldn't check" stance
# as the recap preflight. set -e would catch this anyway; it is spelled out for the message.
log_section "LANDING FRAGMENT"
if ! run_landing_py "print('deleted' if instance_config.retire_fragment('$INSTANCE') else 'kept')"; then
    log_error "Could not retire the fragment (ran against $CODE_ROOT). Stopping before anything is deleted."
    log_error "The picker would otherwise keep listing $INSTANCE with nothing behind it."
    exit 1
fi
log_success "Fragment retired and instances.json re-aggregated"

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
