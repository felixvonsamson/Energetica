"""Integration tests for the Workshop app (#994): what the backend serves when it starts a Workshop
Run instead of the persistent world.

These build the Workshop app directly. ``test_instance_app_starts_workshop_without_the_persistent_world``
checks the dispatch that ``main.py`` goes through, in a fresh interpreter, because the test process
has already imported the persistent world.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

from energetica.identity import accounts
from energetica.identity.instance_config import load_instance_config
from energetica.workshop import app as workshop_app
from energetica.workshop.app import create_workshop_app
from energetica.workshop.facilities import FacilityId
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop import session as session_module
from energetica.workshop.session import TradingPeriod, WorkshopSession
from energetica.workshop.trading import TradingOutcome

from . import _socketio_helpers as socket
from ._session_helpers import authenticate, make_account

SLUG = "workshop-autumn"
_REPO_ROOT = Path(__file__).resolve().parents[2]

WORKSHOP_JSON = {
    "name": "Workshop",
    "advertised": False,
    "starts_at": "2026-03-01T00:00:00Z",
    "run": {"mode": "workshop"},
}

ENTER_URL = "/api/v1/workshop/enter"
SESSION_URL = "/api/v1/workshop/session"
ADVANCE_URL = "/api/v1/workshop/session/advance"
EXTEND_URL = "/api/v1/workshop/session/phase/extend"
FACILITIES_URL = "/api/v1/workshop/facilities"
FLEET_URL = "/api/v1/workshop/fleet"
SELECTION_URL = "/api/v1/workshop/selection"
PRICES_URL = "/api/v1/workshop/prices"
LOCKED_PRICES_URL = "/api/v1/workshop/prices/locked"
FACILITATOR_ACCESS_URL = "/api/v1/facilitator/access"
FACILITATOR_ROSTER_URL = "/api/v1/facilitator/roster"


@pytest.fixture
def session_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Configure this process as the Workshop Run ``SLUG`` and return where its session is saved."""
    config_dir = tmp_path / "etc"
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(config_dir))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    instance_json = config_dir / SLUG / "instance.json"
    instance_json.parent.mkdir(parents=True)
    instance_json.write_text(json.dumps(WORKSHOP_JSON), encoding="utf-8")
    return tmp_path / "instance" / "workshop_session.json"


def _client(session_path: Path) -> TestClient:
    config = load_instance_config()
    assert config is not None
    return TestClient(create_workshop_app(config, session_path=session_path))


def _player(client: TestClient, username: str) -> int:
    account_id = make_account(username)
    accounts.record_join(account_id=account_id, slug=SLUG, joined_at=datetime.now(timezone.utc).isoformat())
    authenticate(client, account_id)
    return account_id


def _facilitator(client: TestClient) -> int:
    account_id = make_account("prof")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
    authenticate(client, account_id)
    return account_id


def _advance(client: TestClient) -> Response:
    """Move on to the next checkpoint as the facilitator does: advance once to close a window that is still
    open, wait for a Trading period to be settled, and advance again.

    The app settles the period in the background while the client is entered. Otherwise the test settles
    it here, the same way.
    """
    session: WorkshopSession = client.app.state.workshop_session  # type: ignore[attr-defined]
    if session.phase_timer is not None and session.phase_timer.is_active(session.clock()):
        client.post(ADVANCE_URL)
    period = session.checkpoint
    if isinstance(period, TradingPeriod):
        job = session.start_settlement()
        if job is not None:
            session.finish_settlement(job, session.run_settlement(job))
        deadline = time.monotonic() + 5
        while session.settled_period != period and time.monotonic() < deadline:
            time.sleep(0.01)
    return client.post(ADVANCE_URL)


def _checkpoint(kind: str, round_number: int | None = None, season: str | None = None) -> dict:
    checkpoint: dict = {"kind": kind}
    if round_number is not None:
        checkpoint["round"] = round_number
    if season is not None:
        checkpoint["season"] = season
    return checkpoint


# --- the Run mode ---------------------------------------------------------------------------


def test_reports_the_workshop_run_mode(session_path: Path) -> None:
    response = _client(session_path).get("/api/v1/run")

    assert response.status_code == 200
    assert response.json() == {"mode": "workshop"}


def test_serves_none_of_the_persistent_world(session_path: Path) -> None:
    app = create_workshop_app(load_instance_config(), session_path=session_path)
    paths = {getattr(route, "path", None) for route in app.routes}

    assert "/api/v1/auth/me" not in paths
    assert not any(path and path.startswith("/api/v1/facilities") for path in paths)


