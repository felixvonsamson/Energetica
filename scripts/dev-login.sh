#!/bin/bash
set -euo pipefail

# Mint a real lobby session for a seeded account and save it to a cookie jar, so you can drive a
# local app backend from the CLI (or curl) without a browser. Uses the lobby's production
# /api/v1/auth/login — no dev-only auth path — so it exercises the same session the browser gets.
# Requires the lobby backend running (bun run serve:lobby). See
# docs/getting-started/local-development.md.
#
#   bash scripts/dev-login.sh                 # the seeded demo / demo1234 account
#   bash scripts/dev-login.sh alice s3cret    # a specific account (must exist in the lobby)

USERNAME="${1:-demo}"
PASSWORD="${2:-demo1234}"
LOBBY_URL="${LOBBY_URL:-http://localhost:8001}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COOKIE_JAR="${COOKIE_JAR:-$REPO_ROOT/.energetica-dev/cookies.txt}"

mkdir -p "$(dirname "$COOKIE_JAR")"
# Build the JSON body with json.dumps so a username/password containing quotes, backslashes, etc.
# is escaped correctly rather than producing malformed JSON.
json_body="$(USERNAME="$USERNAME" PASSWORD="$PASSWORD" "$REPO_ROOT/.venv/bin/python" -c \
    'import json, os; print(json.dumps({"username": os.environ["USERNAME"], "password": os.environ["PASSWORD"]}))')"
curl -fsS -c "$COOKIE_JAR" -X POST "$LOBBY_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$json_body" >/dev/null

echo "→ session for '$USERNAME' saved to $COOKIE_JAR"
echo "  try:  curl -b \"$COOKIE_JAR\" http://localhost:8000/api/v1/auth/me"
