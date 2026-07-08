#!/bin/bash
set -euo pipefail

# Run the local app (instance/game) backend for development, wired to share the lobby's signing
# secret + accounts store so a lobby-minted SSO cookie logs you in. Any extra args are forwarded
# to main.py. See docs/getting-started/local-development.md.
#
#   bun run serve:app                 # this script — app backend on :8000
#   bun run serve:lobby               # the lobby backend it authenticates against (:8001)
#   cd frontend && bun run dev:app    # the app frontend, in another terminal
#
# The app no longer mints sessions (post-cutover it is a pure entry gate — see
# docs/architecture/lobby.md), so you still need a session from the lobby: log in on the lobby
# frontend, or run `bash scripts/dev-login.sh`. To skip local backends entirely and point the
# frontend at a live deployment, use `BACKEND=game bun run dev:app` instead.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/lib/dev-env.sh
source scripts/lib/dev-env.sh

echo "→ App backend on http://localhost:8000 — shared dev scratch: $DEV_SCRATCH"
echo "  Need a session? Log in via the lobby, or run: bash scripts/dev-login.sh"
echo
exec .venv/bin/python main.py --env dev "$@"
