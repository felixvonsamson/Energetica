"""Integration tests for instance access-policy gating at the entry gate (``GET /auth/me``).

Post-cutover the access policy is enforced when the SSO cookie is validated on entry, not at a
login POST (which no longer exists). A public (or unconfigured) instance admits any server-wide
account; a private instance admits only accounts that have joined it (``accounts.db``'s
``instance_membership``, #1030 follow-up, ADR-0007 — ``instance.json`` carries no allowlist any
more). The policy file is read fresh on every entry, so a lockdown takes effect even for an
account that has already settled (#817, ADR-0003). There is nothing to auto-provision any more
(ADR-0004): entry never creates a ``Player`` — only settling does.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.freeplay.app import create_app
from energetica.freeplay.database.player import Player
from energetica.freeplay.globals import engine
from energetica.identity import accounts

from ._session_helpers import authenticate, make_account

PORT = 8000
ME_URL = f"http://localhost:{PORT}/api/v1/auth/me"
SLUG = "test-instance"


@pytest.fixture
def configured(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the instance-config machinery at per-test dirs; return the config dir."""
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(tmp_path / "etc"))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    return tmp_path / "etc"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def _write_policy(config_dir: Path, access: dict | None, *, run: dict | None = None) -> None:
    """Write this test's instance.json. ``access=None`` omits the block; ``run`` defaults to freeplay."""
    payload: dict = {"name": "Test", "advertised": True, "starts_at": "2025-01-01T00:00:00Z"}
    if access is not None:
        payload["access"] = access
    payload["run"] = run if run is not None else {"mode": "freeplay"}
    target = config_dir / SLUG / "instance.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload), encoding="utf-8")


def _enter(client: TestClient, username: str) -> int:
    """Create an account, authenticate the client as it, and return its account_id."""
    account_id = make_account(username, "pw")
    authenticate(client, account_id)
    return account_id


def _join(account_id: int) -> None:
    """Record account_id as having joined this test's private instance (accounts.db)."""
    accounts.record_join(account_id=account_id, slug=SLUG, joined_at=datetime.now(timezone.utc).isoformat())


def test_entry_allowed_on_public_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "public"})
    client = _client()
    _enter(client, "alice")

    assert client.get(ME_URL).status_code == 200


def test_entry_allowed_for_joined_account_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private"})
    client = _client()
    account_id = _enter(client, "alice")
    _join(account_id)

    assert client.get(ME_URL).status_code == 200


def test_entry_denied_for_unjoined_account_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private"})
    client = _client()
    _enter(client, "carol")  # valid session, but never joined this run

    assert client.get(ME_URL).status_code == 403


def test_entry_denied_does_not_create_a_player(configured: Path) -> None:
    """A denied entry on a private instance must not create a ``Player`` — entry never does."""
    _write_policy(configured, {"policy": "private"})
    client = _client()
    account_id = _enter(client, "carol")

    client.get(ME_URL)

    assert next(Player.filter_by(account_id=account_id), None) is None


def test_entry_denied_after_instance_goes_private_excluding_a_previously_allowed_account(configured: Path) -> None:
    """An account admitted while the instance was public is denied once it flips to private
    without it having joined — the access policy is consulted on every entry, not just the first.
    """
    _write_policy(configured, {"policy": "public"})
    client = _client()
    _enter(client, "alice")
    assert client.get(ME_URL).status_code == 200

    # Instance is locked down to private; alice never went through a join step.
    _write_policy(configured, {"policy": "private"})

    assert client.get(ME_URL).status_code == 403


def test_entry_denied_for_unjoined_account_on_workshop_run_with_no_access_block(configured: Path) -> None:
    """A Workshop Run that omits ``access`` is private (#1060), so entry needs a join."""
    _write_policy(configured, None, run={"mode": "workshop"})
    client = _client()
    _enter(client, "carol")

    assert client.get(ME_URL).status_code == 403


def test_entry_allowed_for_joined_account_on_workshop_run_with_no_access_block(configured: Path) -> None:
    _write_policy(configured, None, run={"mode": "workshop"})
    client = _client()
    account_id = _enter(client, "alice")
    _join(account_id)

    assert client.get(ME_URL).status_code == 200


def test_entry_allowed_on_workshop_run_with_explicit_public_access(configured: Path) -> None:
    """The private default never overrides an ``access`` block the file spells out."""
    _write_policy(configured, {"policy": "public"}, run={"mode": "workshop"})
    client = _client()
    _enter(client, "alice")

    assert client.get(ME_URL).status_code == 200


def test_entry_fails_closed_when_run_mode_is_not_stated(configured: Path) -> None:
    """A file with no ``run`` block is rejected rather than read as freeplay, which locks out even
    a public Run's players. That is deliberate (#1060): the four live files are edited by hand
    before the deploy that ships this.
    """
    target = configured / SLUG / "instance.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(
            {"name": "Test", "advertised": True, "starts_at": "2025-01-01T00:00:00Z", "access": {"policy": "public"}}
        ),
        encoding="utf-8",
    )
    client = _client()
    _enter(client, "alice")

    assert client.get(ME_URL).status_code == 403


def test_entry_fails_closed_on_corrupt_policy(configured: Path) -> None:
    (configured / SLUG).mkdir(parents=True, exist_ok=True)
    (configured / SLUG / "instance.json").write_text("{ broken", encoding="utf-8")
    client = _client()
    _enter(client, "alice")

    assert client.get(ME_URL).status_code == 403


def test_publishes_fragment_on_allowed_entry(configured: Path) -> None:
    """A successful gated entry publishes the sanitised fragment + aggregate to the landing dir."""
    _write_policy(configured, {"policy": "public"})
    client = _client()
    _enter(client, "alice")

    client.get(ME_URL)

    manifest = json.loads((configured.parent / "landing" / "instances.json").read_text())
    assert [entry["slug"] for entry in manifest["instances"]] == [SLUG]
    assert "access" not in manifest["instances"][0]
