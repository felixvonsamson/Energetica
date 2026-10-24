"""Integration tests for the lobby backend (``lobby.create_lobby_app``).

Exercises the credential + session endpoints and the picker read against a real ``TestClient``.
The lobby backend is a client of the lobby service (ADR-0009), which the tests run in-process over
a fresh ``lobby.db``. The service mints the session token (the signed ``account_id``); the lobby
backend sets it as a parent-domain cookie. Signup creates an account only (no ``User``/``Player``),
gated by the server-wide signup toggle.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.identity.lobby_service_client import LobbyServiceClient
from energetica.identity.schemas.auth import LoginRequest, SignupRequest
from energetica.kernel.session import SESSION_COOKIE_NAME, decode_session_token
from lobby import create_lobby_app
from lobby.deps import get_lobby_service

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


@pytest.fixture
def client(lobby_service: LobbyServiceClient) -> TestClient:
    """The lobby backend, calling a real lobby service in-process."""
    app = create_lobby_app()
    app.dependency_overrides[get_lobby_service] = lambda: lobby_service
    return TestClient(app)


def _signup(client: TestClient, username: str = "alice", password: str = "correct-password") -> None:
    resp = client.post(f"{BASE}/auth/signup", json=SignupRequest(username=username, password=password).model_dump())
    assert resp.status_code == 201, resp.text


# --- signup ---------------------------------------------------------------------------------


def test_signup_creates_account_only_and_logs_in(
    signups_enabled: None, client: TestClient, lobby_service: LobbyServiceClient
) -> None:
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="correct-password").model_dump()
    )

    assert resp.status_code == 201
    account = lobby_service.get_account_by_username("alice")
    assert account is not None
    # Auto-login: the response carries a session cookie signed with the account_id.
    assert decode_session_token(client.cookies[SESSION_COOKIE_NAME]) == str(account.account_id)


def test_signup_blocked_when_signups_disabled(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, client: TestClient
) -> None:
    monkeypatch.setenv("ENERGETICA_SERVER_CONFIG_PATH", str(tmp_path / "absent.json"))  # missing → fail closed
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="correct-password").model_dump()
    )
    assert resp.status_code == 400
    assert resp.json()["game_exception_type"] == "SIGNUP_DISABLED"


def test_signup_duplicate_username_conflicts(signups_enabled: None, client: TestClient) -> None:
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="another-password").model_dump()
    )
    assert resp.status_code == 409


def test_signup_short_password_rejected(signups_enabled: None, client: TestClient) -> None:
    resp = client.post(f"{BASE}/auth/signup", json={"username": "alice", "password": "short"})
    assert resp.status_code == 422


# --- login ----------------------------------------------------------------------------------


def test_login_unknown_user_401(signups_enabled: None, client: TestClient) -> None:
    resp = client.post(f"{BASE}/auth/login", json=LoginRequest(username="ghost", password="x").model_dump())
    assert resp.status_code == 401
    assert resp.json()["detail"] == "USER_NOT_FOUND"


def test_login_wrong_password_401(signups_enabled: None, client: TestClient) -> None:
    _signup(client)
    resp = client.post(f"{BASE}/auth/login", json=LoginRequest(username="alice", password="wrong").model_dump())
    assert resp.status_code == 401
    assert resp.json()["detail"] == "INVALID_PASSWORD"


def test_login_valid_sets_account_id_cookie(
    signups_enabled: None, client: TestClient, lobby_service: LobbyServiceClient
) -> None:
    _signup(client)
    client.cookies.clear()  # drop the signup auto-login cookie so we test login on its own

    resp = client.post(
        f"{BASE}/auth/login", json=LoginRequest(username="alice", password="correct-password").model_dump()
    )

    assert resp.status_code == 200
    account = lobby_service.get_account_by_username("alice")
    assert account is not None
    assert decode_session_token(client.cookies[SESSION_COOKIE_NAME]) == str(account.account_id)


# --- my-runs --------------------------------------------------------------------------------


def test_my_runs_requires_auth(landing_dir: Path, client: TestClient) -> None:
    resp = client.get(f"{BASE}/lobby/my-runs")
    assert resp.status_code == 401


def test_my_runs_returns_authed_accounts_runs(
    signups_enabled: None, landing_dir: Path, client: TestClient, lobby_service: LobbyServiceClient
) -> None:
    _signup(client)
    account = lobby_service.get_account_by_username("alice")
    assert account is not None
    (landing_dir / "spring-2026.json").write_text(
        json.dumps(
            {"slug": "spring-2026", "name": "Spring 2026", "advertised": True, "starts_at": "2026-03-01T00:00:00Z"}
        ),
        encoding="utf-8",
    )
    lobby_service.add_run_member("spring-2026", account.account_id)

    resp = client.get(f"{BASE}/lobby/my-runs")

    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"
    assert [run["slug"] for run in resp.json()["runs"]] == ["spring-2026"]


# --- join (#1030: the picker's explicit two-click join for public runs) --------------------


def _write_fragment(landing_dir: Path, *, slug: str, name: str = "A Run", private: bool = False) -> None:
    (landing_dir / f"{slug}.json").write_text(
        json.dumps(
            {
                "slug": slug,
                "name": name,
                "advertised": True,
                "private": private,
                "starts_at": "2026-03-01T00:00:00Z",
            }
        ),
        encoding="utf-8",
    )


def test_join_requires_auth(landing_dir: Path, client: TestClient) -> None:
    resp = client.post(f"{BASE}/lobby/runs/spring-2026/join")
    assert resp.status_code == 401


def test_join_unknown_run_404(signups_enabled: None, landing_dir: Path, client: TestClient) -> None:
    _signup(client)
    resp = client.post(f"{BASE}/lobby/runs/does-not-exist/join")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "RUN_NOT_FOUND"


def test_join_private_run_403(signups_enabled: None, landing_dir: Path, client: TestClient) -> None:
    _signup(client)
    _write_fragment(landing_dir, slug="invite-only", private=True)

    resp = client.post(f"{BASE}/lobby/runs/invite-only/join")

    assert resp.status_code == 403
    assert resp.json()["detail"] == "INSTANCE_ACCESS_DENIED"


def test_join_public_run_then_appears_in_my_runs(signups_enabled: None, landing_dir: Path, client: TestClient) -> None:
    _signup(client)
    _write_fragment(landing_dir, slug="spring-2026", name="Spring 2026")

    resp = client.post(f"{BASE}/lobby/runs/spring-2026/join")
    assert resp.status_code == 204

    runs = client.get(f"{BASE}/lobby/my-runs").json()["runs"]
    assert [run["slug"] for run in runs] == ["spring-2026"]


def test_join_is_idempotent(signups_enabled: None, landing_dir: Path, client: TestClient) -> None:
    _signup(client)
    _write_fragment(landing_dir, slug="spring-2026")

    assert client.post(f"{BASE}/lobby/runs/spring-2026/join").status_code == 204
    assert client.post(f"{BASE}/lobby/runs/spring-2026/join").status_code == 204  # must not raise/duplicate

    runs = client.get(f"{BASE}/lobby/my-runs").json()["runs"]
    assert len(runs) == 1


def test_join_rejects_the_runs_facilitator(
    signups_enabled: None, landing_dir: Path, client: TestClient, lobby_service: LobbyServiceClient
) -> None:
    _signup(client)
    account = lobby_service.get_account_by_username("alice")
    assert account is not None
    lobby_service.grant_facilitator(account.account_id, slug="spring-2026")
    _write_fragment(landing_dir, slug="spring-2026")

    resp = client.post(f"{BASE}/lobby/runs/spring-2026/join")

    assert resp.status_code == 403
    assert resp.json()["detail"] == "INSTANCE_ACCESS_DENIED"


# --- change password + logout ---------------------------------------------------------------


# Change-password is a native <form> POST (form-encoded, not JSON) that Post/Redirect/Gets
# back into the SPA so Safari/Apple Passwords sees the submit navigation (issue #849). Assert
# the 303 + its `?pw=` destination (follow_redirects=False — the redirect target is the SPA
# shell, not served by this app), never a JSON body a native submit would render as raw text.


def test_change_password_wrong_old_redirects_with_error(signups_enabled: None, client: TestClient) -> None:
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/change-password-form",
        data={"old_password": "wrong", "new_password": "brand-new-password"},
        follow_redirects=False,
    )
    assert resp.status_code == 303
    assert resp.headers["location"] == "/account?pw=old-incorrect"


def test_change_password_too_short_redirects_with_error(signups_enabled: None, client: TestClient) -> None:
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/change-password-form",
        data={"old_password": "correct-password", "new_password": "short"},
        follow_redirects=False,
    )
    assert resp.status_code == 303
    assert resp.headers["location"] == "/account?pw=too-short"


def test_change_password_then_login_with_new(signups_enabled: None, client: TestClient) -> None:
    _signup(client)
    resp = client.post(
        f"{BASE}/auth/change-password-form",
        data={"old_password": "correct-password", "new_password": "brand-new-password"},
        follow_redirects=False,
    )
    assert resp.status_code == 303
    assert resp.headers["location"] == "/account?pw=changed"

    client.cookies.clear()
    old = client.post(
        f"{BASE}/auth/login", json=LoginRequest(username="alice", password="correct-password").model_dump()
    )
    assert old.status_code == 401
    new = client.post(
        f"{BASE}/auth/login", json=LoginRequest(username="alice", password="brand-new-password").model_dump()
    )
    assert new.status_code == 200


def test_logout_clears_session(signups_enabled: None, landing_dir: Path, client: TestClient) -> None:
    _signup(client)
    assert client.get(f"{BASE}/lobby/my-runs").status_code == 200

    resp = client.post(f"{BASE}/auth/logout")
    assert resp.status_code == 204

    assert client.get(f"{BASE}/lobby/my-runs").status_code == 401


def test_logout_requires_auth(signups_enabled: None, client: TestClient) -> None:
    assert client.post(f"{BASE}/auth/logout").status_code == 401


# --- cookie scope ---------------------------------------------------------------------------


def test_session_cookie_scoped_to_parent_domain_when_apex_set(
    signups_enabled: None, monkeypatch: pytest.MonkeyPatch, client: TestClient
) -> None:
    """With the apex configured, the cookie is scoped to .{apex} so it spans every run subdomain."""
    monkeypatch.setenv("ENERGETICA_APEX_DOMAIN", "energetica-game.org")
    resp = client.post(
        f"{BASE}/auth/signup", json=SignupRequest(username="alice", password="correct-password").model_dump()
    )

    assert resp.status_code == 201
    assert "domain=.energetica-game.org" in resp.headers["set-cookie"].lower()


# --- lobby service outage -------------------------------------------------------------------


def test_login_is_a_503_while_the_lobby_service_is_down() -> None:
    app = create_lobby_app()
    app.dependency_overrides[get_lobby_service] = lambda: LobbyServiceClient.connect(
        "test", socket_path=Path("/nonexistent/lobby-service.sock")
    )

    resp = TestClient(app).post(f"{BASE}/auth/login", json={"username": "alice", "password": "correct-password"})

    assert resp.status_code == 503
    assert resp.json()["detail"] == "LOBBY_SERVICE_UNAVAILABLE"
