"""Unit tests for buying fuel in a Workshop session (#1009): the procurement lever, each season's prices, the
quantities a player orders in the price-setting window, and what settling a Trading period charges for fuel.
"""

from __future__ import annotations

import math

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from energetica.identity.accounts import Account
from energetica.identity.instance_config import InstanceConfig
from energetica.workshop import session as session_module
from energetica.workshop.facilities import FacilityId, Fuel
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, STOCKPILE_SEASONS, FuelPurchase, season_need
from energetica.workshop.session import (
    FuelNotBurnedError,
    FuelNotManualError,
    InvalidFuelQuantityError,
    PriceSettingClosedError,
    RoundLevers,
    TradingPeriod,
    WorkshopSession,
)

WORKSHOP_CONFIG = InstanceConfig.model_validate(
    {
        "name": "Workshop",
        "advertised": False,
        "starts_at": "2026-03-01T00:00:00Z",
        "run": {"mode": "workshop"},
    }
)

GAS = FacilityId.GAS_BURNER


class _Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def path(tmp_path: Path) -> Path:
    return tmp_path / "session.json"


def _account(account_id: int, username: str) -> Account:
    return Account(account_id=account_id, username=username, pwhash="hash", email=None, created_at="")


def _settle(session: WorkshopSession) -> None:
    job = session.start_settlement()
    assert job is not None
    session.finish_settlement(job, session.run_settlement(job))


def _close_and_settle(session: WorkshopSession) -> None:
    """Close the price-setting window and settle the Trading period."""
    session.advance()
    _settle(session)


# Enough to meet the demand block's must-serve tier on its own, so that no Trading period ends in a blackout.
_FLEET = (GAS,) * 6


def _trading(path: Path, *, manual: bool = True, facilities: tuple[FacilityId, ...] = _FLEET) -> WorkshopSession:
    """A session in Round 1's spring price-setting window, with Alice (account 1) owning ``facilities``."""
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    session.join(_account(1, "alice")).money = 10_000_000_000.0
    session.set_levers(RoundLevers(fuel_procurement="manual" if manual else "automatic"))
    session.advance()
    for facility in facilities:
        session.select(1, facility)
    session.advance()  # closes the Investment phase
    session.advance()  # into spring
    assert session.checkpoint == TradingPeriod(round=1, season="spring")
    return session


def _need(session: WorkshopSession, fuel: Fuel = Fuel.GAS) -> float:
    return season_need(fuel, session.network.members[1].owned_facilities, current_round=1)


def _whole_tonnes(kg: float) -> float:
    """``kg`` rounded up to whole tonnes, as a default order of coal or gas is."""
    return math.ceil(kg / 1_000) * 1_000.0


# --- the lever and the prices -----------------------------------------------------------------------


def test_fuel_procurement_is_automatic_unless_the_moderator_turns_on_manual() -> None:
    assert RoundLevers().fuel_procurement == "automatic"


def test_a_trading_period_fixes_the_procurement_lever_when_it_opens(path: Path) -> None:
    session = _trading(path, manual=False)

    session.set_levers(RoundLevers(fuel_procurement="manual"))

    assert session.fuel_procurement == "automatic"
    _close_and_settle(session)
    session.advance()
    assert session.fuel_procurement == "manual"


def test_no_fuel_has_a_price_before_the_first_trading_period(path: Path) -> None:
    session = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())
    session.advance()

    assert session.fuel_prices == {}


def test_every_fuel_gets_a_new_price_each_trading_period(path: Path) -> None:
    session = _trading(path)
    spring = dict(session.fuel_prices)

    _close_and_settle(session)
    session.advance()

    assert set(spring) == set(Fuel)
    assert session.fuel_prices[Fuel.GAS].previous_price == spring[Fuel.GAS].price
    assert session.fuel_prices[Fuel.GAS].price != spring[Fuel.GAS].price


def test_a_scheduled_shock_lands_at_the_next_trading_period_only(path: Path) -> None:
    session = _trading(path)

    session.schedule_fuel_shock(Fuel.GAS, 1.65)

    assert not session.fuel_prices[Fuel.GAS].shocked
    _close_and_settle(session)
    session.advance()
    assert session.fuel_prices[Fuel.GAS].shocked
    assert session.fuel_prices[Fuel.GAS].shock == 1.65
    assert not session.fuel_prices[Fuel.COAL].shocked
    _close_and_settle(session)
    session.advance()
    assert not session.fuel_prices[Fuel.GAS].shocked
    assert session.fuel_prices[Fuel.GAS].shock == pytest.approx(1.325)


def test_a_shock_must_keep_the_price_positive(path: Path) -> None:
    session = _trading(path)

    with pytest.raises(ValueError):
        session.schedule_fuel_shock(Fuel.GAS, -1.0)


# --- ordering -----------------------------------------------------------------------------------


