"""Integration tests for instance access-policy gating at the entry gate (``GET /auth/me``).

Post-cutover the access policy is enforced when the SSO cookie is validated on entry, not at a
login POST (which no longer exists). A public (or unconfigured) instance admits any server-wide
account; a private instance admits only allowlisted usernames. The policy file is read fresh on
every entry, so a lockdown takes effect even for an already-provisioned user (#817, ADR-0003).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import create_app
from energetica.database.user import User
from energetica.globals import engine

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


def _write_policy(config_dir: Path, access: dict) -> None:
    target = config_dir / SLUG / "instance.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps({"name": "Test", "advertised": True, "starts_at": "2025-01-01T00:00:00Z", "access": access}),
        encoding="utf-8",
    )


def _enter(client: TestClient, username: str) -> int:
    """Create an account, authenticate the client as it, and return its account_id."""
    account_id = make_account(username, "pw")
    authenticate(client, account_id)
    return account_id


def test_entry_allowed_on_public_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "public"})
    client = _client()
    _enter(client, "alice")

    assert client.get(ME_URL).status_code == 200


def test_entry_allowed_for_allowlisted_username_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    _enter(client, "alice")

    assert client.get(ME_URL).status_code == 200


def test_entry_denied_for_unlisted_username_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    _enter(client, "carol")  # valid session, but not on the allowlist

    assert client.get(ME_URL).status_code == 403


def test_entry_denied_does_not_provision_local_user(configured: Path) -> None:
    """A denied entry on a private instance must not auto-provision a pickle User."""
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    account_id = _enter(client, "carol")

    client.get(ME_URL)

    assert next(User.filter_by(account_id=account_id), None) is None


def test_entry_denied_after_instance_goes_private_excluding_provisioned_user(configured: Path) -> None:
    """A user provisioned while the instance was public is denied once it flips to private without
    them — the access policy is consulted on every entry, not just the first.
    """
    _write_policy(configured, {"policy": "public"})
    client = _client()
    account_id = _enter(client, "alice")
    # First entry (public) provisions the pickle User.
    assert client.get(ME_URL).status_code == 200
    assert next(User.filter_by(account_id=account_id), None) is not None

    # Instance is locked down to an allowlist that excludes alice.
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["bob"]})

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
