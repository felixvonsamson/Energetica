"""Integration tests for authentication routes."""

import requests
from energetica import create_app
from energetica.schemas.auth import LoginRequest, SignupRequest

port = 5123
base_url = f"http://localhost:{port}"

login_url = f"{base_url}/api/v1/auth/login"
signup_url = f"{base_url}/api/v1/auth/signup"


def test_login_for_nonexistent_user() -> None:
    """Login should fail for a user that does not exist."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    session = requests.Session()
    payload = LoginRequest(username="nonexistent_username", password="irrelevant")
    response = session.post(login_url, json=payload.model_dump())
    assert 400 <= response.status_code <= 499


def test_signup() -> None:
    """Login should fail for a user that does not exist."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=port)

    # Sign up a new user
    session1 = requests.Session()
    payload1 = SignupRequest(username="new_user", password="my-strong-password")
    response1 = session1.post(signup_url, json=payload1.model_dump())
    print()
    assert 200 <= response1.status_code <= 299

    # Log in in new session
    session2 = requests.Session()
    payload2 = LoginRequest(username="new_user", password="my-strong-password")
    response2 = session2.post(login_url, json=payload2.model_dump())
    assert 200 <= response2.status_code <= 299

    # Log in with wrong password
    session3 = requests.Session()
    payload3 = LoginRequest(username="new_user", password="this-was-my-password-right")
    response = session3.post(login_url, json=payload3.model_dump())
    assert 400 <= response.status_code <= 499
