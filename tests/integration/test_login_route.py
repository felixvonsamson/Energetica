"""Integration tests for the login route. Credential check goes through SQLite, not the pickle."""

from __future__ import annotations

from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.database.user import User
from energetica.globals import engine
from energetica.schemas.auth import LoginRequest, SignupRequest

PORT = 8000
BASE_URL = f"http://localhost:{PORT}/api/v1/auth"
SIGNUP_URL = f"{BASE_URL}/signup"
LOGIN_URL = f"{BASE_URL}/login"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def test_login_succeeds_when_sqlite_password_matches() -> None:
    """A user who signed up on this instance can log in."""
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="correct-password").model_dump())

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="correct-password").model_dump())

    assert response.status_code == 200


def test_login_uses_sqlite_pwhash_not_pickle_pwhash() -> None:
    """Corrupting the pickle pwhash leaves SQLite intact; login still succeeds because credentials
    are checked against SQLite. This is the cross-instance password-change story in microcosm.
    """
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="correct-password").model_dump())

    pickle_user = next(User.filter_by(username="alice"))
    pickle_user.pwhash = "corrupted-no-longer-valid"

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="correct-password").model_dump())

    assert response.status_code == 200


def test_login_auto_provisions_pickle_user_when_account_is_new_to_instance() -> None:
    """Simulates first login on an instance the user has never visited:
    a server-wide SQLite account exists, but no pickle User. Login should auto-create one.
    """
    from energetica.utils.auth import generate_password_hash

    client = _client()
    # Server-wide account exists (created on another instance — simulated here by writing SQLite directly)
    account_id = accounts.create_account(
        username="visitor",
        pwhash=generate_password_hash("correct-password"),
    )
    assert next(User.filter_by(account_id=account_id), None) is None

    response = client.post(
        LOGIN_URL, json=LoginRequest(username="visitor", password="correct-password").model_dump()
    )

    assert response.status_code == 200
    provisioned = next(User.filter_by(account_id=account_id), None)
    assert provisioned is not None
    assert provisioned.username == "visitor"
    assert provisioned.role == "player"
    assert provisioned.player is None  # No Player created — that happens at settle


def test_login_with_wrong_password_returns_401() -> None:
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="correct-password").model_dump())

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="wrong-password").model_dump())

    assert response.status_code == 401


def test_login_with_unknown_username_returns_401() -> None:
    client = _client()

    response = client.post(LOGIN_URL, json=LoginRequest(username="ghost", password="anything").model_dump())

    assert response.status_code == 401