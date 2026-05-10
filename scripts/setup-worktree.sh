#!/usr/bin/env bash
# Run once after `git worktree add` to make the worktree fully operational.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(dirname "$SCRIPT_DIR")"
MAIN_REPO="$(git -C "$WORKTREE_ROOT" worktree list | head -1 | awk '{print $1}')"

echo "Setting up worktree at $WORKTREE_ROOT"

# Frontend deps
echo "→ Installing frontend dependencies..."
cd "$WORKTREE_ROOT/frontend"
bun install

# Python venv — symlink from main repo to avoid a redundant install
if [ ! -e "$WORKTREE_ROOT/.venv" ]; then
    echo "→ Symlinking .venv from main repo..."
    ln -s "$MAIN_REPO/.venv" "$WORKTREE_ROOT/.venv"
fi

echo "✓ Done. Start the server from $WORKTREE_ROOT with: python main.py"
