#!/bin/bash
set -euo pipefail

# One-terminal launcher for a full local stack. See docs/getting-started/local-development.md.
#
#   bun run dev         # app stack:  lobby + app backends (shared scratch) + lobby + app frontends
#   bun run dev:lobby   # lobby stack: lobby backend + lobby frontend
#
# Ctrl-C tears the whole process tree down. For finer control — a single piece, or a frontend
# pointed at a live deployment via BACKEND=… — run the serve:* / dev:* scripts individually.

TARGET="${1:-app}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Monitor mode: each background job below runs in its own process group (PGID == the job's PID),
# so cleanup can signal the whole group at once — reliably taking down grandchildren that a plain
# kill misses (main.py re-execs uvicorn which forks a reload worker; bun forks vite).
set -m

# shellcheck source=scripts/lib/dev-env.sh
source scripts/lib/dev-env.sh

pids=()

cleanup() {
    trap - INT TERM EXIT # disarm so this runs once
    echo
    echo "[dev] shutting down…"
    local pid
    for pid in "${pids[@]:-}"; do
        [ -n "${pid:-}" ] || continue
        # Negative PID → the whole process group. Fall back to the bare PID if it is not a group
        # leader (e.g. monitor mode unavailable).
        kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    done
}
trap cleanup INT TERM EXIT

start() {
    "$@" &
    pids+=("$!")
}

# Seed the shared accounts store + sample runs once, before any server starts (avoids two
# backends racing on the same sqlite file). The lobby owns accounts.
seed_dev_data

case "$TARGET" in
app)
    echo "[dev] app stack → app http://localhost:5173  ·  lobby http://localhost:5174  (log in on the lobby)"
    start .venv/bin/python main_lobby.py --port 8001
    start .venv/bin/python main.py --env dev
    start bash -c 'cd frontend && exec bun run dev:lobby'
    start bash -c 'cd frontend && exec bun run dev:app'
    ;;
lobby)
    echo "[dev] lobby stack → lobby http://localhost:5174"
    start .venv/bin/python main_lobby.py --port 8001
    start bash -c 'cd frontend && exec bun run dev:lobby'
    ;;
*)
    echo "usage: bash scripts/dev.sh [app|lobby]" >&2
    exit 1
    ;;
esac

wait
