#!/bin/bash
set -euo pipefail

# Energetica — reap every instance whose ended_at has passed. Run as root, on a timer.
#
#   sudo bash scripts/infra/reap-instances.sh [--dry-run] [--instance <slug>]
#
# This is the lifecycle's ONE external transition (T7, #865). announced→active and active→freeze
# are self-driven: the instance reads its own clock each tick and pauses or freezes itself. But a
# process cannot cleanly stop itself, so freeze→ended is driven from outside — this sweep, wired
# to energetica-reaper.timer by setup-base.sh.
#
# Reaping is deliberately NARROW: stop the service and disable it, nothing else.
#
#   - stop     — the run goes dark. Its sim already halted at freeze_at (T3), so nothing is lost.
#   - disable  — without this the unit is still Restart=always and WantedBy=multi-user.target, so
#                the next reboot would resurrect a run the clock has already ended.
#
# Everything else is left standing: the vhost, the TLS cert, the pickle, /etc/energetica/{slug}/,
# and — the point of the whole exercise — the recap and fragment on the landing dir, which is why
# the recap outlives the process it was minted by. Removing an instance for good is a separate,
# deliberate, manual act: scripts/infra/teardown-instance.sh.
#
# Idempotent and self-healing: an already-stopped run is skipped, and a sweep missed during
# downtime simply reaps on the next tick. An admin editing ended_at (bringing it forward to force
# an early reap, or pushing it back) takes effect on the next sweep with no re-arming — the same
# "re-read the config, no restart" contract as the freeze clock and the whitelist.
#
# Requires jq. A run with ended_at: null is open-ended and is never reaped.

CONFIG_ROOT="${ENERGETICA_INSTANCE_CONFIG_DIR:-/etc/energetica}"
DRY_RUN=false
ONLY_INSTANCE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --instance) ONLY_INSTANCE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; echo "Usage: sudo bash reap-instances.sh [--dry-run] [--instance <slug>]"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }

[ "$EUID" -eq 0 ] || { log_error "Must run as root (stopping units and reading root-owned configs)"; exit 1; }
command -v jq >/dev/null 2>&1 || { log_error "jq is required"; exit 1; }
[ -d "$CONFIG_ROOT" ] || { log_error "No instance config root at $CONFIG_ROOT"; exit 1; }

NOW_EPOCH="$(date -u +%s)"
REAPED=0

for config in "$CONFIG_ROOT"/*/instance.json; do
    # No instance configured yet: the glob stays literal, so there is nothing to sweep.
    [ -e "$config" ] || continue

    slug="$(basename "$(dirname "$config")")"
    [ -z "$ONLY_INSTANCE" ] || [ "$slug" = "$ONLY_INSTANCE" ] || continue

    # server.json is a sibling FILE under $CONFIG_ROOT, not a slug dir, so the glob never
    # reaches it — but the reserved names would be catastrophic to stop, so refuse explicitly.
    if [ "$slug" = "landing" ] || [ "$slug" = "lobby" ]; then
        log_error "refusing to reap reserved slug '$slug'"
        continue
    fi

    # A malformed config must not abort the sweep: the other runs on this box still need reaping,
    # and the fix for a broken file is an admin edit, not a stalled reaper. (Reading a phase we
    # cannot trust also has to fail SAFE — an unparseable ended_at leaves the run up, matching
    # current_phase()'s fail-open-to-active: the clock only ever ends a run on a positive signal.)
    ended_at="$(jq -r '.ended_at // empty' "$config" 2>/dev/null)" || {
        log_error "$slug: cannot read $config — skipping"
        continue
    }
    [ -n "$ended_at" ] || continue  # open-ended run, never reaped

    ended_epoch="$(date -u -d "$ended_at" +%s 2>/dev/null)" || {
        log_error "$slug: unparseable ended_at ($ended_at) — skipping"
        continue
    }
    [ "$NOW_EPOCH" -ge "$ended_epoch" ] || continue  # not ended yet

    unit="energetica-$slug"
    # Already reaped: inactive AND not enabled. Checking both means a half-reaped run (stopped by
    # hand but still enabled, so a reboot revives it) is completed rather than skipped.
    if ! systemctl is-active --quiet "$unit" && ! systemctl is-enabled --quiet "$unit" 2>/dev/null; then
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        log_step "would reap $slug (ended_at $ended_at has passed)"
        REAPED=$((REAPED + 1))
        continue
    fi

    log_step "reaping $slug (ended_at $ended_at has passed)..."
    systemctl stop "$unit" || log_error "$slug: stop failed"
    systemctl disable "$unit" >/dev/null 2>&1 || log_error "$slug: disable failed"
    log_success "$slug reaped — its recap lives on at the lobby"
    REAPED=$((REAPED + 1))
done

# Say nothing on a quiet sweep. This runs every few minutes under systemd, and a "nothing to do"
# line each time would bury the one journal entry that matters: the run that actually got reaped.
if [ "$REAPED" -gt 0 ]; then
    log_success "$REAPED instance(s) $([ "$DRY_RUN" = true ] && echo "would be reaped" || echo "reaped")"
fi
