#!/bin/bash
set -euo pipefail

# Energetica — grow (or trim) a private instance's access whitelist. Run as root on the server.
#
#   sudo bash scripts/infra/whitelist-instance.sh <instance> list
#   sudo bash scripts/infra/whitelist-instance.sh <instance> add    <username> [<username> ...]
#   sudo bash scripts/infra/whitelist-instance.sh <instance> remove <username> [<username> ...]
#
# Edits access.allowed_usernames in the admin-owned /etc/energetica/{instance}/instance.json.
# The backend re-reads instance.json on every entry (no cache), so edits take effect on the
# player's next load with NO restart and NO redeploy — this is exactly the "incremental whitelist
# edits during the announced window" the lifecycle wants (#862, T4). The access block is stripped
# from the public landing fragment, so the whitelist never leaks off-server.
#
# The instance must already be private (access.policy == "private"). Flipping public↔private is a
# policy decision left to a hand-edit of instance.json (setup-instance.sh renders public by default).
#
# Requires jq. Writes atomically (temp file + mv) and preserves the file's root:energetica 0640.

CONFIG_ROOT="${ENERGETICA_INSTANCE_CONFIG_DIR:-/etc/energetica}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_step()    { echo -e "${YELLOW}→ $1${NC}"; }
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }

usage() {
    echo "Usage: whitelist-instance.sh <instance> list"
    echo "       whitelist-instance.sh <instance> add    <username> [<username> ...]"
    echo "       whitelist-instance.sh <instance> remove <username> [<username> ...]"
    exit 1
}

[ "$EUID" -eq 0 ] || { log_error "Must run as root (the config file is root-owned)"; exit 1; }
command -v jq >/dev/null 2>&1 || { log_error "jq is required"; exit 1; }
[ "$#" -ge 2 ] || usage

INSTANCE="$1"; ACTION="$2"; shift 2
CONFIG="$CONFIG_ROOT/$INSTANCE/instance.json"

[ -f "$CONFIG" ] || { log_error "No config at $CONFIG"; exit 1; }

POLICY="$(jq -r '.access.policy // "public"' "$CONFIG")"

case "$ACTION" in
    list)
        [ "$#" -eq 0 ] || usage
        if [ "$POLICY" != "private" ]; then
            log_error "Instance '$INSTANCE' is $POLICY — no whitelist to list (edit access.policy to make it private)"
            exit 1
        fi
        jq -r '.access.allowed_usernames[]?' "$CONFIG"
        exit 0
        ;;
    add|remove) ;;
    *) usage ;;
esac

[ "$#" -ge 1 ] || usage
if [ "$POLICY" != "private" ]; then
    log_error "Instance '$INSTANCE' is $POLICY — make it private first (set access.policy=private in $CONFIG)"
    exit 1
fi

# Build the edit as a jq filter over the passed usernames. Add unions + dedupes + sorts; remove
# subtracts. `--args` passes the usernames positionally so odd characters can't break the filter.
if [ "$ACTION" = "add" ]; then
    FILTER='.access.allowed_usernames = ((.access.allowed_usernames // []) + $ARGS.positional | unique)'
else
    FILTER='.access.allowed_usernames = ((.access.allowed_usernames // []) - $ARGS.positional)'
fi

TMP="$(mktemp "$(dirname "$CONFIG")/.instance.json.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
jq "$FILTER" "$CONFIG" --args "$@" > "$TMP"
chown root:energetica "$TMP"
chmod 0640 "$TMP"
mv "$TMP" "$CONFIG"
trap - EXIT

log_success "$ACTION applied to '$INSTANCE'. Now allowed:"
jq -r '.access.allowed_usernames[]?' "$CONFIG" | sed 's/^/  - /'
log_step "No restart needed — the backend re-reads this on the next entry."