def test_health_check_is_ok(session_path: Path) -> None:
    response = _client(session_path).get("/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# --- entering the Run -----------------------------------------------------------------------


def test_entering_without_a_session_is_401(session_path: Path) -> None:
    assert _client(session_path).post(ENTER_URL).status_code == 401


def test_entering_a_private_run_without_having_joined_it_is_403(session_path: Path) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    assert client.post(ENTER_URL).status_code == 403


def test_a_player_entering_is_placed_into_the_shared_network(session_path: Path) -> None:
    client = _client(session_path)
    account_id = _player(client, "alice")

    response = client.post(ENTER_URL)

    assert response.status_code == 200
    assert response.json() == {
        "role": "player",
        "player": {"account_id": account_id, "username": "alice", "money": 25_000.0},
    }
    assert [player["username"] for player in client.get(SESSION_URL).json()["players"]] == ["alice"]


def test_entering_twice_keeps_one_place_in_the_network(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    client.post(ENTER_URL)
    client.post(ENTER_URL)

    assert len(client.get(SESSION_URL).json()["players"]) == 1


def test_a_facilitator_entering_is_not_placed_into_the_network(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    response = client.post(ENTER_URL)

    assert response.status_code == 200
    assert response.json() == {"role": "facilitator", "player": None}
    assert client.get(SESSION_URL).json()["players"] == []


# --- admitting players to a private Run ----------------------------------------------------


def test_a_player_admitted_through_the_join_link_can_enter(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    token = client.get(FACILITATOR_ACCESS_URL).json()["join_token"]
    assert client.patch(FACILITATOR_ACCESS_URL, json={"join_open": True}).status_code == 204
    account_id = make_account("alice")
    authenticate(client, account_id)
    assert client.post(ENTER_URL).status_code == 403

    assert client.post(f"/api/v1/join/{token}").status_code == 204
    response = client.post(ENTER_URL)

    assert response.status_code == 200
    assert response.json()["player"]["account_id"] == account_id
    assert [player["username"] for player in client.get(SESSION_URL).json()["players"]] == ["alice"]


def test_a_player_added_to_the_roster_can_enter(session_path: Path) -> None:
    client = _client(session_path)
    account_id = make_account("alice")
    _facilitator(client)

    assert client.post(FACILITATOR_ROSTER_URL, json={"username": "alice"}).status_code == 204
    authenticate(client, account_id)
    response = client.post(ENTER_URL)

    assert response.status_code == 200
    assert response.json()["player"]["account_id"] == account_id


# --- the session ----------------------------------------------------------------------------


def test_a_new_session_has_not_started(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    body = client.get(SESSION_URL).json()

    assert body["checkpoint"] == _checkpoint("not_started")
    assert body["round_count"] == 3


def test_the_session_names_the_checkpoint_an_advance_moves_to(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    assert client.get(SESSION_URL).json()["next_checkpoint"] == _checkpoint("investment", 1)

    body = client.post(ADVANCE_URL).json()

    assert body["checkpoint"] == _checkpoint("investment", 1)
    assert body["next_checkpoint"] == _checkpoint("trading_period", 1, "spring")


def test_the_session_lists_the_trading_periods_the_grid_went_down_in(session_path: Path) -> None:
    # Alice owns nothing, so nothing meets her must-serve demand and the grid goes down in spring.
    client = _client(session_path)
    _player(client, "alice")
    client.post(ENTER_URL)
    _facilitator(client)
    assert client.get(SESSION_URL).json()["blackouts"] == []

    for _ in range(2):
        _advance(client)
    # Closes the price-setting window, then settles the period as the app does in the background.
    client.post(ADVANCE_URL)
    session: WorkshopSession = client.app.state.workshop_session  # type: ignore[attr-defined]
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))

    body = client.get(SESSION_URL).json()
    assert body["checkpoint"] == _checkpoint("trading_period", 1, "spring")
    assert body["blackouts"] == [_checkpoint("trading_period", 1, "spring")]
    assert body["next_checkpoint"] == _checkpoint("recap", 1)


def test_reading_the_session_needs_entry(session_path: Path) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    assert client.get(SESSION_URL).status_code == 403


def test_a_player_cannot_advance_the_session(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    assert client.post(ADVANCE_URL).status_code == 403
    assert client.get(SESSION_URL).json()["checkpoint"] == _checkpoint("not_started")


def test_the_moderator_advances_an_empty_round_to_recap_and_into_round_two(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    visited = [_advance(client).json()["checkpoint"] for _ in range(8)]

    assert visited == [
        _checkpoint("investment", 1),
        _checkpoint("trading_period", 1, "spring"),
        _checkpoint("trading_period", 1, "summer"),
        _checkpoint("trading_period", 1, "autumn"),
        _checkpoint("trading_period", 1, "winter"),
        _checkpoint("recap", 1),
        _checkpoint("investment", 2),
        _checkpoint("trading_period", 2, "spring"),
    ]


def test_advancing_a_finished_session_is_an_error(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    # Three Rounds of six checkpoints each, plus the step into the first Round and the step out of the last.
    for _ in range(3 * 6 + 1):
        assert _advance(client).status_code == 200
    finished = client.get(SESSION_URL).json()
    assert finished["checkpoint"] == _checkpoint("finished")
    assert finished["next_checkpoint"] is None

    response = client.post(ADVANCE_URL)

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "WORKSHOP_SESSION_FINISHED"


def test_the_session_survives_a_restart(session_path: Path) -> None:
    client = _client(session_path)
    account_id = _player(client, "alice")
    client.post(ENTER_URL)
    _facilitator(client)
    for _ in range(2):
        _advance(client)

    restarted = _client(session_path)
    authenticate(restarted, account_id)
    body = restarted.get(SESSION_URL).json()

    assert body["checkpoint"] == _checkpoint("trading_period", 1, "spring")
    assert [player["username"] for player in body["players"]] == ["alice"]


# --- phase timers (#996) --------------------------------------------------------------------


def test_no_phase_is_timed_before_the_session_starts(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    assert client.get(SESSION_URL).json()["phase_timer"] is None


def test_the_investment_phase_counts_down_from_eight_minutes(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    timer = client.post(ADVANCE_URL).json()["phase_timer"]

    assert 470 < timer["remaining_seconds"] <= 480


def test_the_facilitator_extends_the_running_phase(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    client.post(ADVANCE_URL)

    response = client.post(EXTEND_URL, json={"minutes": 2})

    assert response.status_code == 200
    assert 590 < response.json()["phase_timer"]["remaining_seconds"] <= 600


def test_a_player_cannot_extend_the_phase(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    client.post(ADVANCE_URL)
    _player(client, "alice")

    assert client.post(EXTEND_URL, json={"minutes": 2}).status_code == 403
    assert client.get(SESSION_URL).json()["phase_timer"]["remaining_seconds"] <= 480


def test_extending_when_no_phase_is_running_is_an_error(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    response = client.post(EXTEND_URL, json={"minutes": 2})

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "WORKSHOP_NO_PHASE_RUNNING"


@pytest.mark.parametrize("minutes", [0, -1, 61])
def test_an_extension_must_be_between_one_minute_and_an_hour(session_path: Path, minutes: int) -> None:
    client = _client(session_path)
    _facilitator(client)
    client.post(ADVANCE_URL)

    assert client.post(EXTEND_URL, json={"minutes": minutes}).status_code == 422


# --- the facility catalog and fleet (#998) ---------------------------------------------------


def test_the_catalog_offers_every_base_tier_and_nothing_unlockable(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    response = client.get(FACILITIES_URL)

    assert response.status_code == 200
    assert [facility["id"] for facility in response.json()] == [
        "onshore_wind_turbine",
        "coal_burner",
        "gas_burner",
        "small_water_dam",
        "nuclear_reactor",
        "pv_solar",
        "lithium_ion_batteries",
    ]


def test_a_new_players_fleet_is_empty(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")
    client.post(ENTER_URL)

    response = client.get(FLEET_URL)

    assert response.status_code == 200
    assert response.json() == []


def test_the_fleet_shows_how_long_each_owned_facility_has_left(session_path: Path) -> None:
    app = create_workshop_app(load_instance_config(), session_path=session_path)
    client = TestClient(app)
    account_id = _player(client, "alice")
    client.post(ENTER_URL)
    # Handed to the player directly, so the test is about the fleet alone and not about buying.
    alice = app.state.workshop_session.network.members[account_id]
    alice.owned_facilities.extend(
        [
            OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=1),
            OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=1),
        ]
    )

    assert client.get(FLEET_URL).json() == [
        {"facility": "onshore_wind_turbine", "built_round": 1, "rounds_left": 2, "under_construction": False},
        {"facility": "nuclear_reactor", "built_round": 1, "rounds_left": 8, "under_construction": True},
    ]


def test_a_facilitator_owns_no_fleet(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    assert client.get(FLEET_URL).json() == []


@pytest.mark.parametrize("url", [FACILITIES_URL, FLEET_URL])
def test_the_catalog_and_fleet_need_entry(session_path: Path, url: str) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    assert client.get(url).status_code == 403


# --- the investment selection (#999) --------------------------------------------------------


class _Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now

    def tick(self, **elapsed: float) -> None:
        self.now += timedelta(**elapsed)


def _investing(session_path: Path, clock: _Clock, *usernames: str) -> tuple[FastAPI, TestClient, int, list[int]]:
    """An app in Round 1's Investment phase, with each of ``usernames`` entered and holding 1,000,000.

    Returns the app, a client left signed in as the facilitator, and the facilitator's and players'
    account ids.
    """
    app = create_workshop_app(load_instance_config(), session_path=session_path, clock=clock)
    client = TestClient(app)
    account_ids = []
    for username in usernames:
        account_ids.append(_player(client, username))
        client.post(ENTER_URL)
        app.state.workshop_session.player(account_ids[-1]).money = 1_000_000.0
    facilitator = _facilitator(client)
    client.post(ADVANCE_URL)
    return app, client, facilitator, account_ids


@pytest.fixture
def clock() -> _Clock:
    return _Clock()


def test_a_player_selects_facilities_to_buy_when_the_investment_phase_closes(session_path: Path, clock: _Clock) -> None:
    _, client, _, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)

    client.post(SELECTION_URL, json={"facility": "gas_burner"})
    response = client.post(SELECTION_URL, json={"facility": "small_water_dam"})

    assert response.status_code == 200
    assert response.json() == {
        "facilities": ["gas_burner", "small_water_dam"],
        "total_cost": 155_000.0,
        "money": 1_000_000.0,
        "stored_energy_at_risk": {},
    }
    assert client.get(SELECTION_URL).json() == response.json()
    assert client.get(FLEET_URL).json() == []


def test_a_player_removes_a_facility_from_their_selection(session_path: Path, clock: _Clock) -> None:
    _, client, _, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "gas_burner"})

    response = client.delete(f"{SELECTION_URL}/gas_burner")

    assert response.status_code == 200
    assert response.json()["facilities"] == []


def test_the_selection_says_how_much_stored_energy_it_does_not_yet_hold(session_path: Path, clock: _Clock) -> None:
    app, client, _, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    # Handed to the player directly: energy left over from batteries that just retired, and the money
    # for two new ones.
    player = app.state.workshop_session.player(alice)
    player.stored_energy[FacilityId.LITHIUM_ION_BATTERIES] = 5_000_000_000.0
    player.money = 2_000_000.0

    assert client.get(SELECTION_URL).json()["stored_energy_at_risk"] == {"lithium_ion_batteries": 5_000_000_000.0}
    response = client.post(SELECTION_URL, json={"facility": "lithium_ion_batteries"})
    assert response.json()["stored_energy_at_risk"] == {"lithium_ion_batteries": 1_800_000_000.0}
    response = client.post(SELECTION_URL, json={"facility": "lithium_ion_batteries"})
    assert response.json()["stored_energy_at_risk"] == {}


@pytest.mark.parametrize(
    ("request_selection", "error"),
    [
        (lambda client: client.post(SELECTION_URL, json={"facility": "nuclear_reactor"}), "WORKSHOP_NOT_ENOUGH_MONEY"),
        (lambda client: client.post(SELECTION_URL, json={"facility": "csp_solar"}), "WORKSHOP_FACILITY_NOT_OFFERED"),
        (lambda client: client.delete(f"{SELECTION_URL}/coal_burner"), "WORKSHOP_NOT_SELECTED"),
    ],
    ids=["too expensive", "not offered", "not selected"],
)
def test_a_selection_change_the_rules_forbid_is_an_error(
    session_path: Path, clock: _Clock, request_selection: Callable[[TestClient], Response], error: str
) -> None:
    app, client, _, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "nuclear_reactor"})
    app.state.workshop_session.player(alice).money = 900_000.0

    response = request_selection(client)

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == error


def test_selecting_once_the_investment_timer_runs_out_is_an_error(session_path: Path, clock: _Clock) -> None:
    _, client, _, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    clock.tick(minutes=8)

    response = client.post(SELECTION_URL, json={"facility": "gas_burner"})

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "WORKSHOP_INVESTMENT_CLOSED"


def test_a_facilitator_has_no_selection(session_path: Path, clock: _Clock) -> None:
    _, client, _, _ = _investing(session_path, clock)

    assert client.get(SELECTION_URL).status_code == 403
    assert client.post(SELECTION_URL, json={"facility": "gas_burner"}).status_code == 403


def test_players_buy_their_own_selections_when_the_facilitator_advances(session_path: Path, clock: _Clock) -> None:
    _, client, facilitator, [alice, bob] = _investing(session_path, clock, "alice", "bob")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "gas_burner"})
    authenticate(client, bob)
    client.post(SELECTION_URL, json={"facility": "small_water_dam"})
    client.post(SELECTION_URL, json={"facility": "small_water_dam"})
    clock.tick(minutes=8)

    authenticate(client, facilitator)
    client.post(ADVANCE_URL)

    authenticate(client, alice)
    assert [owned["facility"] for owned in client.get(FLEET_URL).json()] == ["gas_burner"]
    assert client.get(SELECTION_URL).json() == {
        "facilities": [],
        "total_cost": 0.0,
        "money": 910_000.0,
        "stored_energy_at_risk": {},
    }
    authenticate(client, bob)
    assert [owned["facility"] for owned in client.get(FLEET_URL).json()] == ["small_water_dam", "small_water_dam"]
    assert client.get(SELECTION_URL).json()["money"] == 870_000.0


def test_selections_are_bought_as_soon_as_the_investment_timer_runs_out(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(workshop_app, "PHASE_CHECK_INTERVAL_SECONDS", 0.01)
    app, client, _, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "gas_burner"})

    # Entering the client runs the app's startup, which starts the purchase task.
    with client:
        clock.tick(minutes=8)
        _wait_for_fleet(client, size=1)

        assert [owned["facility"] for owned in client.get(FLEET_URL).json()] == ["gas_burner"]
        assert client.get(SESSION_URL).json()["checkpoint"] == _checkpoint("investment", 1)


def test_a_failed_notification_does_not_stop_later_purchases(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(workshop_app, "PHASE_CHECK_INTERVAL_SECONDS", 0.01)

    async def failing_invalidate(app: FastAPI) -> None:
        raise ConnectionError("the Socket.IO server is down")

    monkeypatch.setattr(workshop_app, "invalidate_session", failing_invalidate)
    _, client, facilitator, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "gas_burner"})

    with client:
        clock.tick(minutes=8)
        _wait_for_fleet(client, size=1)
        # On to Round 2's Investment phase: four Trading periods, the Recap, then Investment.
        authenticate(client, facilitator)
        for _ in range(6):
            _advance(client)
        authenticate(client, alice)
        client.post(SELECTION_URL, json={"facility": "small_water_dam"})
        clock.tick(minutes=8)
        _wait_for_fleet(client, size=2)

        assert [owned["facility"] for owned in client.get(FLEET_URL).json()] == ["gas_burner", "small_water_dam"]


def test_a_trading_period_settles_as_soon_as_its_price_setting_window_runs_out(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(workshop_app, "PHASE_CHECK_INTERVAL_SECONDS", 0.01)
    app, client, facilitator, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "gas_burner"})
    authenticate(client, facilitator)
    _advance(client)
    authenticate(client, alice)

    with client:
        clock.tick(minutes=5)
        deadline = time.monotonic() + 5
        while not client.get(LOCKED_PRICES_URL).json() and time.monotonic() < deadline:
            time.sleep(0.01)

        [result] = app.state.workshop_session.player(alice).trading_results
        assert (result.round, result.season) == (1, "spring")
        assert client.get(SELECTION_URL).json()["money"] == pytest.approx(910_000.0 + result.net)
        assert client.get(SESSION_URL).json()["checkpoint"] == _checkpoint("trading_period", 1, "spring")


def _wait_for_fleet(client: TestClient, *, size: int) -> None:
    """Wait up to five seconds for the signed-in player's fleet to reach ``size`` facilities."""
    deadline = time.monotonic() + 5
    while len(client.get(FLEET_URL).json()) < size and time.monotonic() < deadline:
        time.sleep(0.01)


# --- price setting (#1002) ------------------------------------------------------------------


def _trading(session_path: Path, clock: _Clock) -> tuple[TestClient, int, int]:
    """An app in Round 1's spring Trading period, its price-setting window open. Alice owns a gas burner.

    Returns a client left signed in as Alice, and the facilitator's and Alice's account ids.
    """
    app, client, facilitator, [alice] = _investing(session_path, clock, "alice")
    app.state.workshop_session.player(alice).owned_facilities.append(
        OwnedFacility(facility=FacilityId.GAS_BURNER, built_round=1)
    )
    _advance(client)
    authenticate(client, alice)
    return client, facilitator, alice


def test_a_player_reads_their_prices_and_the_price_floor(session_path: Path, clock: _Clock) -> None:
    client, _, _ = _trading(session_path, clock)

    response = client.get(PRICES_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["price_floor"] == -25.0
    assert body["sell"]["gas_burner"] == 500.0
    assert body["buy"] == {
        "lithium_ion_batteries": 425.0,
        "solid_state_batteries": 420.0,
        "hydrogen_storage": 230.0,
        "pumped_hydro": 205.0,
    }


def test_a_player_sets_a_price_while_the_window_is_open(session_path: Path, clock: _Clock) -> None:
    client, _, _ = _trading(session_path, clock)

    client.put(f"{PRICES_URL}/gas_burner/sell", json={"price": 80.0})
    response = client.put(f"{PRICES_URL}/lithium_ion_batteries/buy", json={"price": -25.0})

    assert response.status_code == 200
    assert response.json()["sell"]["gas_burner"] == 80.0
    assert response.json()["buy"]["lithium_ion_batteries"] == -25.0
    assert client.get(PRICES_URL).json() == response.json()


@pytest.mark.parametrize(
    ("url", "price", "error"),
    [
        (f"{PRICES_URL}/gas_burner/sell", -25.01, "WORKSHOP_PRICE_BELOW_FLOOR"),
        (f"{PRICES_URL}/gas_burner/buy", 10.0, "WORKSHOP_NOT_STORAGE"),
    ],
    ids=["below the floor", "buy price for a facility that is not storage"],
)
def test_a_price_the_rules_forbid_is_an_error(
    session_path: Path, clock: _Clock, url: str, price: float, error: str
) -> None:
    client, _, _ = _trading(session_path, clock)

    response = client.put(url, json={"price": price})

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == error


def test_a_price_must_be_given(session_path: Path, clock: _Clock) -> None:
    client, _, _ = _trading(session_path, clock)

    assert client.put(f"{PRICES_URL}/gas_burner/sell", json={"price": None}).status_code == 422
    assert client.put(f"{PRICES_URL}/gas_burner/sell", json={}).status_code == 422


def test_setting_a_price_once_the_window_runs_out_is_an_error(session_path: Path, clock: _Clock) -> None:
    client, _, _ = _trading(session_path, clock)
    clock.tick(minutes=5)

    response = client.put(f"{PRICES_URL}/gas_burner/sell", json={"price": 80.0})

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "WORKSHOP_PRICE_SETTING_CLOSED"


def test_a_completed_periods_prices_can_be_read_back(session_path: Path, clock: _Clock) -> None:
    client, facilitator, alice = _trading(session_path, clock)
    client.put(f"{PRICES_URL}/gas_burner/sell", json={"price": 80.0})
    assert client.get(LOCKED_PRICES_URL).json() == []

    authenticate(client, facilitator)
    _advance(client)

    authenticate(client, alice)
    assert client.get(LOCKED_PRICES_URL).json() == [
        {"round": 1, "season": "spring", "prices": {"sell": {"gas_burner": 80.0}, "buy": {}}}
    ]


def test_a_facilitator_has_no_prices(session_path: Path, clock: _Clock) -> None:
    client, facilitator, _ = _trading(session_path, clock)
    authenticate(client, facilitator)

    assert client.get(PRICES_URL).status_code == 403
    assert client.put(f"{PRICES_URL}/gas_burner/sell", json={"price": 80.0}).status_code == 403
    assert client.get(LOCKED_PRICES_URL).status_code == 403


# --- round format: full-season mode, clearings per day and storage (#1004) ------------------

LEVERS_URL = "/api/v1/workshop/levers"


def _levers(**round_format: object) -> dict:
    """The default levers, with the Round format given."""
    return {"investment_minutes": 8, "price_setting_minutes": 5, "round_format": round_format}


def test_the_facilitator_reads_and_changes_the_levers(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    round_format = {"trading_format": "full_season", "clearings_per_day": 96, "storage": "all"}

    assert client.get(LEVERS_URL).json()["round_format"]["trading_format"] == "representative_day"
    response = client.put(LEVERS_URL, json=_levers(**round_format))

    assert response.status_code == 200
    assert response.json() == _levers(**round_format)
    assert client.get(LEVERS_URL).json() == response.json()
    # Before Round 1 starts, the session shows the format it will start with.
    assert client.get(SESSION_URL).json()["round_format"] == round_format


@pytest.mark.parametrize(
    "round_format",
    [{"storage": "all"}, {"clearings_per_day": 48}, {"storage": "everything"}, {"no_such_lever": 1}],
    ids=["every storage type without the full-season format", "48 clearings", "unknown storage", "unknown lever"],
)
def test_levers_that_are_not_allowed_are_rejected(session_path: Path, round_format: dict) -> None:
    client = _client(session_path)
    _facilitator(client)

    assert client.put(LEVERS_URL, json=_levers(**round_format)).status_code == 422
    assert client.get(LEVERS_URL).json()["round_format"]["storage"] == "batteries"


def test_only_the_facilitator_sees_and_changes_the_levers(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    assert client.get(LEVERS_URL).status_code == 403
    assert client.put(LEVERS_URL, json=_levers(clearings_per_day=96)).status_code == 403


def test_the_facilities_on_offer_follow_the_rounds_storage_lever(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    client.put(LEVERS_URL, json=_levers(storage="off"))
    client.post(ADVANCE_URL)

    offered = {facility["id"] for facility in client.get(FACILITIES_URL).json()}
    assert "lithium_ion_batteries" not in offered

    client.put(LEVERS_URL, json=_levers(trading_format="full_season", storage="all"))
    assert "hydrogen_storage" not in {facility["id"] for facility in client.get(FACILITIES_URL).json()}
    while client.get(SESSION_URL).json()["checkpoint"] != _checkpoint("investment", 2):
        _advance(client)

    offered = {facility["id"] for facility in client.get(FACILITIES_URL).json()}
    assert {"lithium_ion_batteries", "hydrogen_storage", "pumped_hydro"} <= offered


def test_storage_a_player_owns_is_still_listed_once_it_is_no_longer_for_sale(session_path: Path, clock: _Clock) -> None:
    # Hydrogen storage lasts three Rounds, so Alice's still works in Round 2, when no storage is for sale.
    app, client, facilitator, [alice] = _investing(session_path, clock, "alice")
    app.state.workshop_session.player(alice).owned_facilities.append(
        OwnedFacility(facility=FacilityId.HYDROGEN_STORAGE, built_round=1)
    )
    client.put(LEVERS_URL, json=_levers(storage="off"))
    while client.get(SESSION_URL).json()["checkpoint"] != _checkpoint("investment", 2):
        _advance(client)

    authenticate(client, alice)
    facilities = {facility["id"]: facility["for_sale"] for facility in client.get(FACILITIES_URL).json()}
    assert facilities["hydrogen_storage"] is False
    assert facilities["gas_burner"] is True
    assert "lithium_ion_batteries" not in facilities
    authenticate(client, facilitator)
    assert "hydrogen_storage" not in {facility["id"] for facility in client.get(FACILITIES_URL).json()}


def test_advancing_while_the_investment_phase_is_open_closes_it_and_buys_the_selections(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(workshop_app, "PHASE_CHECK_INTERVAL_SECONDS", 0.01)
    _, client, facilitator, [alice] = _investing(session_path, clock, "alice")
    authenticate(client, alice)
    client.post(SELECTION_URL, json={"facility": "gas_burner"})

    with client:
        authenticate(client, facilitator)
        body = client.post(ADVANCE_URL).json()
        assert body["checkpoint"] == _checkpoint("investment", 1)
        assert body["phase_timer"]["remaining_seconds"] == 0

        authenticate(client, alice)
        _wait_for_fleet(client, size=1)
        assert [owned["facility"] for owned in client.get(FLEET_URL).json()] == ["gas_burner"]


#: Two combined cycles: enough to meet one player's must-serve demand, so the grid stays up (#1005).
GRID_KEEPING_FLEET = [OwnedFacility(facility=FacilityId.COMBINED_CYCLE, built_round=1)] * 2


def test_the_session_shows_the_simulation_running_and_cannot_advance_meanwhile(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(workshop_app, "PHASE_CHECK_INTERVAL_SECONDS", 0.01)
    release = threading.Event()
    real_simulate = session_module.simulate_trading_period

    def held_after_the_first_day(*args: Any, on_day_done: Callable[[int], None], **kwargs: Any) -> TradingOutcome:
        on_day_done(1)
        release.wait(timeout=5)
        return real_simulate(*args, on_day_done=on_day_done, **kwargs)

    monkeypatch.setattr(session_module, "simulate_trading_period", held_after_the_first_day)
    app, client, _, [alice] = _investing(session_path, clock, "alice")
    app.state.workshop_session.player(alice).owned_facilities.extend(GRID_KEEPING_FLEET)
    _advance(client)

    with client:
        clock.tick(minutes=5)
        deadline = time.monotonic() + 5
        while client.get(SESSION_URL).json()["settlement"] is None and time.monotonic() < deadline:
            time.sleep(0.01)

        assert client.get(SESSION_URL).json()["settlement"] == {"days_done": 1, "days_total": 1}
        response = client.post(ADVANCE_URL)
        assert response.status_code == 400
        assert response.json()["game_exception_type"] == "WORKSHOP_SETTLEMENT_RUNNING"

        release.set()
        deadline = time.monotonic() + 5
        while client.get(SESSION_URL).json()["settlement"] is not None and time.monotonic() < deadline:
            time.sleep(0.01)
        assert len(app.state.workshop_session.player(alice).trading_results) == 1
        assert client.post(ADVANCE_URL).json()["checkpoint"] == _checkpoint("trading_period", 1, "summer")


def test_advancing_before_the_window_runs_out_closes_it_and_the_period_settles_in_the_background(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, client, _, [alice] = _investing(session_path, clock, "alice")
    app.state.workshop_session.player(alice).owned_facilities.extend(GRID_KEEPING_FLEET)
    _advance(client)

    with client:
        body = client.post(ADVANCE_URL).json()
        assert body["checkpoint"] == _checkpoint("trading_period", 1, "spring")
        assert body["phase_timer"]["remaining_seconds"] == 0
        # The advance has the app check now, so this does not wait for the interval.
        deadline = time.monotonic() + 5
        while not app.state.workshop_session.player(alice).trading_results and time.monotonic() < deadline:
            time.sleep(0.01)

        assert len(app.state.workshop_session.player(alice).trading_results) == 1
        assert client.post(ADVANCE_URL).json()["checkpoint"] == _checkpoint("trading_period", 1, "summer")


# --- pushing changes to open pages ---------------------------------------------------------


def test_a_joined_player_and_the_facilitator_can_connect_a_socket(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")
    assert socket.is_admitted(socket.connect(client)[1])

    _facilitator(client)
    assert socket.is_admitted(socket.connect(client)[1])


def test_a_socket_without_a_session_is_refused(session_path: Path) -> None:
    _, answer = socket.connect(_client(session_path))

    assert answer == {"message": "NOT_AUTHENTICATED"}


def test_a_socket_for_an_account_that_has_not_joined_is_refused(session_path: Path) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    _, answer = socket.connect(client)

    assert answer == {"message": "INSTANCE_ACCESS_DENIED"}


def test_advancing_tells_every_open_page_to_reread_the_session(session_path: Path) -> None:
    # One client, so one event loop, serves every request: the server's queues belong to it.
    with TestClient(create_workshop_app(load_instance_config(), session_path=session_path)) as client:
        _player(client, "alice")
        player_sid, _ = socket.connect(client)
        _facilitator(client)
        facilitator_sid, _ = socket.connect(client)

        assert client.post(ADVANCE_URL).status_code == 200

        invalidate = ["invalidate", {"queries": [["workshop", "session"]]}]
        assert socket.poll(client, player_sid) == [invalidate]
        assert socket.poll(client, facilitator_sid) == [invalidate]


def _poll_until(client: TestClient, sid: str, event: str) -> list:
    """Every packet queued for ``sid`` up to and including the first ``event``."""
    packets: list = []
    deadline = time.monotonic() + 5
    while not any(packet[0] == event for packet in packets) and time.monotonic() < deadline:
        packets += socket.poll(client, sid)
    return packets


def test_a_running_simulation_tells_every_open_page_how_far_it_has_got(
    session_path: Path, clock: _Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(workshop_app, "PHASE_CHECK_INTERVAL_SECONDS", 0.01)
    release = threading.Event()
    real_simulate = session_module.simulate_trading_period

    def held_after_the_first_day(*args: Any, on_day_done: Callable[[int], None], **kwargs: Any) -> TradingOutcome:
        on_day_done(1)
        release.wait(timeout=5)
        return real_simulate(*args, on_day_done=on_day_done, **kwargs)

    monkeypatch.setattr(session_module, "simulate_trading_period", held_after_the_first_day)
    app, client, _, [alice] = _investing(session_path, clock, "alice")
    app.state.workshop_session.player(alice).owned_facilities.extend(GRID_KEEPING_FLEET)
    _advance(client)
    invalidate = ["invalidate", {"queries": [["workshop", "session"]]}]

    with client:
        facilitator_sid, _ = socket.connect(client)
        # Closes the price-setting window, so the period is simulated.
        client.post(ADVANCE_URL)

        # Starting the run re-reads the session. Each day after that only sends the progress.
        packets = _poll_until(client, facilitator_sid, "settlement_progress")
        assert packets[-1] == ["settlement_progress", {"days_done": 1, "days_total": 1}]
        assert packets[:-1] and all(packet == invalidate for packet in packets[:-1])

        release.set()
        # Finishing the run re-reads the session, which then has the period's results.
        assert _poll_until(client, facilitator_sid, "invalidate") == [invalidate]


def test_extending_tells_every_open_page_to_reread_the_session(session_path: Path) -> None:
    with TestClient(create_workshop_app(load_instance_config(), session_path=session_path)) as client:
        _player(client, "alice")
        player_sid, _ = socket.connect(client)
        _facilitator(client)
        client.post(ADVANCE_URL)
        socket.poll(client, player_sid)

        assert client.post(EXTEND_URL, json={"minutes": 1}).status_code == 200

        assert socket.poll(client, player_sid) == [["invalidate", {"queries": [["workshop", "session"]]}]]


# --- starting the backend -------------------------------------------------------------------


def test_instance_app_starts_workshop_without_the_persistent_world(session_path: Path, tmp_path: Path) -> None:
    """``main.py`` builds its app with ``create_instance_app``. For a Workshop Run that must give the
    Workshop app and never import ``energetica.freeplay``, whose import builds the persistent
    world's game engine.
    """
    code = (
        "import json, sys\n"
        "from energetica.entry import create_instance_app\n"
        "app = create_instance_app(env='dev')\n"
        "paths = sorted(getattr(route, 'path', '') for route in app.routes)\n"
        "loaded = sorted(m for m in sys.modules if m.startswith('energetica.freeplay'))\n"
        "print(json.dumps({'paths': paths, 'freeplay': loaded}))\n"
    )
    env = {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(filter(None, [str(_REPO_ROOT / "src"), os.environ.get("PYTHONPATH")])),
    }
    result = subprocess.run(
        [sys.executable, "-c", code], cwd=tmp_path, env=env, capture_output=True, text=True, check=True
    )
    output = json.loads(result.stdout.strip().splitlines()[-1])

    assert output["freeplay"] == []
    assert SESSION_URL in output["paths"]
