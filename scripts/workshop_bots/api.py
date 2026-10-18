"""A small client for the Workshop API, logged in through the local lobby like a browser."""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

APP_URL = os.environ.get("ENERGETICA_APP_URL", "http://localhost:8000") + "/api/v1"
LOBBY_URL = os.environ.get("ENERGETICA_LOBBY_URL", "http://localhost:8001") + "/api/v1"

# The range the server accepts for a price, both included: energetica.workshop.prices.PRICE_FLOOR and PRICE_CEILING.
PRICE_FLOOR = -25.0
PRICE_CEILING = 1000.0


class ApiError(Exception):
    """A request the backend refused."""


class Api:
    """One account's session. Bot accounts use ``<username>1234`` as their password."""

    def __init__(self, username: str, password: str | None = None):
        self.username = username
        self.client = httpx.Client(base_url=APP_URL, timeout=60)
        login = self.client.post(
            f"{LOBBY_URL}/auth/login", json={"username": username, "password": password or f"{username}1234"}
        )
        login.raise_for_status()
        self.entry: dict[str, Any] = self.client.post("/workshop/enter").json()

    @property
    def account_id(self) -> int | None:
        player = self.entry.get("player")
        return player["account_id"] if player else None

    def get(self, path: str) -> Any:
        response = self.client.get("/workshop" + path)
        if response.status_code >= 400:
            raise ApiError(f"GET {path}: {response.status_code} {response.text[:200]}")
        return response.json()

    def send(self, method: str, path: str, body: Any = None) -> Any:
        response = self.client.request(method, "/workshop" + path, json=body)
        if response.status_code >= 400:
            raise ApiError(f"{method} {path}: {response.status_code} {response.text[:200]}")
        return response.json()

    # Player actions.
    def select(self, facility: str) -> Any:
        return self.send("POST", "/selection", {"facility": facility})

    def set_price(self, facility: str, side: str, price: float) -> Any:
        # The server refuses prices outside this range, and the refusal would end the bot's turn.
        price = min(max(price, PRICE_FLOOR), PRICE_CEILING)
        return self.send("PUT", f"/prices/{facility}/{side}", {"price": price})

    def set_fuel_order(self, fuel: str, quantity: float) -> Any:
        return self.send("PUT", f"/fuel/{fuel}", {"quantity": quantity})

    def cast_ballot(self, ballot: str) -> Any:
        return self.send("PUT", "/vote/ballot", {"ballot": ballot})


class Facilitator(Api):
    """The facilitator's session, for applying a plan and, in headless runs, advancing the session."""

    def checkpoint(self) -> dict[str, Any]:
        return self.get("/session")["checkpoint"]

    def advance(self) -> dict[str, Any] | None:
        """Advance once. None if the session refused, which it does while a period is being simulated."""
        response = self.client.post("/workshop/session/advance")
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
