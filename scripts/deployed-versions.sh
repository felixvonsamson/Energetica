#!/bin/bash
set -euo pipefail

# Energetica — show the deployed version of the landing, the lobby and every instance on a
# server, and how each compares to a reference commit (default: origin/main).
#
#   ./scripts/deployed-versions.sh --server <ssh-host> --domain <apex> [--ref <git-ref>]
#
# Reads each component's public /healthz (added for the lobby in the same change that added
# this script) and prints its stamped backend commit, frontend commit, dirty flags, and a
# BEHIND / up-to-date / dirty verdict against the reference. The landing has no backend, so
# its build-info.json is fetched from the apex instead. Instances are enumerated from
# systemd, the same source of truth as list-instances.sh.
#
# This is a read-only diagnostic — it deploys nothing. Requires git (locally) and jq.

REMOTE_HOST="${DEPLOY_HOST:-}"
# Never varied across this server's history — hardcoded rather than a configurable
# parameter (YAGNI); the OS account named "deploy" must already exist.
readonly REMOTE_USER="deploy"
DOMAIN="${DEPLOY_DOMAIN:-}"
REF="origin/main"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server) REMOTE_HOST="$2"; shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
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
# probe the landing and the lobby too.
# energetica-lobby and energetica-reaper share the prefix but are not game instances, so they
# are dropped from SLUGS by name (the lobby is probed separately below). list-instances.sh
# applies the same exclusion; keep the two in step.
SLUGS=$(ssh "$SSH" 'systemctl list-unit-files --no-legend "energetica-*.service" 2>/dev/null | awk "{print \$1}" | grep "^energetica-.*\.service$" | sed -E "s/^energetica-(.*)\.service$/\1/" | grep -vE "^(lobby|reaper)$"' || true)

# Classify a deployed backend commit against the reference by git ancestry, so a deploy that is
# ahead of or diverged from the reference is not mislabelled "behind". Needs the commit object
# present locally; a deploy built from an unfetched commit is reported "differs?" rather than
# guessed. Callers handle the unknown/dirty cases before this runs.
classify() {
    local commit="$1"
    [ "$commit" = "$REF_FULL" ] && { echo "up-to-date"; return; }
    git cat-file -e "${commit}^{commit}" 2>/dev/null || { echo "differs?"; return; }
    git merge-base --is-ancestor "$commit" "$REF_FULL" 2>/dev/null && { echo "BEHIND"; return; }
    git merge-base --is-ancestor "$REF_FULL" "$commit" 2>/dev/null && { echo "ahead"; return; }
    echo "DIVERGED"
}

# One /healthz probe → one table row. Verdict precedence: unreachable > no stamp > dirty >
# ancestry (behind / ahead / diverged / up-to-date). "dirty" (either half) wins over the ancestry
# verdict because a dirty deploy's commit is not fully trustworthy in the first place.
probe() {
    local label="$1" url="$2"
    local body be_full be fe be_dirty fe_dirty verdict
    body=$(curl -fsS --max-time 8 "$url/healthz" 2>/dev/null || true)
    if [ -z "$body" ]; then
        echo "$label|$url|unreachable|-|UNREACHABLE"; return
    fi
    be_full=$(echo "$body" | jq -r '.version.backend.commit // ""' 2>/dev/null || echo "")
    be=$(echo "$body" | jq -r '.version.backend.commit_short // "?"' 2>/dev/null || echo "?")
    fe=$(echo "$body" | jq -r '.version.frontend.commit_short // "?"' 2>/dev/null || echo "?")
    be_dirty=$(echo "$body" | jq -r '.version.backend.dirty // false' 2>/dev/null || echo false)
    fe_dirty=$(echo "$body" | jq -r '.version.frontend.dirty // false' 2>/dev/null || echo false)
    [ "$be_dirty" = "true" ] && be="$be*"
    [ "$fe_dirty" = "true" ] && fe="$fe*"

    if [ -z "$be_full" ]; then
        verdict="no-stamp"
    elif [ "$be_dirty" = "true" ] || [ "$fe_dirty" = "true" ]; then
        verdict="DIRTY"
    else
        verdict=$(classify "$be_full")
    fi
    echo "$label|$url|$be|$fe|$verdict"
}

# The landing is pure static, so it has no /healthz and no backend half: its only stamp is the
# build-info.json the vite build writes into the bundle. The apex's FallbackResource answers a
# missing file with index.html (HTTP 200), so a landing built before the stamp existed returns
# HTML here; jq fails to parse it and the row reads "no-stamp".
probe_landing() {
    local url="$1"
    local body fe_full fe fe_dirty verdict
    body=$(curl -fsS --max-time 8 "$url/build-info.json" 2>/dev/null || true)
    if [ -z "$body" ]; then
        echo "landing|$url|-|unreachable|UNREACHABLE"; return
    fi
    fe_full=$(echo "$body" | jq -r '.commit // ""' 2>/dev/null || echo "")
    fe=$(echo "$body" | jq -r '.commit_short // "?"' 2>/dev/null || echo "?")
    fe_dirty=$(echo "$body" | jq -r '.dirty // false' 2>/dev/null || echo false)
    [ "$fe_dirty" = "true" ] && fe="$fe*"

    if [ -z "$fe_full" ]; then
        verdict="no-stamp"
    elif [ "$fe_dirty" = "true" ]; then
        verdict="DIRTY"
    else
        verdict=$(classify "$fe_full")
    fi
    echo "landing|$url|-|$fe|$verdict"
}

{
    echo "COMPONENT|URL|BACKEND|FRONTEND|VS-REF"
    probe_landing "https://$DOMAIN"
    probe "lobby" "https://lobby.$DOMAIN"
    for slug in $SLUGS; do
        probe "$slug" "https://$slug.$DOMAIN"
    done
} | column -t -s '|'

echo
echo "* = built/deployed from a tree with uncommitted changes (commit is not the whole truth)."
echo "VS-REF: up-to-date | BEHIND | ahead | DIVERGED (vs $REF); differs? = commit not fetched locally."
