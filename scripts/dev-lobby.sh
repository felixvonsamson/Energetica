#!/bin/bash
set -euo pipefail

# Run the lobby backend locally against the shared dev scratch (scripts/lib/dev-env.sh), so it
# shares a signing secret + accounts store with the local app backend — a session minted here
# validates against the app's entry gate. See docs/getting-started/local-development.md.
#
#   bun run serve:lobby               # this script — lobby backend on :8001
#   cd frontend && bun run dev:lobby  # the lobby frontend, in another terminal (:5174)
#
# Re-run any time; the seed is idempotent. Pass --port to override the default 8001.

PORT=8001
while [[ $# -gt 0 ]]; do
    case "$1" in
    --port)
        PORT="$2"
        shift 2
        ;;
    *)
        echo "Unknown option: $1"
        echo "Usage: bash scripts/dev-lobby.sh [--port 8001]"
        exit 1
        ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=scripts/lib/dev-env.sh
source scripts/lib/dev-env.sh

seed_dev_data

echo
echo "→ Lobby backend on http://127.0.0.1:$PORT — start the frontend with: cd frontend && bun run dev:lobby"
echo
exec .venv/bin/python main_lobby.py --port "$PORT"
