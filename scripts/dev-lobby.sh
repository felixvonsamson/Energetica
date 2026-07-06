#!/bin/bash
set -euo pipefail

# Run the lobby backend locally with a self-contained scratch setup, so the lobby
# frontend (`bun run dev:lobby`) has something to talk to. Zero host config: everything
# lives under instance/lobby-dev/ (gitignored via `instance/*`).
#
#   bun run server:lobby          # this script
#   bun run dev:lobby             # the frontend dev server, in another terminal
#
# Seeds a demo account and a few sample runs so every picker state is reachable:
#   - login as demo / demo1234  → "your runs" (poc-3 + private-beta) + "other runs to join" (summer-2026)
#   - logged out                → advertised runs only (poc-3 + summer-2026)
#   - fresh signup (signups on) → "No runs joined yet"
#
# Re-run any time; it is idempotent. Pass --port to override the default 8001.

PORT=8001
while [[ $# -gt 0 ]]; do
    case "$1" in
        --port) PORT="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; echo "Usage: bash scripts/dev-lobby.sh [--port 8001]"; exit 1 ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SCRATCH="$REPO_ROOT/instance/lobby-dev"
LANDING_DIR="$SCRATCH/landing"

export ENERGETICA_ACCOUNTS_DB_PATH="$SCRATCH/accounts.db"
export ENERGETICA_SERVER_CONFIG_PATH="$SCRATCH/server.json"
export ENERGETICA_LANDING_DIR="$LANDING_DIR"
export ENERGETICA_SHARED_SECRET_PATH="$SCRATCH/secret_key.txt"
# ENERGETICA_APEX_DOMAIN deliberately unset → host-only cookie, which is what localhost needs.

mkdir -p "$LANDING_DIR/instances"

# Server-wide signup toggle: on, so the signup flow is testable. Only written on first run —
# edit the file directly to test the signups-disabled flow without it being clobbered.
if [ ! -f "$SCRATCH/server.json" ]; then
    echo '{"signups_enabled": true}' > "$SCRATCH/server.json"
fi

# Stable signing secret so sessions survive a backend restart.
if [ ! -s "$SCRATCH/secret_key.txt" ]; then
    (umask 077; .venv/bin/python -c 'import secrets; print(secrets.token_hex(32))' > "$SCRATCH/secret_key.txt")
fi

# Seed sample fragments + the aggregate manifest + a demo account with memberships, using the
# real backend modules so the shapes never drift from production.
.venv/bin/python - <<'PY'
import json
from pathlib import Path

from energetica import accounts, instance_config
from energetica.utils.session import generate_password_hash

landing = instance_config._landing_dir()
frag_dir = landing / "instances"
frag_dir.mkdir(parents=True, exist_ok=True)

# slug, name, advertised, starts_at (timezone-aware ISO-8601)
runs = [
    ("poc-3", "Proof of Concept 3", True, "2026-03-05T14:00:00+00:00"),
    ("summer-2026", "Summer 2026", True, "2026-06-01T09:00:00+00:00"),
    ("private-beta", "Private Beta", False, "2026-07-01T12:00:00+00:00"),
]
for slug, name, advertised, starts_at in runs:
    (frag_dir / f"{slug}.json").write_text(
        json.dumps({"slug": slug, "name": name, "advertised": advertised, "starts_at": starts_at}),
        encoding="utf-8",
    )

# Aggregate instances.json (advertised-only), built by the real aggregator.
instance_config.aggregate_instances()

# Demo account, member of one advertised + one unadvertised run.
account_id = accounts.get_or_create_account_id(
    username="demo", pwhash=generate_password_hash("demo1234")
)
accounts.record_membership(account_id=account_id, slug="poc-3", settled_at="2026-03-06T10:00:00+00:00")
accounts.record_membership(account_id=account_id, slug="private-beta", settled_at="2026-07-02T10:00:00+00:00")

# The dev frontend serves /instances.json from frontend/public/ (Apache aliases it in prod).
public = Path("frontend/public/instances.json")
public.parent.mkdir(parents=True, exist_ok=True)
public.write_text((landing / "instances.json").read_text(encoding="utf-8"), encoding="utf-8")

print("Seeded lobby dev data:")
print("  demo account: demo / demo1234 (member of poc-3, private-beta)")
print("  advertised runs: poc-3, summer-2026")
print(f"  scratch: {landing.parent}")
PY

echo
echo "→ Lobby backend on http://127.0.0.1:$PORT — start the frontend with: bun run dev:lobby"
echo
exec .venv/bin/python main_lobby.py --port "$PORT"