def test_the_first_window_orders_a_season_at_full_output(path: Path) -> None:
    session = _trading(path, facilities=(GAS, GAS))

    assert session.network.members[1].fuel_order == {Fuel.GAS: _whole_tonnes(_need(session))}


def test_automatic_procurement_orders_nothing(path: Path) -> None:
    session = _trading(path, manual=False)

    assert session.network.members[1].fuel_order == {}


def test_a_player_orders_only_the_fuels_their_facilities_burn(path: Path) -> None:
    session = _trading(path, facilities=(GAS, FacilityId.SMALL_WATER_DAM))

    assert set(session.network.members[1].fuel_order) == {Fuel.GAS}
    with pytest.raises(FuelNotBurnedError):
        session.set_fuel_order(1, Fuel.COAL, 100.0)


def test_a_player_changes_their_order_during_the_window(path: Path) -> None:
    session = _trading(path)

    assert session.set_fuel_order(1, Fuel.GAS, 1_000.0) == 1_000.0

    assert session.network.members[1].fuel_order == {Fuel.GAS: 1_000.0}


def test_an_order_is_capped_by_the_stockpile_limit(path: Path) -> None:
    session = _trading(path)

    quantity = session.set_fuel_order(1, Fuel.GAS, 1e15)

    assert quantity == pytest.approx(STOCKPILE_SEASONS * _need(session))
    assert session.network.members[1].fuel_order[Fuel.GAS] == quantity


@pytest.mark.parametrize("quantity", [-1.0, float("nan"), float("inf")])
def test_an_order_must_be_a_quantity(path: Path, quantity: float) -> None:
    session = _trading(path)

    with pytest.raises(InvalidFuelQuantityError):
        session.set_fuel_order(1, Fuel.GAS, quantity)


def test_ordering_needs_manual_procurement(path: Path) -> None:
    session = _trading(path, manual=False)

    with pytest.raises(FuelNotManualError):
        session.set_fuel_order(1, Fuel.GAS, 100.0)


def test_ordering_after_the_window_closes_is_rejected(path: Path) -> None:
    session = _trading(path)
    session.advance()

    with pytest.raises(PriceSettingClosedError):
        session.set_fuel_order(1, Fuel.GAS, 100.0)


