#!/bin/bash
set -euo pipefail

# Energetica — provision a single game instance. Run per instance, as root, AFTER
# setup-base.sh and setup-landing.sh.
#
#   sudo bash scripts/infra/setup-instance.sh <instance> <port> --domain <apex-domain> \
#        [--name "<display name>"] [--no-advertise] [--starts-at <ISO-8601-UTC>] \
#        [--freeze-at <ISO-8601-UTC>] [--ended-at <ISO-8601-UTC>] \
#        [--clock-time <seconds>] [--in-game-seconds-per-tick <seconds>] [--yes]
#
# --starts-at/--freeze-at/--ended-at are the lifecycle boundaries (announced→active→freeze→ended).
# --freeze-at and --ended-at are optional (omit → null → an open-ended run); when given they must
# run forward: starts_at ≤ freeze_at ≤ ended_at (the backend rejects a config that doesn't).
#
# --clock-time / --in-game-seconds-per-tick end up in /etc/energetica/{instance}/instance.env,
# which the unit expands into main.py's --clock_time / --in_game_seconds_per_tick. The engine
# reads them at init_instance() on the instance's very first tick and from nowhere else
# afterwards, so changing them for an instance that has already ticked does nothing — that still
# means tearing down and recreating it (see teardown-instance.sh). Defaults here match main.py's
# argparse defaults, so omitting them reproduces today's behavior.
#
# Creates the instance dir + venv, the admin-owned /etc/energetica/{instance}/{instance.json,
# instance.env}, the Apache vhost + TLS, and the energetica-{instance}.service unit (enabled,
# NOT started).
#
# This script does NOT ship application code — there is no git on the server (Option A).
# The FIRST run of ./scripts/deploy-instance.sh rsyncs the backend, installs deps into the
# venv, and starts the service (which then publishes its landing fragment).
#
# Requires DNS for {instance}.{apex-domain} to already resolve here (for TLS issuance).

DOMAIN="${ENERGETICA_DOMAIN:-}"
# Never varied across this server's history — hardcoded rather than a configurable
# parameter (YAGNI); the OS account named "deploy" must already exist (setup-base.sh).
readonly DEPLOY_USER="deploy"
NAME=""
ADVERTISED="true"
STARTS_AT=""
FREEZE_AT=""
ENDED_AT=""
# Must match main.py's argparse defaults/choices exactly — this is a second entry point to the
# same flags, and a drift here would silently provision instances main.py itself would reject.
CLOCK_TIME=30
IN_GAME_SECONDS_PER_TICK=240
CLOCK_TIME_CHOICES="60 30 20 15 12 10 6 5 4 3 2 1"
TICK_CHOICES="3600 1800 1200 900 600 540 480 420 360 300 240 180 120 60 30"
AUTO_CONFIRM=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

