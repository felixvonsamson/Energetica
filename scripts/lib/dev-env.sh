# scripts/lib/dev-env.sh — shared local-dev environment (sourced, never executed directly).
#
# Points a local app backend (main.py) and the local lobby backend (main_lobby.py) at ONE
# signing secret + accounts store, so an SSO cookie the lobby mints validates against the
# instance's entry gate (docs/architecture/lobby.md, docs/getting-started/local-development.md).
# Without this the two backends sign with different secrets and every authed request 401s.
#
# The scratch lives at .energetica-dev/ (repo root, gitignored) — deliberately OUTSIDE instance/,
# so `--rm_instance` (which rmtree's instance/) resets only game/engine state and leaves identity
# intact. That mirrors production, where accounts are server-wide and outlive any single run.
#
# Sourced by: scripts/dev-app.sh, scripts/dev-lobby.sh, scripts/dev.sh.

# Resolve the repo root from this file's location, so the exported paths are identical no matter
# which script sources us or what the caller's CWD is.
DEV_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_SCRATCH="$DEV_REPO_ROOT/.energetica-dev"
DEV_LANDING_DIR="$DEV_SCRATCH/landing"

export ENERGETICA_ACCOUNTS_DB_PATH="$DEV_SCRATCH/accounts.db"
export ENERGETICA_SERVER_CONFIG_PATH="$DEV_SCRATCH/server.json"
export ENERGETICA_LANDING_DIR="$DEV_LANDING_DIR"
export ENERGETICA_SHARED_SECRET_PATH="$DEV_SCRATCH/secret_key.txt"
# ENERGETICA_APEX_DOMAIN deliberately unset → host-only cookie, which is what localhost needs.

mkdir -p "$DEV_LANDING_DIR/instances"

# Server-wide signup toggle: on by default so the signup flow is testable. First-write only —
# edit .energetica-dev/server.json directly to test the signups-disabled flow without it being
# clobbered on the next run.
if [ ! -f "$ENERGETICA_SERVER_CONFIG_PATH" ]; then
    echo '{"signups_enabled": true}' >"$ENERGETICA_SERVER_CONFIG_PATH"
fi

# Stable signing secret shared by both backends: sessions survive a restart, and a cookie minted
# by one backend validates in the other. Created atomically (write a temp, then hard-link it into
# place — `ln` fails if the target exists) so two backends started at the same moment can't each
# generate a different secret and clobber the file: exactly one secret ever wins, and both
# processes read it. First-write only thereafter.
if [ ! -s "$ENERGETICA_SHARED_SECRET_PATH" ]; then
    umask 077
    _secret_tmp="$(mktemp "${ENERGETICA_SHARED_SECRET_PATH}.XXXXXX")"
    "$DEV_REPO_ROOT/.venv/bin/python" -c 'import secrets; print(secrets.token_hex(32))' >"$_secret_tmp"
    ln "$_secret_tmp" "$ENERGETICA_SHARED_SECRET_PATH" 2>/dev/null || true
    rm -f "$_secret_tmp"
    unset _secret_tmp
fi

# Seed a demo account + sample runs so every picker state is reachable. Idempotent. The lobby owns
# accounts, so only the lobby-side entry points (dev-lobby.sh, dev.sh) call this:
#   login as demo / demo1234  → "your runs" (poc-3 + private-beta) + "other runs to join" (summer-2026)
#   logged out                → advertised runs only (poc-3 + summer-2026)
#   fresh signup (signups on) → "No runs joined yet"
# Uses the real backend modules so the shapes never drift from production.
seed_dev_data() {
    "$DEV_REPO_ROOT/.venv/bin/python" - <<'PY'
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
# Symlink it to the live landing aggregate rather than copying: a one-time copy goes stale the
# moment a fragment's lifecycle timestamps are edited and re-aggregated, so the picker's phase
# lags the app's (issue #886). The symlink tracks the path, so it keeps serving the live manifest
# — including across aggregate_instances()'s atomic temp-then-rename — with no restart. Absolute
# target so it resolves regardless of the frontend dev server's CWD.
public = Path("frontend/public/instances.json")
public.parent.mkdir(parents=True, exist_ok=True)
# Idempotent: the path starts life as a real file (and this seed re-runs), so drop any existing
# file or stale symlink before linking. missing_ok tolerates the first run / a prior rm-instance.
public.unlink(missing_ok=True)
public.symlink_to((landing / "instances.json").resolve())

print("Seeded lobby dev data: demo / demo1234 (member of poc-3, private-beta) · advertised: poc-3, summer-2026")
PY
}
