#!/bin/bash
set -euo pipefail

# Energetica — show the deployed version of every instance + the lobby on a server, and how
# each compares to a reference commit (default: origin/main).
#
#   ./scripts/deployed-versions.sh --server <ssh-host> --domain <apex> \
#        [--user <ssh-user>] [--ref <git-ref>]
#
# Reads each component's public /healthz (added for the lobby in the same change that added
# this script) and prints its stamped backend commit, frontend commit, dirty flags, and a
# BEHIND / up-to-date / dirty verdict against the reference. Instances are enumerated from
# systemd, the same source of truth as list-instances.sh.
#
# This is a read-only diagnostic — it deploys nothing. Requires git (locally) and jq.

REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_USER="${DEPLOY_USER:-deploy}"
DOMAIN="${DEPLOY_DOMAIN:-}"
REF="origin/main"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
        --user) REMOTE_USER="$2"; shift 2 ;;
        --ref) REF="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

[ -n "$REMOTE_HOST" ] || { echo "--server is required (or set DEPLOY_HOST)" >&2; exit 1; }
[ -n "$DOMAIN" ]      || { echo "--domain is required (or set DEPLOY_DOMAIN)" >&2; exit 1; }
command -v jq  >/dev/null || { echo "jq is required (used to parse /healthz)." >&2; exit 1; }
command -v git >/dev/null || { echo "git is required (used to resolve the reference commit)." >&2; exit 1; }

SSH="${REMOTE_USER}@${REMOTE_HOST}"

# Reference commit to compare against. Short to 9 chars to match the stamp (git --short=9 /
# version.py's commit[:9]). A missing ref (e.g. origin/main not fetched) is fatal: comparing
# against nothing would silently call every deploy "unknown".
REF_FULL=$(git rev-parse "$REF" 2>/dev/null) || { echo "Cannot resolve git ref '$REF' — fetch it first (e.g. 'git fetch origin main')." >&2; exit 1; }
REF_SHORT=${REF_FULL:0:9}
echo "Reference: $REF = $REF_SHORT"
echo

# Enumerate instance slugs from systemd (same source of truth as list-instances.sh), then
# probe the lobby too. The landing site is pure static with no /healthz, so it is not listed.
SLUGS=$(ssh "$SSH" 'systemctl list-unit-files --no-legend "energetica-*.service" 2>/dev/null | awk "{print \$1}" | grep "^energetica-.*\.service$" | sed -E "s/^energetica-(.*)\.service$/\1/" | grep -v "^lobby$"' || true)

# One /healthz probe → one table row. Verdict precedence: unreachable > no stamp > dirty >
# behind > up-to-date. "dirty" (either half) wins over "behind" because a dirty deploy's commit
# is not fully trustworthy in the first place — flag that before comparing SHAs.
probe() {
    local label="$1" url="$2"
    local body be fe be_dirty fe_dirty verdict
    body=$(curl -fsS --max-time 8 "$url/healthz" 2>/dev/null || true)
    if [ -z "$body" ]; then
        echo "$label|$url|unreachable|-|UNREACHABLE"; return
    fi
    be=$(echo "$body" | jq -r '.version.backend.commit_short // "?"' 2>/dev/null || echo "?")
    fe=$(echo "$body" | jq -r '.version.frontend.commit_short // "?"' 2>/dev/null || echo "?")
    be_dirty=$(echo "$body" | jq -r '.version.backend.dirty // false' 2>/dev/null || echo false)
    fe_dirty=$(echo "$body" | jq -r '.version.frontend.dirty // false' 2>/dev/null || echo false)
    [ "$be_dirty" = "true" ] && be="$be*"
    [ "$fe_dirty" = "true" ] && fe="$fe*"

    if [ "$be" = "?" ]; then
        verdict="no-stamp"
    elif [ "$be_dirty" = "true" ] || [ "$fe_dirty" = "true" ]; then
        verdict="DIRTY"
    elif [ "${be%\*}" = "$REF_SHORT" ]; then
        verdict="up-to-date"
    else
        verdict="BEHIND"
    fi
    echo "$label|$url|$be|$fe|$verdict"
}

{
    echo "COMPONENT|URL|BACKEND|FRONTEND|VS-REF"
    probe "lobby" "https://lobby.$DOMAIN"
    for slug in $SLUGS; do
        probe "$slug" "https://$slug.$DOMAIN"
    done
} | column -t -s '|'

echo
echo "* = built/deployed from a tree with uncommitted changes (commit is not the whole truth)."