POSITIONAL=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --name) NAME="$2"; shift 2 ;;
        --no-advertise) ADVERTISED="false"; shift ;;
        --starts-at) STARTS_AT="$2"; shift 2 ;;
        --freeze-at) FREEZE_AT="$2"; shift 2 ;;
        --ended-at) ENDED_AT="$2"; shift 2 ;;
        --clock-time) CLOCK_TIME="$2"; shift 2 ;;
        --in-game-seconds-per-tick) IN_GAME_SECONDS_PER_TICK="$2"; shift 2 ;;
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
# Restrict to a real hostname: guarantees no sed-metachar reaches the vhost substitution, and
# rejects typos that would otherwise only surface as a certbot/Apache failure later.
if ! [[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
    log_error "Invalid domain: '$DOMAIN' (expected a hostname like energetica-game.org)"
    exit 1
fi
if ! [[ "$INSTANCE" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
    log_error "Instance slug must be lowercase kebab-case, max 63 chars (a DNS label): '$INSTANCE'"
    exit 1
fi
if [ "$INSTANCE" = "landing" ]; then
    log_error "'landing' is reserved for the apex landing site"
    exit 1
fi
if [ "$INSTANCE" = "lobby" ]; then
    log_error "'lobby' is reserved for the lobby service (setup-lobby.sh)"
    exit 1
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    log_error "Port must be an integer 1024-65535: '$PORT'"
    exit 1
fi
if [[ " $CLOCK_TIME_CHOICES " != *" $CLOCK_TIME "* ]]; then
    log_error "--clock-time must be one of: $CLOCK_TIME_CHOICES (got '$CLOCK_TIME')"
    exit 1
fi
if [[ " $TICK_CHOICES " != *" $IN_GAME_SECONDS_PER_TICK "* ]]; then
    log_error "--in-game-seconds-per-tick must be one of: $TICK_CHOICES (got '$IN_GAME_SECONDS_PER_TICK')"
    exit 1
fi
getent group energetica >/dev/null || { log_error "group 'energetica' missing — run setup-base.sh first"; exit 1; }
[ -d /var/www/energetica-landing/instances ] || { log_error "landing not set up — run setup-landing.sh first"; exit 1; }

# Defaults for instance.json.
[ -n "$NAME" ] || NAME="$(echo "$INSTANCE" | awk -F- 'BEGIN{OFS=" "}{for(i=1;i<=NF;i++){$i=toupper(substr($i,1,1)) substr($i,2)}}1')"
[ -n "$STARTS_AT" ] || STARTS_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# instance.json is JSON rendered from the template via sed. A value containing a double-quote
# or backslash would break the JSON; the sed replacement metacharacters (& / \) would corrupt
# the substitution itself. Reject the JSON-breakers (auto defaults never contain them) and
# escape the sed-special chars — for both interpolated values, since --starts-at is interpolated
# into a JSON string too.
case "$NAME" in
    *[\"\\]*) log_error "--name must not contain double-quotes or backslashes"; exit 1 ;;
esac
case "$STARTS_AT" in
    *[\"\\]*) log_error "--starts-at must not contain double-quotes or backslashes"; exit 1 ;;
esac
case "$FREEZE_AT" in
    *[\"\\]*) log_error "--freeze-at must not contain double-quotes or backslashes"; exit 1 ;;
esac
case "$ENDED_AT" in
    *[\"\\]*) log_error "--ended-at must not contain double-quotes or backslashes"; exit 1 ;;
esac
sed_escape() { printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'; }

# freeze_at / ended_at are nullable JSON: render a bare `null` when unset, else a quoted string.
# The whole token (quotes included) is the sed replacement, so the template carries @FREEZE_AT@
# unquoted — unlike starts_at, which is never null and keeps its literal quotes in the template.
if [ -n "$FREEZE_AT" ]; then FREEZE_AT_JSON="\"$(sed_escape "$FREEZE_AT")\""; else FREEZE_AT_JSON="null"; fi
if [ -n "$ENDED_AT" ]; then ENDED_AT_JSON="\"$(sed_escape "$ENDED_AT")\""; else ENDED_AT_JSON="null"; fi

APP_DIR="/var/www/energetica-$INSTANCE"
CONFIG_DIR="/etc/energetica/$INSTANCE"
FQDN="$INSTANCE.$DOMAIN"
VHOST="/etc/apache2/sites-available/energetica-$INSTANCE.conf"
UNIT="/etc/systemd/system/energetica-$INSTANCE.service"

# This script is for first-time provisioning only, never for editing a live instance. $UNIT is
# the last thing a successful run writes (step 9 below), so its presence means a prior run of
# THIS script already completed for $INSTANCE — everything from here on rewrites unconditionally
# (the unit, the vhost, instance.env) or is a no-op (the venv, instance.json), so rerunning would
# silently replace whatever port and clock_time/in_game_seconds_per_tick the instance is actually
# running with. The two clock values are read only once, at the engine's first tick, and never
# again — changing them for a live instance needs teardown-instance.sh followed by a fresh run of
# this script, not a rerun of it.
# (A unit that does NOT exist yet means an earlier run failed before reaching step 9, so nothing
# is live and rerunning to retry is still safe — this check does not block that.)
if [ -f "$UNIT" ]; then
    log_error "$INSTANCE is already provisioned ($UNIT exists) — refusing to run again."
    log_error "To ship new code: ./scripts/deploy-instance.sh --server <ssh-host> --instance $INSTANCE --domain $DOMAIN"
    log_error "To change clock_time/in_game_seconds_per_tick or any other first-run setting: teardown-instance.sh $INSTANCE --domain $DOMAIN, then re-run this script."
    exit 1
fi

log_section "PROVISION INSTANCE: $INSTANCE (port $PORT, $FQDN)"
echo "  name:       $NAME"
echo "  advertised: $ADVERTISED"
echo "  starts_at:  $STARTS_AT"
echo "  freeze_at:  ${FREEZE_AT:-<null, open-ended>}"
echo "  ended_at:   ${ENDED_AT:-<null, open-ended>}"
echo "  clock_time: ${CLOCK_TIME}s"
echo "  tick:       ${IN_GAME_SECONDS_PER_TICK} in-game seconds"
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
# Checkpoints dir: same deal — create_app() does Path("checkpoints").mkdir(exist_ok=True) and the
# tick loop writes checkpoints/{new,last}_checkpoint.tar.gz here, but the service user cannot
# create it under the deploy-owned (non-group-writable) app root. Pre-create it service-owned so
# the mkdir is a no-op and checkpoints are writable. Excluded from deploy rsync for the same
# reason as instance/ (runtime state the service owns; a shipped copy would reown it to deploy).
install -d -o energetica -g energetica -m 2770 "$APP_DIR/checkpoints"
log_success "$APP_DIR (code, deploy-owned) and $APP_DIR/{instance,checkpoints} (game state, service-owned)"

if [ -x "$APP_DIR/.venv/bin/python" ]; then
    log_success "venv already present at $APP_DIR/.venv"
else
    log_step "Creating venv (populated by first deploy)..."
    # $APP_DIR is deploy-owned and only group-readable by energetica, so energetica cannot
    # mkdir .venv inside it. Pre-create .venv owned by energetica (the service user that runs
    # `sudo -u energetica pip install` during deploys and must write here); `python3 -m venv`
    # then populates a directory it already owns. Keeps the code dir deploy-owned (least
    # privilege) without giving energetica write on the whole instance tree.
    install -d -o energetica -g energetica -m 0750 "$APP_DIR/.venv"
    sudo -u energetica python3 -m venv "$APP_DIR/.venv"
    log_success "venv at $APP_DIR/.venv"
fi

# --- 3. Admin-owned instance.json ----------------------------------------------
log_section "INSTANCE CONFIG"
# Created root-only (0700) and opened up to 1770 at the end of this section, not here.
#
# Every operation below acts on a pathname, and a pathname in a group-writable directory can be
# swapped between the moment it is checked and the moment it is used. Rather than harden each
# one against that, take the directory away from the group for the duration: while it is 0700,
# no process but root can create, unlink or rename anything inside it, so there is no window to
# race. That costs nothing here — this instance has no unit yet (step 9) and therefore no
# service running, and nothing else on the box reads this directory unprivileged.
#
# The renders below stay symlink-safe on their own terms anyway. The lock is the belt; they are
# the braces, and they are what keeps this correct if the lock is ever removed.
install -d -o root -g energetica -m 0700 "$CONFIG_DIR"
chmod 0700 "$CONFIG_DIR"

# Neither config file may be a symlink, and this refuses rather than repairs.
#
# $CONFIG_DIR is group-writable, and sticky stops a group member *unlinking* what is already
# there — not *creating* what is not. This script is documented as safe to re-run after a failed
# attempt (see the $UNIT guard above), and the usual failure is certbot at step 6: DNS has not
# propagated, or Let's Encrypt rate-limits. That leaves this directory standing, with no config
# files in it, for as long as it takes to fix and re-run. Any member of the energetica group —
# www-data, deploy, or the service user *every other instance on this box already runs as* — can
# drop a symlink here in the meantime. A root-run `>` redirect would follow it and write through
# as root; the chown and chmod after it would land on whatever it points at.
#
# A link planted during an earlier window is still sitting here now, so the lock above does not
# make this check redundant: it stops new ones appearing, not old ones being followed. The
# renders go through install_rendered() and cannot follow a link; this covers the "already
# exists" branch, whose chown and chmod would otherwise land on the link's target.
for candidate in instance.json instance.env; do
    if [ -L "$CONFIG_DIR/$candidate" ]; then
        log_error "$CONFIG_DIR/$candidate is a symlink. Refusing to write through it."
        log_error "Nothing here creates one, so either an admin did, or a member of the"
        log_error "energetica group planted it. Inspect it and remove it by hand before re-running."
        exit 1
    fi
done

# Render stdin into $CONFIG_DIR safely. mktemp creates the scratch file with O_EXCL so it cannot
# be pre-empted, then rename(2) puts it in place — atomically, so no reader sees a half-written
# config, and replacing a symlink rather than following it.
#
# The chown comes AFTER the rename, and that ordering is the point. Chowning the scratch file
# first would hand it to the shared `energetica` user while it still sits at a temporary name,
# and under the sticky bit the owner of an entry is exactly who may unlink it — so any process
# running as that user (every other instance on this box) could swap in its own file or symlink
# in the gap before the mv, and root would install the result as this instance's config. Held
# root-owned until it lands, the scratch file is unlinkable by nobody but root; once it lands,
# $dest is a root-owned entry in a sticky directory, so the pathname the chown resolves cannot
# be replaced either.
install_rendered() {
    local dest="$1" owner="$2" rendered
    rendered="$(mktemp "$dest.XXXXXX")"
    cat > "$rendered"
    chmod 0640 "$rendered"
    mv -f "$rendered" "$dest"
    chown "$owner" "$dest"
}

if [ -f "$CONFIG_DIR/instance.json" ]; then
    # The content is the admin's and stays untouched, but ownership is re-asserted every time.
    # Under the sticky bit the service can only replace a file it owns, and this branch is
    # exactly where a root-owned instance.json survives: left by a run of the pre-#1072 script
    # that failed before the unit, or by an admin's editor saving by rename. Accepting it as-is
    # would provision an instance whose facilitator writes fail on the first private-access
    # change (#1019), with nothing in this run's output hinting why.
    chown energetica:energetica "$CONFIG_DIR/instance.json"
    chmod 0640 "$CONFIG_DIR/instance.json"
    log_success "$CONFIG_DIR/instance.json already exists — content kept, ownership re-asserted"
else
    sed -e "s/@NAME@/$(sed_escape "$NAME")/g" \
        -e "s/@ADVERTISED@/$ADVERTISED/g" \
        -e "s/@STARTS_AT@/$(sed_escape "$STARTS_AT")/g" \
        -e "s/@FREEZE_AT@/$FREEZE_AT_JSON/g" \
        -e "s/@ENDED_AT@/$ENDED_AT_JSON/g" \
        "$SCRIPT_DIR/instance.json.tmpl" | install_rendered "$CONFIG_DIR/instance.json" energetica:energetica
    # Owned by the service, not by root, because the service is what rewrites it — the
    # facilitator surface persists private-access changes here (#1019). Once the directory is
    # sticky, ownership is what permits that rename, so this is the permissions finally saying
    # out loud what was already true. install_rendered sets the 0640 with it: group (deploy,
    # www-data) reads, root still edits by hand since root bypasses the mode, and
    # instance_config.py re-asserts the same mode on every write it makes.
    #
    # An admin who edits this file with an editor that saves by rename (vim's default
    # backupcopy, emacs) leaves it owned by whoever ran the editor, and the service can then no
    # longer replace it. _atomic_write_json reports that case with the chown that fixes it.
    log_success "Rendered $CONFIG_DIR/instance.json (public, advertised=$ADVERTISED)"
fi

# instance.env is the unit's EnvironmentFile — the whole of this instance's runtime
# configuration, including the port, in one root-owned place anything on the box can read.
# Rendered unconditionally, unlike instance.json: instance.json may already carry admin edits
# (policy, join token) that this script must not clobber, whereas every value here comes from
# this run's own arguments. Reaching this line at all means no prior run got as far as the unit
# (see the guard above), so any instance.env sitting here is a failed run's leftover and the
# arguments in hand are the current truth.
sed -e "s/@INSTANCE@/$INSTANCE/g" \
    -e "s/@PORT@/$PORT/g" \
    -e "s/@CLOCK_TIME@/$CLOCK_TIME/g" \
    -e "s/@IN_GAME_SECONDS_PER_TICK@/$IN_GAME_SECONDS_PER_TICK/g" \
    "$SCRIPT_DIR/instance.env.tmpl" | install_rendered "$CONFIG_DIR/instance.env" root:energetica
# root-owned and 0640: systemd reads it as root when starting the unit, and the service user and
# the deploy user read it through the energetica group. Nothing but root can write it, and under
# the sticky bit on $CONFIG_DIR nothing but root can unlink it either — so it is no easier to
# tamper with here than as the /etc/systemd/system unit whose contents it took over.
log_success "Rendered $CONFIG_DIR/instance.env (port $PORT, clock ${CLOCK_TIME}s, tick ${IN_GAME_SECONDS_PER_TICK}s)"

# Both files are in place and correctly owned, so the directory can take its running mode.
# 1770 = group-writable + sticky, and both halves are load-bearing.
#
# Group-writable because the running service (group energetica) needs to *write* here, not just
# read: a private instance's facilitator surface persists join tokens/allowlist changes back to
# instance.json through src/energetica/instance_config.py's atomic write, which creates a tmp
# sibling and renames it over the target. Renaming into a directory needs write permission on it.
# See #1019.
#
# Sticky because that write permission is otherwise all-or-nothing: it would let every member of
# the group (the service, deploy, www-data) unlink *any* file here, including instance.env, whose
# variables tell the service where to read accounts and write state. Sticky narrows it to "only
# the file's owner may replace it", which makes each file's owner the answer for that file alone:
# instance.json by the service that rewrites it, instance.env by root and nobody else. See #1072.
#
# Set with an explicit chmod rather than `install -m 1770`: BSD and GNU install disagree about
# whether -m applies the sticky bit, and this is not a bit to leave to the local implementation.
chmod 1770 "$CONFIG_DIR"
log_success "$CONFIG_DIR opened to 1770 (group-writable + sticky)"

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
# --- 7. Full vhost --------------------------------------------------------------
# Delegated rather than inlined (#1071). This script refuses to run twice on a provisioned
# instance, so a substitution written here would be reachable only at provisioning time and
# every later change to the template would be a hand edit on every server.
# update-instance-vhost.sh is that one renderer, and it is rerunnable; it reads the port from
# the instance.env written in step 3 rather than taking it from here, so the two cannot disagree.
bash "$SCRIPT_DIR/update-instance-vhost.sh" "$INSTANCE" --domain "$DOMAIN"

# --- 8. Certbot reload-on-renewal hook: installed once per server by setup-base.sh (no-op here).

# --- 9. systemd unit (enabled, not started — no code yet) ----------------------
log_section "SYSTEMD UNIT"
# Only the slug: port and clock values reach the unit through the instance.env written above.
sed -e "s/@INSTANCE@/$INSTANCE/g" \
    "$SCRIPT_DIR/energetica.service" > "$UNIT"
systemctl daemon-reload
systemctl enable "energetica-$INSTANCE" >/dev/null
log_success "energetica-$INSTANCE.service enabled (not started)"

log_section "INSTANCE PROVISIONED"
echo "Ship code and start the service from your machine:"
echo "  ./scripts/deploy-instance.sh --server <ssh-host> --instance $INSTANCE --domain $DOMAIN"
echo
echo "For a private/unadvertised instance, edit the policy before first login:"
echo "  sudo \$EDITOR $CONFIG_DIR/instance.json   # set advertised/access.policy"
echo "Then grant access to moderators via the following script:"
echo "  cd /var/www/energetica-lobby && ./scripts/grant-facilitator.py --username <username> --slug $INSTANCE"
echo "Then grow its player roster (facilitator UI, or from the shell, from the lobby directory):"
echo "  cd /var/www/energetica-lobby && ./scripts/whitelist-run.py $INSTANCE add <username> [<username> ...]"
