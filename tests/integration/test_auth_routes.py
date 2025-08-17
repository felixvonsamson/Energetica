"""Integration tests for authentication routes."""

from fastapi.testclient import TestClient
from energetica import create_app
from energetica.schemas.auth import LoginRequest, SignupRequest
from energetica.globals import engine

port = 5001
base_url = f"http://localhost:{port}"

login_url = f"{base_url}/api/v1/auth/login"
signup_url = f"{base_url}/api/v1/auth/signup"


def test_signup() -> None:
    """Login should fail for a user that does not exist."""
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=port)
    client = TestClient(app)
    engine.serve_local = False  # TODO: this is hacky

    # Check login fails on non-existent user
    payload1 = LoginRequest(username="nonexistent_username", password="irrelevant")
    response1 = client.post(login_url, json=payload1.model_dump())
    assert 400 <= response1.status_code <= 499

    # Sign up a new user
    payload2 = SignupRequest(username="new_user", password="my-strong-password")
    response2 = client.post(signup_url, json=payload2.model_dump())
    assert 200 <= response2.status_code <= 299

    # Log in in new session
    payload3 = LoginRequest(username="new_user", password="my-strong-password")
    response3 = client.post(login_url, json=payload3.model_dump())
    assert 200 <= response3.status_code <= 299

    # Log in with wrong password
    payload4 = LoginRequest(username="new_user", password="this-was-my-password-right")
    response4 = client.post(login_url, json=payload4.model_dump())
    assert 400 <= response4.status_code <= 499
