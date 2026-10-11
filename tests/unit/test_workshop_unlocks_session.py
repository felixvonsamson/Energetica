"""Unit tests for tech-grade unlocks in a Workshop session (#1011): spend on a base tier unlocking its upgrade from
the next Round, Concentrated solar power's Round gate, and the storage lever's unlock of full-season storage.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop.facilities import FacilityId
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.session import (
    Investment,
    Recap,
    RoundLevers,
    StorageLeverLockedError,
    TradingPeriod,
    WorkshopSession,
)
from energetica.workshop.unlocks import Unlock

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)

# With two players, the threshold is one starting budget: 1,000,000. One nuclear reactor costs 840,000, so two
# cross it and one does not.
PLAYERS = 2


class _Clock:
    """A clock that never moves: every window stays open until the moderator closes it."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "session.json"


def _session(path: Path, *, round_count: int = 3) -> WorkshopSession:
    """A session in Round 1's Investment phase, with two players who each hold plenty of money."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, round_count=round_count, clock=_Clock())
    for account_id in range(1, PLAYERS + 1):
        account = Account(account_id=account_id, username=f"p{account_id}", pwhash="hash", email=None, created_at="")
        session.join(account).money = 10_000_000.0
    session.advance()
    return session


def _to_next(session: WorkshopSession, kind: type) -> None:
    """Advance as the moderator does, settling each Trading period, until the session is at the next ``kind``."""
    start = session.checkpoint
    while True:
        if isinstance(session.checkpoint, TradingPeriod):
            session.advance()  # close the price-setting window
            job = session.start_settlement()
            if job is not None:
                session.finish_settlement(job, session.run_settlement(job))
        session.advance()
        if isinstance(session.checkpoint, kind) and session.checkpoint != start:
            return


def _offered(session: WorkshopSession) -> set[FacilityId]:
    return {facility.id for facility in session.offered_facilities()}


def test_an_upgrade_unlocks_from_the_next_round_once_the_room_has_spent_enough_on_its_base_tier(path: Path) -> None:
    session = _session(path)
    session.select(1, FacilityId.NUCLEAR_REACTOR)
    session.select(2, FacilityId.NUCLEAR_REACTOR)

    _to_next(session, Recap)

    assert FacilityId.NUCLEAR_REACTOR_GEN4 not in _offered(session)
    assert session.unlocks == [
        Unlock(facility=FacilityId.NUCLEAR_REACTOR_GEN4, round=2, trigger="investment_threshold")
    ]
    _to_next(session, Investment)
    assert FacilityId.NUCLEAR_REACTOR_GEN4 in _offered(session)


def test_spend_below_the_threshold_unlocks_nothing(path: Path) -> None:
    session = _session(path)
    session.select(1, FacilityId.NUCLEAR_REACTOR)

    _to_next(session, Investment)

    assert session.unlocks == []
    assert FacilityId.NUCLEAR_REACTOR_GEN4 not in _offered(session)


def test_spend_carries_over_from_round_to_round(path: Path) -> None:
    session = _session(path)
    session.select(1, FacilityId.NUCLEAR_REACTOR)
    _to_next(session, Investment)
    session.select(2, FacilityId.NUCLEAR_REACTOR)

    _to_next(session, Investment)

    assert Unlock(facility=FacilityId.NUCLEAR_REACTOR_GEN4, round=3, trigger="investment_threshold") in session.unlocks


def test_unlocks_survive_a_restart(path: Path) -> None:
    session = _session(path)
    session.select(1, FacilityId.NUCLEAR_REACTOR)
    session.select(2, FacilityId.NUCLEAR_REACTOR)
    _to_next(session, Investment)

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path)

    assert reopened.unlocks == session.unlocks
    assert FacilityId.NUCLEAR_REACTOR_GEN4 in _offered(reopened)


def test_concentrated_solar_power_unlocks_from_round_three(path: Path) -> None:
    session = _session(path)
    _to_next(session, Investment)
    assert FacilityId.CSP_SOLAR not in _offered(session)

    _to_next(session, Investment)

    assert session.unlocks == [Unlock(facility=FacilityId.CSP_SOLAR, round=3, trigger="round_gate")]
    assert FacilityId.CSP_SOLAR in _offered(session)


def test_the_last_rounds_end_unlocks_nothing(path: Path) -> None:
    session = _session(path, round_count=1)
    session.select(1, FacilityId.NUCLEAR_REACTOR)
    session.select(2, FacilityId.NUCLEAR_REACTOR)

    _to_next(session, Recap)

    assert session.unlocks == []


def test_full_season_storage_unlocks_at_the_recap_before_the_first_round_to_allow_every_storage_type(
    path: Path,
) -> None:
    session = _session(path)
    session.set_levers(RoundLevers(round_format=RoundFormat(trading_format="full_season", storage="all")))

    _to_next(session, Recap)

    assert session.unlocks == [
        Unlock(facility=FacilityId.HYDROGEN_STORAGE, round=2, trigger="format_lever"),
        Unlock(facility=FacilityId.PUMPED_HYDRO, round=2, trigger="format_lever"),
    ]
    assert not {FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO} & _offered(session)


def test_full_season_storage_set_during_the_recap_unlocks_when_the_round_starts(path: Path) -> None:
    session = _session(path)
    _to_next(session, Recap)
    session.set_levers(RoundLevers(round_format=RoundFormat(trading_format="full_season", storage="all")))

    session.advance()

    assert session.unlocks == [
        Unlock(facility=FacilityId.HYDROGEN_STORAGE, round=2, trigger="format_lever"),
        Unlock(facility=FacilityId.PUMPED_HYDRO, round=2, trigger="format_lever"),
    ]
    assert {FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO} <= _offered(session)


def _full_season() -> RoundLevers:
    return RoundLevers(round_format=RoundFormat(trading_format="full_season", storage="all"))


def test_the_storage_lever_cannot_be_switched_back_once_the_recap_announced_full_season_storage(path: Path) -> None:
    session = _session(path)
    session.set_levers(_full_season())
    _to_next(session, Recap)

    with pytest.raises(StorageLeverLockedError):
        session.set_levers(RoundLevers())

    assert session.levers == _full_season()
    # Other levers can still change.
    session.set_levers(_full_season().model_copy(update={"fuel_procurement": "manual"}))


def test_the_storage_lever_can_be_switched_back_before_the_recap_announces_anything(path: Path) -> None:
    session = _session(path)
    session.set_levers(_full_season())

    session.set_levers(RoundLevers())

    assert session.levers == RoundLevers()


def test_the_storage_lever_is_free_again_once_the_announced_round_has_started(path: Path) -> None:
    session = _session(path)
    session.set_levers(_full_season())
    _to_next(session, Recap)
    session.advance()

    session.set_levers(RoundLevers())

    assert session.levers == RoundLevers()
