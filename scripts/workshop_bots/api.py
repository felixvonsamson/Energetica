"""A small client for the Workshop API, logged in through the lobby like a browser."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

APP_URL = os.environ.get("ENERGETICA_APP_URL", "http://localhost:8000") + "/api/v1"
LOBBY_URL = os.environ.get("ENERGETICA_LOBBY_URL", "http://localhost:8001") + "/api/v1"


# A JSON file {"<username>": "<password>", ...} for accounts that do not use the local default password.
PASSWORDS_FILE = os.environ.get("ENERGETICA_BOT_PASSWORDS")


class ApiError(Exception):
    """A request the backend refused."""


class LoginError(ApiError):
    """An account the script has no password for, or whose login the lobby refused."""


def _passwords() -> dict[str, str] | None:
    if PASSWORDS_FILE is None:
        return None
    try:
        passwords = json.loads(Path(PASSWORDS_FILE).read_text())
    except (OSError, ValueError) as error:
        raise LoginError(f"cannot read the passwords file {PASSWORDS_FILE}: {error}") from error
    if not isinstance(passwords, dict) or not all(isinstance(value, str) for value in passwords.values()):
        raise LoginError(f"the passwords file {PASSWORDS_FILE} must be a JSON object of username to password strings")
    return passwords


def password_for(username: str) -> str:
    """The account's password from ENERGETICA_BOT_PASSWORDS if set, else the local default ``<username>1234``."""
    passwords = _passwords()
    if passwords is None:
        return f"{username}1234"
    if username not in passwords:
        raise LoginError(f"no password for {username} in {PASSWORDS_FILE}")
    return passwords[username]


def facilitator_password_for(username: str) -> str:
    """Like ``password_for``, but ENERGETICA_FACILITATOR_PASSWORD fills in when the file lacks the facilitator."""
    passwords = _passwords()
    if passwords is not None and username in passwords:
        return passwords[username]
    if "ENERGETICA_FACILITATOR_PASSWORD" in os.environ:
        return os.environ["ENERGETICA_FACILITATOR_PASSWORD"]
    return password_for(username)


class Api:
    """One account's session. Without ENERGETICA_BOT_PASSWORDS, accounts use ``<username>1234`` as their password."""

    def __init__(self, username: str, password: str | None = None):
        self.username = username
        self.client = httpx.Client(base_url=APP_URL, timeout=60)
        login = self.request(
            "POST",
            f"{LOBBY_URL}/auth/login",
            json={"username": username, "password": password if password is not None else password_for(username)},
        )
        if login.status_code >= 400:
            raise LoginError(f"the lobby refused the login of {username}: {login.status_code} {login.text[:200]}")
        self.entry: dict[str, Any] = self.request("POST", "/workshop/enter").json()

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Send a request, and send it once more if the connection dropped before any response came back.

        A deployed server's Apache closes an idle keep-alive connection after a few seconds, and any connection after
        100 requests. httpx can reuse a connection just as Apache closes it, and the request then never reaches the
        backend, so sending it again is safe.
        """
        try:
            return self.client.request(method, url, **kwargs)
        # Not ReadError: that can break off a response the backend already acted on, and sending a purchase or an
        # advance again would repeat it.
        except (httpx.RemoteProtocolError, httpx.ConnectError):
            return self.client.request(method, url, **kwargs)

    @property
    def account_id(self) -> int | None:
        player = self.entry.get("player")
        return player["account_id"] if player else None

    def get(self, path: str) -> Any:
        response = self.request("GET", "/workshop" + path)
        if response.status_code >= 400:
            raise ApiError(f"GET {path}: {response.status_code} {response.text[:200]}")
        return response.json()

    def send(self, method: str, path: str, body: Any = None) -> Any:
        response = self.request(method, "/workshop" + path, json=body)
        if response.status_code >= 400:
            raise ApiError(f"{method} {path}: {response.status_code} {response.text[:200]}")
        return response.json()

    # Player actions.
    def select(self, facility: str) -> Any:
        return self.send("POST", "/selection", {"facility": facility})

    def set_price(self, facility: str, side: str, price: float) -> Any:
        return self.send("PUT", f"/prices/{facility}/{side}", {"price": price})

    def set_fuel_order(self, fuel: str, quantity: float) -> Any:
        return self.send("PUT", f"/fuel/{fuel}", {"quantity": quantity})

    def cast_ballot(self, ballot: str) -> Any:
        return self.send("PUT", "/vote/ballot", {"ballot": ballot})


class Facilitator(Api):
    """The facilitator's session, for applying a plan and, in headless runs, advancing the session."""

    def __init__(self, username: str):
        super().__init__(username, facilitator_password_for(username))

    def checkpoint(self) -> dict[str, Any]:
        return self.get("/session")["checkpoint"]

    def advance(self) -> dict[str, Any] | None:
        """Advance once. None if the session refused, which it does while a period is being simulated."""
        response = self.request("POST", "/workshop/session/advance")
        return response.json() if response.status_code < 400 else None

    def advance_to_next_checkpoint(self, timeout: float = 600) -> dict[str, Any]:
        """Close the open window and keep advancing until the session reaches another checkpoint."""
        before = self.checkpoint()
        self.advance()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            answer = self.advance()
            if answer is not None and answer["checkpoint"] != before:
                return answer["checkpoint"]
            time.sleep(0.5)
        raise TimeoutError(f"the session stayed at {before}")

    def apply_plan(self, plan: dict[str, Any]) -> None:
        """Set each Round's levers, then plan its events. ``plan`` is a scenario file's contents."""
        for round_number, levers in plan.get("levers", {}).items():
            self.send("PATCH", f"/plans/{round_number}/levers", levers)
        for round_number, events in plan.get("events", {}).items():
            for event in events:
                self.send("PUT", f"/plans/{round_number}/events", event)
