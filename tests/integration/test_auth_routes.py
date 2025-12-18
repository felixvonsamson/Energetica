"""Integration tests for authentication routes."""

from fastapi.testclient import TestClient
from energetica import create_app
from energetica.schemas.auth import ChangePasswordRequest, LoginRequest, SignupRequest
from energetica.globals import engine

port = 8000
base_url = f"http://localhost:{port}"

login_url = f"{base_url}/api/v1/auth/login"
signup_url = f"{base_url}/api/v1/auth/signup"
change_password_url = f"{base_url}/api/v1/auth/change-password"


def test_signup() -> None:
    """Login should fail for a user that does not exist."""
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=port)
    client = TestClient(app)
    engine.serve_local = False  # TODO: this is hacky

    # Check login fails on non-existent user
    payload1 = LoginRequest(username="nonexistent_username", password="irrelevant")
    response1 = client.post(login_url, json=payload1.model_dump())
    assert response1.status_code == 401

    # Sign up a new user
    payload2 = SignupRequest(username="new_user", password="my-strong-password")
    response2 = client.post(signup_url, json=payload2.model_dump())
    assert response2.status_code == 201

    # Log in in new session
    payload3 = LoginRequest(username="new_user", password="my-strong-password")
    response3 = client.post(login_url, json=payload3.model_dump())
    assert response3.status_code == 200

    # Log in with wrong password
    payload4 = LoginRequest(username="new_user", password="this-was-my-password-right")
    response4 = client.post(login_url, json=payload4.model_dump())
    assert response4.status_code == 401

    # Fail to change password
    payload5 = ChangePasswordRequest(old_password="my-WRONG-password", new_password="my-new-password")
    response5 = client.post(change_password_url, json=payload5.model_dump())
    assert response5.status_code == 400
    # NOTE: this is given as a 400 error because we wrap the error in a GameError

    # Change password, correctly this time
    payload6 = ChangePasswordRequest(old_password="my-strong-password", new_password="my-new-password")
    response6 = client.post(change_password_url, json=payload6.model_dump())
    assert response6.status_code == 204

    # Log in with OLD password
    payload7 = LoginRequest(username="new_user", password="my-strong-password")
    response7 = client.post(login_url, json=payload7.model_dump())
    assert response7.status_code == 401

    # Log in with new password
    payload8 = LoginRequest(username="new_user", password="my-new-password")
    response8 = client.post(login_url, json=payload8.model_dump())
    assert response8.status_code == 200
