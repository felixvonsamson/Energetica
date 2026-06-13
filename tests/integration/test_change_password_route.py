"""Integration tests for change-password. Writes go to SQLite (source of truth)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.globals import engine
from energetica.schemas.auth import ChangePasswordRequest, LoginRequest, SignupRequest
from energetica.utils.auth import check_password_hash

PORT = 8000
BASE_URL = f"http://localhost:{PORT}/api/v1/auth"
SIGNUP_URL = f"{BASE_URL}/signup"
LOGIN_URL = f"{BASE_URL}/login"
CHANGE_URL = f"{BASE_URL}/change-password"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def test_change_password_writes_new_hash_to_sqlite() -> None:
    """After change-password, the SQLite pwhash reflects the new password."""
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="old-password").model_dump())
    client.post(LOGIN_URL, json=LoginRequest(username="alice", password="old-password").model_dump())

    response = client.post(
        CHANGE_URL,
        json=ChangePasswordRequest(old_password="old-password", new_password="new-password").model_dump(),
    )

    assert response.status_code == 204
    account = accounts.get_account_by_username("alice")
    assert account is not None
    assert check_password_hash(plain_password="new-password", hashed_password=account.pwhash) is True
    assert check_password_hash(plain_password="old-password", hashed_password=account.pwhash) is False


def test_login_with_old_password_fails_after_change() -> None:
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="old-password").model_dump())
    client.post(LOGIN_URL, json=LoginRequest(username="alice", password="old-password").model_dump())
    client.post(
        CHANGE_URL,
        json=ChangePasswordRequest(old_password="old-password", new_password="new-password").model_dump(),
    )

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="old-password").model_dump())

    assert response.status_code == 401


def test_login_with_new_password_succeeds_after_change() -> None:
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="old-password").model_dump())
    client.post(LOGIN_URL, json=LoginRequest(username="alice", password="old-password").model_dump())
    client.post(
        CHANGE_URL,
        json=ChangePasswordRequest(old_password="old-password", new_password="new-password").model_dump(),
    )

    response = client.post(LOGIN_URL, json=LoginRequest(username="alice", password="new-password").model_dump())

    assert response.status_code == 200


def test_change_password_with_wrong_old_password_returns_400() -> None:
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="old-password").model_dump())
    client.post(LOGIN_URL, json=LoginRequest(username="alice", password="old-password").model_dump())

    response = client.post(
        CHANGE_URL,
        json=ChangePasswordRequest(old_password="WRONG-old-password", new_password="new-password").model_dump(),
    )

    assert response.status_code == 400
    account = accounts.get_account_by_username("alice")
    assert account is not None
    assert check_password_hash(plain_password="old-password", hashed_password=account.pwhash) is True
