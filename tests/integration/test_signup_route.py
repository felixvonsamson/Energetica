"""Integration tests for the signup route's SQLite + pickle dual-write."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.database.user import User
from energetica.globals import engine
from energetica.schemas.auth import SignupRequest

PORT = 8000
SIGNUP_URL = f"http://localhost:{PORT}/api/v1/auth/signup"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def test_signup_writes_to_sqlite_and_pickle_with_matching_account_id() -> None:
    """A successful signup leaves a row in SQLite, a User in the pickle, and the User's
    account_id matches the SQLite account_id.
    """
    client = _client()

    response = client.post(
        SIGNUP_URL,
        json=SignupRequest(username="alice", password="my-strong-pw").model_dump(),
    )

    assert response.status_code == 201
    sqlite_account = accounts.get_account_by_username("alice")
    pickle_user = next(User.filter_by(username="alice"), None)
    assert sqlite_account is not None
    assert pickle_user is not None
    assert pickle_user.account_id == sqlite_account.account_id


def test_signup_rejects_duplicate_username() -> None:
    """A second signup with the same username returns 409 and leaves the original row intact."""
    client = _client()
    client.post(SIGNUP_URL, json=SignupRequest(username="alice", password="first-pw").model_dump())

    response = client.post(
        SIGNUP_URL,
        json=SignupRequest(username="alice", password="second-pw").model_dump(),
    )

    assert response.status_code == 409
    sqlite_account = accounts.get_account_by_username("alice")
    assert sqlite_account is not None


def test_signup_rejects_username_taken_on_another_instance() -> None:
    """Simulates: alice signed up on instance A; now tries to sign up on instance B (this one).
    SQLite has the row, this instance's pickle does not. The signup must still 409 — alice should
    log in to provision the pickle User on this instance, not sign up a second time.
    """
    from energetica.utils.auth import generate_password_hash

    client = _client()
    accounts.create_account(username="alice", pwhash=generate_password_hash("first-pw"))

    response = client.post(
        SIGNUP_URL,
        json=SignupRequest(username="alice", password="second-pw").model_dump(),
    )

    assert response.status_code == 409


def test_signup_rolls_back_sqlite_if_pickle_creation_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    """If creating the pickle User raises, the SQLite row must be deleted so re-signup is unblocked."""
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    # raise_server_exceptions=False so a 500 from the handler does not abort the test
    client = TestClient(app, raise_server_exceptions=False)

    original_post_init = User.__post_init__

    def boom(self: User) -> None:
        raise RuntimeError("simulated pickle write failure")

    monkeypatch.setattr(User, "__post_init__", boom)

    response = client.post(
        SIGNUP_URL,
        json=SignupRequest(username="alice", password="first-pw").model_dump(),
    )

    assert response.status_code == 500
    assert accounts.get_account_by_username("alice") is None

    # Restore and confirm a fresh signup with the same username succeeds (no stale row)
    monkeypatch.setattr(User, "__post_init__", original_post_init)
    retry = client.post(
        SIGNUP_URL,
        json=SignupRequest(username="alice", password="first-pw").model_dump(),
    )
    assert retry.status_code == 201
