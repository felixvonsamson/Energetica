"""Tests piggy-backing off of init test players."""

import os
import signal
import subprocess
from time import sleep

import requests

from energetica.schemas.auth import LoginRequest

port = 5012
base_url = f"http://localhost:{port}"

login_url = f"{base_url}/api/v1/auth/login"
signup_url = f"{base_url}/api/v1/auth/signup"
change_password_url = f"{base_url}/api/v1/auth/change-password"


def test_server_runs() -> None:
    process = subprocess.Popen(
        ["python", "main.py", "--port", str(port), "--rm_instance", "--env", "prod", "--run_init_test_players"],
    )

    session = requests.session()

    trials = 0
    while True:
        try:
            login_response = session.post(
                login_url,
                json=LoginRequest(username="user1", password="password").model_dump(),
            )
            assert login_response.status_code == 200
            response = session.get(f"{base_url}/home", timeout=1)
            assert response.status_code >= 200 and response.status_code <= 299
        except requests.exceptions.ConnectionError:
            trials += 1
            if trials == 10:
                assert False
            sleep(1)
        else:
            assert response.status_code == 200
            break
    os.kill(process.pid, signal.SIGTERM)
    process.wait()
