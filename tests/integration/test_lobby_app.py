"""Integration tests for the lobby service (``lobby.create_lobby_app``).

Exercises the credential + session endpoints and the picker read against a real ``TestClient``.
The lobby signs the ``account_id`` (not the username) into a parent-domain cookie and creates
accounts only (no ``User``/``Player``), gated by the server-wide signup toggle.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import accounts
from energetica.schemas.auth import ChangePasswordRequest, LoginRequest, SignupRequest
from energetica.utils.session import decode_session_token
from lobby import create_lobby_app

BASE = "http://testserver/api/v1"


@pytest.fixture
def signups_enabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Enable open signup (the accounts DB is isolated by the autouse conftest fixture)."""
    path = tmp_path / "server.json"
    path.write_text('{"signups_enabled": true}', encoding="utf-8")
    monkeypatch.setenv("ENERGETICA_SERVER_CONFIG_PATH", str(path))


@pytest.fixture
def landing_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    instances = tmp_path / "landing" / "instances"
    instances.mkdir(parents=True)
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    return instances


def _client() -> TestClient:
    return TestClient(create_lobby_app())


def _signup(client: TestClient, username: str = "alice", password: str = "correct-password") -> None:
    resp = client.post(f"{BASE}/auth/signup", json=SignupRequest(username=username, password=password).model_dump())
    assert resp.status_code == 201, resp.text


# --- signup ---------------------------------------------------------------------------------


def test_signup_creates_account_only_and_logs_in(signups_enabled: None) -> None:
    client = _client()
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="correct-password").model_dump()
    )

    assert resp.status_code == 201
    account = accounts.get_account_by_username("alice")
    assert account is not None
    # Auto-login: the response carries a session cookie signed with the account_id.
    assert decode_session_token(client.cookies["session"]) == str(account.account_id)


def test_signup_blocked_when_signups_disabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENERGETICA_SERVER_CONFIG_PATH", str(tmp_path / "absent.json"))  # missing → fail closed
    resp = _client().post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="correct-password").model_dump()
    )
    assert resp.status_code == 400
    assert resp.json()["game_exception_type"] == "SIGNUP_DISABLED"


def test_signup_duplicate_username_conflicts(signups_enabled: None) -> None:
    client = _client()
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="another-password").model_dump()
    )
    assert resp.status_code == 409


def test_signup_short_password_rejected(signups_enabled: None) -> None:
    resp = _client().post(f"{BASE}/auth/signup", json={"username": "alice", "password": "short"})
    assert resp.status_code == 422


# --- login ----------------------------------------------------------------------------------


def test_login_unknown_user_401(signups_enabled: None) -> None:
    resp = _client().post(f"{BASE}/auth/login", json=LoginRequest(username="ghost", password="x").model_dump())
    assert resp.status_code == 401
    assert resp.json()["detail"] == "USER_NOT_FOUND"


def test_login_wrong_password_401(signups_enabled: None) -> None:
    client = _client()
    _signup(client)
    resp = client.post(f"{BASE}/auth/login", json=LoginRequest(username="alice", password="wrong").model_dump())
    assert resp.status_code == 401
    assert resp.json()["detail"] == "INVALID_PASSWORD"


def test_login_valid_sets_account_id_cookie(signups_enabled: None) -> None:
    client = _client()
    _signup(client)
    client.cookies.clear()  # drop the signup auto-login cookie so we test login on its own

    resp = client.post(
        f"{BASE}/auth/login", json=LoginRequest(username="alice", password="correct-password").model_dump()
    )

    assert resp.status_code == 200
    account = accounts.get_account_by_username("alice")
    assert account is not None
    assert decode_session_token(client.cookies["session"]) == str(account.account_id)


# --- my-runs --------------------------------------------------------------------------------


def test_my_runs_requires_auth(landing_dir: Path) -> None:
    resp = _client().get(f"{BASE}/lobby/my-runs")
    assert resp.status_code == 401


def test_my_runs_returns_authed_accounts_runs(signups_enabled: None, landing_dir: Path) -> None:
    client = _client()
    _signup(client)
    account = accounts.get_account_by_username("alice")
    assert account is not None
    (landing_dir / "spring-2026.json").write_text(
        json.dumps(
            {"slug": "spring-2026", "name": "Spring 2026", "advertised": True, "starts_at": "2026-03-01T00:00:00Z"}
        ),
        encoding="utf-8",
    )
    accounts.record_membership(
        account_id=account.account_id, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00"
    )

    resp = client.get(f"{BASE}/lobby/my-runs")

    assert resp.status_code == 200
    assert [run["slug"] for run in resp.json()["runs"]] == ["spring-2026"]


# --- change password + logout ---------------------------------------------------------------


def test_change_password_wrong_old_rejected(signups_enabled: None) -> None:
    client = _client()
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/change-password",
        json=ChangePasswordRequest(old_password="wrong", new_password="brand-new-password").model_dump(),
    )
    assert resp.status_code == 400
    assert resp.json()["game_exception_type"] == "OLD_PASSWORD_INCORRECT"


def test_change_password_then_login_with_new(signups_enabled: None) -> None:
    client = _client()
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/change-password",
        json=ChangePasswordRequest(old_password="correct-password", new_password="brand-new-password").model_dump(),
    )
    assert resp.status_code == 204

    client.cookies.clear()
    old = client.post(
        f"{BASE}/auth/login", json=LoginRequest(username="alice", password="correct-password").model_dump()
    )
    assert old.status_code == 401
    new = client.post(
        f"{BASE}/auth/login", json=LoginRequest(username="alice", password="brand-new-password").model_dump()
    )
    assert new.status_code == 200


def test_logout_clears_session(signups_enabled: None, landing_dir: Path) -> None:
    client = _client()
    _signup(client)
    assert client.get(f"{BASE}/lobby/my-runs").status_code == 200

    resp = client.post(f"{BASE}/auth/logout")
    assert resp.status_code == 204

    assert client.get(f"{BASE}/lobby/my-runs").status_code == 401


def test_logout_requires_auth(signups_enabled: None) -> None:
    assert _client().post(f"{BASE}/auth/logout").status_code == 401


# --- cookie scope ---------------------------------------------------------------------------


def test_session_cookie_scoped_to_parent_domain_when_apex_set(
    signups_enabled: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With the apex configured, the cookie is scoped to .{apex} so it spans every run subdomain."""
    monkeypatch.setenv("ENERGETICA_APEX_DOMAIN", "energetica-game.org")
    client = _client()
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="correct-password").model_dump()
    )

    assert resp.status_code == 201
    assert "domain=.energetica-game.org" in resp.headers["set-cookie"].lower()