def test_a_failed_save_undoes_the_order(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _trading(path)
    before = dict(session.network.members[1].fuel_order)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.set_fuel_order(1, Fuel.GAS, 5.0)

    assert session.network.members[1].fuel_order == before


def _failing_write(path: Path, text: str) -> None:
    raise OSError("disk full")


# --- paying for fuel ----------------------------------------------------------------------------


def test_settling_pays_for_the_order_at_the_seasons_price(path: Path) -> None:
    session = _trading(path)
    # More than a season burns, so none of it is a shortfall.
    order = session.set_fuel_order(1, Fuel.GAS, 2 * _need(session))
    price = session.fuel_prices[Fuel.GAS].price
    alice = session.network.members[1]
    money = alice.money

    _close_and_settle(session)

    result = alice.trading_results[-1]
    assert result.fuel == [FuelPurchase(fuel=Fuel.GAS, quantity=order, price=price)]
    assert alice.money == pytest.approx(money + result.net)
    assert result.net == pytest.approx(sum(p.net for p in result.facilities.values()) - order * price)


def test_fuel_left_over_carries_into_the_stock(path: Path) -> None:
    session = _trading(path)
    order = 3 * _need(session)
    session.set_fuel_order(1, Fuel.GAS, order)

    _close_and_settle(session)

    alice = session.network.members[1]
    burned = alice.trading_results[-1].facilities[GAS].fuel_burned
    assert alice.fuel_stock == {Fuel.GAS: pytest.approx(order - burned)}


def test_burning_more_than_the_stock_and_order_is_paid_for_and_leaves_none(path: Path) -> None:
    # Until a short stock limits generation (#1010), ordering too little must not make fuel free.
    session = _trading(path)
    session.set_fuel_order(1, Fuel.GAS, 1_000.0)
    price = session.fuel_prices[Fuel.GAS].price

    _close_and_settle(session)

    alice = session.network.members[1]
    burned = alice.trading_results[-1].facilities[GAS].fuel_burned
    [purchase] = alice.trading_results[-1].fuel
    assert (purchase.quantity, purchase.price) == (pytest.approx(burned), price)
    assert alice.fuel_stock == {}


def test_a_period_opened_before_fuel_had_prices_settles_at_the_catalog_price(path: Path) -> None:
    session = _trading(path, manual=False)
    session.fuel_prices = {}
    session.fuel_procurement = None

    _close_and_settle(session)

    [purchase] = session.network.members[1].trading_results[-1].fuel
    assert purchase.price == CATALOG_FUEL_PRICES[Fuel.GAS]


def test_the_next_window_repeats_the_last_order(path: Path) -> None:
    session = _trading(path)
    session.set_fuel_order(1, Fuel.GAS, 1_000.0)

    _close_and_settle(session)
    session.advance()

    assert session.network.members[1].fuel_order == {Fuel.GAS: 1_000.0}


def test_the_next_windows_default_is_capped_by_the_stock(path: Path) -> None:
    session = _trading(path)
    alice = session.network.members[1]
    session.set_fuel_order(1, Fuel.GAS, 3 * _need(session))

    _close_and_settle(session)
    session.advance()

    assert alice.fuel_order[Fuel.GAS] == pytest.approx(3 * _need(session) - alice.fuel_stock[Fuel.GAS])


def test_automatic_procurement_pays_for_what_was_burned(path: Path) -> None:
    session = _trading(path, manual=False)
    price = session.fuel_prices[Fuel.GAS].price

    _close_and_settle(session)

    result = session.network.members[1].trading_results[-1]
    burned = result.facilities[GAS].fuel_burned
    assert burned > 0
    [purchase] = result.fuel
    assert (purchase.fuel, purchase.quantity, purchase.price) == (Fuel.GAS, pytest.approx(burned), price)


def test_automatic_procurement_burns_the_stock_first(path: Path) -> None:
    session = _trading(path, manual=False)
    alice = session.network.members[1]
    alice.fuel_stock = {Fuel.GAS: 1_000.0}

    _close_and_settle(session)

    burned = alice.trading_results[-1].facilities[GAS].fuel_burned
    assert alice.fuel_stock == {}
    assert alice.trading_results[-1].fuel[0].quantity == pytest.approx(burned - 1_000.0)


def test_automatic_procurement_pays_nothing_when_the_stock_covers_it(path: Path) -> None:
    session = _trading(path, manual=False)
    alice = session.network.members[1]
    alice.fuel_stock = {Fuel.GAS: 1e15}

    _close_and_settle(session)

    burned = alice.trading_results[-1].facilities[GAS].fuel_burned
    assert alice.trading_results[-1].fuel == []
    assert alice.fuel_stock == {Fuel.GAS: pytest.approx(1e15 - burned)}


def test_a_failed_save_undoes_the_fuel_payment(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _trading(path)
    session.advance()
    alice = session.network.members[1]
    money = alice.money
    job = session.start_settlement()
    assert job is not None
    outcome = session.run_settlement(job)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.finish_settlement(job, outcome)

    assert (alice.money, alice.fuel_stock, alice.trading_results) == (money, {}, [])


# --- saving -------------------------------------------------------------------------------------


def test_fuel_survives_a_restart(path: Path) -> None:
    session = _trading(path)
    session.set_fuel_order(1, Fuel.GAS, 3 * _need(session))
    _close_and_settle(session)
    session.advance()
    session.schedule_fuel_shock(Fuel.COAL, 2.0)
    alice = session.network.members[1]

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())

    again = reopened.network.members[1]
    assert (again.fuel_stock, again.fuel_order) == (alice.fuel_stock, alice.fuel_order)
    assert reopened.fuel_prices == session.fuel_prices
    assert reopened.fuel_procurement == "manual"
    assert reopened.pending_fuel_shocks == {Fuel.COAL: 2.0}
    assert again.trading_results == alice.trading_results


def test_a_session_saved_before_fuel_existed_still_opens(path: Path) -> None:
    session = _trading(path)
    saved = json.loads(path.read_text())
    for key in ("fuel_procurement", "fuel_prices", "pending_fuel_shocks"):
        del saved[key]
    del saved["levers"]["fuel_procurement"]
    for player in saved["players"]:
        del player["fuel_stock"], player["fuel_order"]
    path.write_text(json.dumps(saved))

    reopened = WorkshopSession.open(WORKSHOP_CONFIG, path, clock=_Clock())

    assert reopened.fuel_prices == {}
    assert reopened.network.members[1].fuel_stock == {}
    assert session.network.members[1].owned_facilities == reopened.network.members[1].owned_facilities


def test_a_failed_save_leaves_the_prices_as_they_were(path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    session = _trading(path)
    _close_and_settle(session)
    prices, order = dict(session.fuel_prices), dict(session.network.members[1].fuel_order)
    session.schedule_fuel_shock(Fuel.GAS, 2.0)
    monkeypatch.setattr(session_module, "write_atomically", _failing_write)

    with pytest.raises(OSError):
        session.advance()

    assert session.fuel_prices == prices
    assert session.network.members[1].fuel_order == order
    assert session.pending_fuel_shocks == {Fuel.GAS: 2.0}
    assert session.checkpoint == TradingPeriod(round=1, season="spring")


def test_each_fuel_the_fleet_burns_gets_its_own_default(path: Path) -> None:
    session = _trading(path, facilities=(GAS, FacilityId.COAL_BURNER))

    alice = session.network.members[1]
    assert OwnedFacility(facility=FacilityId.COAL_BURNER, built_round=1) in alice.owned_facilities
    assert alice.fuel_order == {
        Fuel.GAS: _whole_tonnes(_need(session)),
        Fuel.COAL: _whole_tonnes(_need(session, Fuel.COAL)),
    }
