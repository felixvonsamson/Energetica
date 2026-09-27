#!/bin/bash
set -euo pipefail

# Energetica — render a new instance's instance.json from instance.json.tmpl, to stdout.
#
#   bash scripts/infra/render-instance-json.sh --mode <mode> --name "<display name>" \
#        --advertised true|false --starts-at <ISO-8601-UTC> \
#        [--freeze-at <ISO-8601-UTC>] [--ended-at <ISO-8601-UTC>] [--modes-file <path>]
#
# setup-instance.sh is the caller. It is split out so the rendering can be tested without root:
# the backend fails closed on an instance.json it cannot parse, so a bad rendering would lock
# every player out of the new Run. tests/unit/test_render_instance_json.py runs this script and
# parses the output with the backend's own model.
#
# --mode has no default, matching the backend (#1060): the file must say which kind of Run it is.
# The accepted modes are read from --modes-file (default: run-modes next to this script), which
# push-bootstrap.sh generates from the backend. The list is not kept here, so it cannot drift.
#
# Prints nothing and exits non-zero on any input that would not render a valid file.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODES_FILE="$SCRIPT_DIR/run-modes"
MODE=""
NAME=""
ADVERTISED=""
STARTS_AT=""
FREEZE_AT=""
ENDED_AT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode) MODE="$2"; shift 2 ;;
        --name) NAME="$2"; shift 2 ;;
        --advertised) ADVERTISED="$2"; shift 2 ;;
        --starts-at) STARTS_AT="$2"; shift 2 ;;
        --freeze-at) FREEZE_AT="$2"; shift 2 ;;
        --ended-at) ENDED_AT="$2"; shift 2 ;;
        --modes-file) MODES_FILE="$2"; shift 2 ;;
        *) echo "✗ Unknown option: $1" >&2; exit 1 ;;
    esac
done

fail() { echo "✗ $1" >&2; exit 1; }

[ -n "$MODE" ] || fail "--mode is required (the backend accepts no instance.json without one)"
[ -n "$NAME" ] || fail "--name is required"
[ -n "$STARTS_AT" ] || fail "--starts-at is required"
[ -f "$MODES_FILE" ] || fail "$MODES_FILE is missing. Re-run ./scripts/push-bootstrap.sh, which generates it from the backend."
grep -qxF -- "$MODE" "$MODES_FILE" || fail "--mode must be one of: $(tr '\n' ' ' < "$MODES_FILE")(got '$MODE')"
case "$ADVERTISED" in
    true|false) ;;
    *) fail "--advertised must be true or false (got '$ADVERTISED')" ;;
esac

# The values are interpolated into JSON strings with sed. A double-quote or backslash would break
# the JSON, and sed's own replacement metacharacters (& / \) would corrupt the substitution. Reject
# the JSON-breakers and escape the sed-special characters.
for field in "name:$NAME" "starts-at:$STARTS_AT" "freeze-at:$FREEZE_AT" "ended-at:$ENDED_AT"; do
    case "${field#*:}" in
        *[\"\\]*) fail "--${field%%:*} must not contain double-quotes or backslashes" ;;
    esac
done
sed_escape() { printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'; }

# freeze_at / ended_at are nullable JSON: a bare `null` when unset, else a quoted string. The whole
# token (quotes included) is the replacement, so the template carries @FREEZE_AT@ unquoted, unlike
# starts_at, which is never null and keeps its literal quotes in the template.
if [ -n "$FREEZE_AT" ]; then FREEZE_AT_JSON="\"$(sed_escape "$FREEZE_AT")\""; else FREEZE_AT_JSON="null"; fi
if [ -n "$ENDED_AT" ]; then ENDED_AT_JSON="\"$(sed_escape "$ENDED_AT")\""; else ENDED_AT_JSON="null"; fi

# A Workshop Run is private (#993). The backend would fill that in for a file with no access
# block, but rendering it explicitly lets an admin read the policy off the file. The test pins
# this to the backend's default so the two cannot disagree.
if [ "$MODE" = "workshop" ]; then ACCESS_POLICY="private"; else ACCESS_POLICY="public"; fi

sed -e "s/@NAME@/$(sed_escape "$NAME")/g" \
    -e "s/@ADVERTISED@/$ADVERTISED/g" \
    -e "s/@STARTS_AT@/$(sed_escape "$STARTS_AT")/g" \
    -e "s/@FREEZE_AT@/$FREEZE_AT_JSON/g" \
    -e "s/@ENDED_AT@/$ENDED_AT_JSON/g" \
    -e "s/@ACCESS_POLICY@/$ACCESS_POLICY/g" \
    -e "s/@MODE@/$(sed_escape "$MODE")/g" \
    "$SCRIPT_DIR/instance.json.tmpl"
