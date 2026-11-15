# Pyright flags a comparison with a literal the backend's type no longer has.
# pyright: reportUnnecessaryComparison=true
"""A small client for the Workshop API, logged in through the lobby like a browser.

Each method parses its response into the backend's own Pydantic model, and builds its request body from the backend's
request model. So when the backend renames or reshapes a field, pyright fails on the bots in CI, and a response that
still slips through fails here with a validation error that names the field, rather than deep inside a strategy.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, TypeAdapter

from energetica.identity.schemas.auth import LoginRequest
from energetica.workshop.balance_sheet import BalanceSheet
from energetica.workshop.facilities import FacilityId, Fuel
from energetica.workshop.prices import PRICE_CEILING, PRICE_FLOOR, PriceSide
from energetica.workshop.recap import WorkshopRecap
from energetica.workshop.round_plan import LeverChanges, PlannedEvent
from energetica.workshop.schemas import (
    WorkshopBallotIn,
    WorkshopEntryOut,
    WorkshopFacilityOut,
    WorkshopFuelOrderIn,
    WorkshopFuelOut,
    WorkshopLoanOut,
    WorkshopOwnedFacilityOut,
    WorkshopPeriodDaysOut,
    WorkshopPeriodOut,
    WorkshopPriceIn,
    WorkshopPricesOut,
    WorkshopSelectionIn,
    WorkshopSelectionOut,
    WorkshopSessionOut,
    WorkshopVoteOut,
)
from energetica.workshop.score import Scoreboard
from energetica.workshop.seasons import Season
from energetica.workshop.session import Checkpoint
from energetica.workshop.votes import Ballot

APP_URL = os.environ.get("ENERGETICA_APP_URL", "http://localhost:8000") + "/api/v1"
LOBBY_URL = os.environ.get("ENERGETICA_LOBBY_URL", "http://localhost:8001") + "/api/v1"

# The methods the bots send whose second copy changes nothing: each PUT and PATCH sets a value or replaces an event.
SAFE_TO_REPEAT = {"GET", "PUT", "PATCH"}


# A JSON file {"<username>": "<password>", ...} for accounts that do not use the local default password.
PASSWORDS_FILE = os.environ.get("ENERGETICA_BOT_PASSWORDS")

_FACILITY_LIST = TypeAdapter(list[WorkshopFacilityOut])
_FLEET_LIST = TypeAdapter(list[WorkshopOwnedFacilityOut])


class ApiError(Exception):
    """A request the backend refused. ``code`` is its error code, such as ``WORKSHOP_NO_PERIOD_RECORD``, if it gave
    one.
    """

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.code = code


class LoginError(ApiError):
    """An account the script has no password for, whose login the lobby refused, or that cannot enter the Run."""


def _error_code(response: httpx.Response) -> str | None:
    """The error code in a refusal's body: a game error's ``game_exception_type``, or an HTTP error's ``detail``."""
    try:
        body = response.json()
    except ValueError:
        return None
    if not isinstance(body, dict):
        return None
    code = body.get("game_exception_type", body.get("detail"))
    return code if isinstance(code, str) else None


