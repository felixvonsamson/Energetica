"""Unit tests for the control room in a running Workshop session (#1289): what it reads, and when."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.control_room import HISTORY_SEASONS, PowerSource
from energetica.workshop.facilities import FacilityId, Fuel
from energetica.workshop.fuel import CATALOG_FUEL_PRICES
from energetica.workshop.round_plan import LeverChanges
from energetica.workshop.session import Investment, TradingPeriod, WorkshopSession

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)


class _Clock:
    """A clock that never moves: every window stays open until the facilitator closes it."""

    def __call__(self) -> datetime:
        return datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)


def _open(path: Path, round_count: int = 3) -> WorkshopSession:
    return WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=_Clock())


def _investing(path: Path, round_count: int = 3) -> WorkshopSession:
    """A session in Round 1's Investment phase, in which one player picks enough coal burners and a wind turbine to
    keep the lights on.
    """
    session = _open(path, round_count)
    account = Account(account_id=1, username="p1", pwhash="hash", email=None, created_at="")
    session.join(account).money = 1_000_000_000.0
    session.advance()
    for _ in range(6):
        session.select(1, FacilityId.COAL_BURNER)
    session.select(1, FacilityId.ONSHORE_WIND_TURBINE)
    return session


def _settle_next(session: WorkshopSession) -> None:
    """Advance to the next Trading period and settle it, as the facilitator and the app do."""
    session.advance()
    while not isinstance(session.checkpoint, TradingPeriod):
        session.advance()
    session.advance()
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))


def test_a_session_that_has_not_started_shows_only_the_fuel_catalog_prices(tmp_path: Path) -> None:
    room = _open(tmp_path / "session.json").control_room()

    assert room.alarms == []
    assert room.emissions == []
    assert room.seasons == []
    assert room.duration_curve is None
    assert room.room_prices == []
    assert [(fuel.fuel, fuel.price, fuel.change) for fuel in room.fuels] == [
        (fuel, CATALOG_FUEL_PRICES[fuel], None) for fuel in Fuel
    ]
    assert not room.carbon_tax.vote_open
    assert room.carbon_tax.since is None


def test_a_settled_season_shows_its_prices_generation_and_duration_curve(tmp_path: Path) -> None:
    session = _investing(tmp_path / "session.json")
    _settle_next(session)

    room = session.control_room()

    [spring] = room.seasons
    assert (spring.round, spring.season) == (1, "spring")
    assert spring.average_price is not None
    assert spring.price_low is not None and spring.price_high is not None
    assert spring.price_low <= spring.price_high
    assert spring.generation[PowerSource.COAL] > 0
    assert spring.generation[PowerSource.WIND] > 0
    assert room.duration_curve is not None
    assert (room.duration_curve.round, room.duration_curve.season) == (1, "spring")
    assert room.duration_curve.prices == sorted(room.duration_curve.prices, reverse=True)
    [prices] = room.room_prices
    assert (prices.round, prices.season, prices.live) == (1, "spring", False)
    assert set(prices.boxes) == {"coal", "wind"}
    [round_one] = room.emissions
    assert round_one.emissions > 0
    assert not round_one.complete


def test_the_open_price_setting_window_shows_live_prices(tmp_path: Path) -> None:
    session = _investing(tmp_path / "session.json")
    session.advance()  # Close the Investment phase.
    session.advance()  # Spring opens.
    session.set_price(1, FacilityId.COAL_BURNER, "sell", 80.0)

    [prices] = session.control_room().room_prices

    assert (prices.round, prices.season, prices.live) == (1, "spring", True)
    assert prices.boxes["coal"].median == 80.0


def test_the_summaries_of_settled_seasons_are_read_back_from_their_records_after_a_restart(tmp_path: Path) -> None:
    path = tmp_path / "session.json"
    session = _investing(path)
    _settle_next(session)
    before = session.control_room()

    after = _open(path).control_room()

    assert after.seasons == before.seasons
    assert after.duration_curve == before.duration_curve


@pytest.mark.usefixtures("no_demand_growth")
def test_charts_over_seasons_show_at_most_the_last_eight(tmp_path: Path) -> None:
    session = _investing(tmp_path / "session.json")
    for _ in range(HISTORY_SEASONS + 1):
        _settle_next(session)

    room = session.control_room()

    assert [(season.round, season.season) for season in room.seasons][0] == (1, "summer")
    assert len(room.seasons) == HISTORY_SEASONS
    assert len(room.room_prices) == HISTORY_SEASONS
    assert room.room_prices[-1].season == "spring"
    assert [emissions.complete for emissions in room.emissions] == [True, True, False]


def test_an_open_vote_shows_in_the_carbon_tax_status_and_the_alarms(tmp_path: Path) -> None:
    session = _investing(tmp_path / "session.json")
    session.set_levers(2, LeverChanges(carbon_tax_vote=True))
    while session.checkpoint != Investment(round=2):
        if isinstance(session.checkpoint, TradingPeriod) and session.settled_period != session.checkpoint:
            session.advance()
            job = session.start_settlement()
            assert job is not None
            session.finish_settlement(job, session.run_settlement(job))
        session.advance()

    room = session.control_room()

    assert room.carbon_tax.vote_open
    assert room.alarms[0].kind == "vote"
    assert [emissions.complete for emissions in room.emissions] == [True, False]
