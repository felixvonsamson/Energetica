"""Integration tests for instance access-policy gating on the login and signup routes.

A public (or unconfigured) instance lets any server-wide account in; a private instance admits
only allowlisted usernames. The policy file is read fresh on every attempt.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.globals import engine
from energetica.schemas.auth import LoginRequest, SignupRequest
from energetica.utils.auth import generate_password_hash

PORT = 8000
BASE_URL = f"http://localhost:{PORT}/api/v1/auth"
SIGNUP_URL = f"{BASE_URL}/signup"
LOGIN_URL = f"{BASE_URL}/login"
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


def _make_account(username: str, password: str) -> None:
    accounts.create_account(username=username, pwhash=generate_password_hash(password))


# --- login ----------------------------------------------------------------------------------


def test_login_allowed_on_public_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "public"})
    client = _client()
    _make_account("alice", "pw")

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="pw").model_dump())

    assert response.status_code == 200


def test_login_allowed_for_allowlisted_username_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    _make_account("alice", "pw")

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="pw").model_dump())

    assert response.status_code == 200


def test_login_denied_for_unlisted_username_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    _make_account("carol", "pw")  # valid credentials, but not on the allowlist

    response = client.post(LOGIN_URL, json=LoginRequest(username="carol", password="pw").model_dump())

    assert response.status_code == 403


def test_login_denied_does_not_provision_pickle_user(configured: Path) -> None:
    """A denied login on a private instance must not auto-provision a pickle User."""
    from energetica.database.user import User

    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    _make_account("carol", "pw")
    account = accounts.get_account_by_username("carol")
    assert account is not None

    client.post(LOGIN_URL, json=LoginRequest(username="carol", password="pw").model_dump())

    assert next(User.filter_by(account_id=account.account_id), None) is None


def test_login_denied_after_instance_goes_private_excluding_provisioned_user(configured: Path) -> None:
    """A user provisioned while the instance was public is denied once it flips to private without
    them — the access policy is consulted on every login, not just the first.
    """
    from energetica.database.user import User

    _write_policy(configured, {"policy": "public"})
    client = _client()
    _make_account("alice", "pw")
    # First login (public) provisions the pickle User.
    assert client.post(LOGIN_URL, json=LoginRequest(username="alice", password="pw").model_dump()).status_code == 200
    account = accounts.get_account_by_username("alice")
    assert account is not None
    assert next(User.filter_by(account_id=account.account_id), None) is not None

    # Instance is locked down to an allowlist that excludes alice.
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["bob"]})

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="pw").model_dump())

    assert response.status_code == 403


def test_login_fails_closed_on_corrupt_policy(configured: Path) -> None:
    (configured / SLUG).mkdir(parents=True, exist_ok=True)
    (configured / SLUG / "instance.json").write_text("{ broken", encoding="utf-8")
    client = _client()
    _make_account("alice", "pw")

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="pw").model_dump())

    assert response.status_code == 403


def test_login_wrong_password_is_401_not_403_on_private_instance(configured: Path) -> None:
    """Access policy is consulted only after the password check, so a bad password is still 401."""
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()
    _make_account("alice", "pw")

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="wrong").model_dump())

    assert response.status_code == 401


# --- signup ---------------------------------------------------------------------------------


def test_signup_allowed_on_public_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "public"})
    client = _client()

    response = client.post(SIGNUP_URL, json=SignupRequest(username="newbie", password="password1").model_dump())

    assert response.status_code == 201


def test_signup_denied_for_unlisted_username_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()

    response = client.post(SIGNUP_URL, json=SignupRequest(username="randomer", password="password1").model_dump())

    assert response.status_code == 403
    assert accounts.get_account_by_username("randomer") is None


def test_signup_allowed_for_allowlisted_username_on_private_instance(configured: Path) -> None:
    _write_policy(configured, {"policy": "private", "allowed_usernames": ["alice"]})
    client = _client()

    response = client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="password1").model_dump())

    assert response.status_code == 201


def test_publishes_fragment_on_allowed_login(configured: Path) -> None:
    """A successful gated login publishes the sanitised fragment + aggregate to the landing dir."""
    _write_policy(configured, {"policy": "public"})
    client = _client()
    _make_account("alice", "pw")

    client.post(LOGIN_URL, json=LoginRequest(username="alice", password="pw").model_dump())

    manifest = json.loads((configured.parent / "landing" / "instances.json").read_text())
    assert [entry["slug"] for entry in manifest["instances"]] == [SLUG]
    assert "access" not in manifest["instances"][0]