class Plan(BaseModel):
    """A plan file in plans/: the levers to change and the events to plan, by Round. A misspelled key is refused."""

    model_config = ConfigDict(extra="forbid")

    levers: dict[int, LeverChanges] = {}
    events: dict[int, list[PlannedEvent]] = {}


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
        # Drop an idle connection before Apache's 5-second keep-alive timeout closes it, so a request that is not safe
        # to repeat rarely goes out on a connection that is closing.
        self.client = httpx.Client(base_url=APP_URL, timeout=60, limits=httpx.Limits(keepalive_expiry=3))
        credentials = LoginRequest(
            username=username, password=password if password is not None else password_for(username)
        )
        login = self.request("POST", f"{LOBBY_URL}/auth/login", json=credentials.model_dump(mode="json"))
        if login.status_code >= 400:
            raise LoginError(f"the lobby refused the login of {username}: {login.status_code} {login.text[:200]}")
        entry = self.request("POST", "/workshop/enter")
        if entry.status_code >= 400:
            raise LoginError(f"{username} cannot enter the Run: {entry.status_code} {entry.text[:200]}")
        self.entry = WorkshopEntryOut.model_validate_json(entry.content)

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Send a request, and send it once more if the connection dropped before any response came back.

        A deployed server's Apache closes an idle keep-alive connection after a few seconds, and any connection after
        100 requests. httpx can reuse a connection just as Apache closes it. A ConnectError means the request never
        left, so it is always sent again. A RemoteProtocolError can also come after the backend acted, so only a
        request that is safe to repeat is sent again: sending a purchase or an advance twice would repeat it.
        """
        try:
            return self.client.request(method, url, **kwargs)
        except httpx.ConnectError:
            return self.client.request(method, url, **kwargs)
        except httpx.RemoteProtocolError:
            if method not in SAFE_TO_REPEAT:
                raise
            return self.client.request(method, url, **kwargs)

    @property
    def account_id(self) -> int | None:
        return self.entry.player.account_id if self.entry.player is not None else None

    def _send(self, method: str, path: str, body: BaseModel | None = None) -> bytes:
        """Send a request under ``/workshop`` and return the response's body. Raise ApiError if the backend refused."""
        json_body = body.model_dump(mode="json", exclude_unset=True) if body is not None else None
        response = self.request(method, "/workshop" + path, json=json_body)
        if response.status_code >= 400:
            raise ApiError(f"{method} {path}: {response.status_code} {response.text[:200]}", _error_code(response))
        return response.content

    # What everyone in the Run can read.
    def session(self) -> WorkshopSessionOut:
        return WorkshopSessionOut.model_validate_json(self._send("GET", "/session"))

    def facilities(self) -> list[WorkshopFacilityOut]:
        return _FACILITY_LIST.validate_json(self._send("GET", "/facilities"))

    def period(self, round_number: int, season: Season) -> WorkshopPeriodOut:
        return WorkshopPeriodOut.model_validate_json(self._send("GET", f"/periods/{round_number}/{season}"))

    def period_days(self, round_number: int, season: Season, first_day: int, count: int) -> WorkshopPeriodDaysOut:
        path = f"/periods/{round_number}/{season}/days/{first_day}/{count}"
        return WorkshopPeriodDaysOut.model_validate_json(self._send("GET", path))

    def recap(self, round_number: int) -> WorkshopRecap:
        return WorkshopRecap.model_validate_json(self._send("GET", f"/rounds/{round_number}/recap"))

    def vote(self) -> WorkshopVoteOut:
        return WorkshopVoteOut.model_validate_json(self._send("GET", "/vote"))

    def scoreboard(self) -> Scoreboard:
        return Scoreboard.model_validate_json(self._send("GET", "/scoreboard"))

    # A player's own state.
    def fleet(self) -> list[WorkshopOwnedFacilityOut]:
        return _FLEET_LIST.validate_json(self._send("GET", "/fleet"))

    def selection(self) -> WorkshopSelectionOut:
        return WorkshopSelectionOut.model_validate_json(self._send("GET", "/selection"))

    def fuel(self) -> WorkshopFuelOut:
        return WorkshopFuelOut.model_validate_json(self._send("GET", "/fuel"))

    def loan(self) -> WorkshopLoanOut:
        return WorkshopLoanOut.model_validate_json(self._send("GET", "/loan"))

    def balance_sheet(self, round_number: int) -> BalanceSheet:
        return BalanceSheet.model_validate_json(self._send("GET", f"/rounds/{round_number}/balance-sheet"))

    # Player actions.
    def select(self, facility: FacilityId) -> WorkshopSelectionOut:
        body = WorkshopSelectionIn(facility=facility)
        return WorkshopSelectionOut.model_validate_json(self._send("POST", "/selection", body))

    def set_price(self, facility: FacilityId, side: PriceSide, price: float) -> WorkshopPricesOut:
        # The server refuses prices outside this range, and the refusal would end the bot's turn.
        body = WorkshopPriceIn(price=min(max(price, PRICE_FLOOR), PRICE_CEILING))
        return WorkshopPricesOut.model_validate_json(self._send("PUT", f"/prices/{facility}/{side}", body))

    def set_fuel_order(self, fuel: Fuel, quantity: float) -> WorkshopFuelOut:
        body = WorkshopFuelOrderIn(quantity=quantity)
        return WorkshopFuelOut.model_validate_json(self._send("PUT", f"/fuel/{fuel}", body))

    def cast_ballot(self, ballot: Ballot) -> WorkshopVoteOut:
        body = WorkshopBallotIn(ballot=ballot)
        return WorkshopVoteOut.model_validate_json(self._send("PUT", "/vote/ballot", body))

    def take_loan(self) -> WorkshopLoanOut:
        return WorkshopLoanOut.model_validate_json(self._send("POST", "/loan"))


class Facilitator(Api):
    """The facilitator's session, for applying a plan and, in headless runs, advancing the session."""

    def __init__(self, username: str):
        super().__init__(username, facilitator_password_for(username))

    def checkpoint(self) -> Checkpoint:
        return self.session().checkpoint

    def advance(self) -> WorkshopSessionOut | None:
        """Advance once. None if the session refused, which it does while a period is being simulated."""
        try:
            return WorkshopSessionOut.model_validate_json(self._send("POST", "/session/advance"))
        except ApiError:
            return None

    def advance_to_next_checkpoint(self, timeout: float = 600) -> Checkpoint:
        """Close the open window and keep advancing until the session reaches another checkpoint."""
        before = self.checkpoint()
        self.advance()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            answer = self.advance()
            if answer is not None and answer.checkpoint != before:
                return answer.checkpoint
            time.sleep(0.5)
        raise TimeoutError(f"the session stayed at {before}")

    def apply_plan(self, plan: Plan) -> None:
        """Set each Round's levers, then plan its events."""
        for round_number, levers in plan.levers.items():
            self._send("PATCH", f"/plans/{round_number}/levers", levers)
        for round_number, events in plan.events.items():
            for event in events:
                self._send("PUT", f"/plans/{round_number}/events", event)
