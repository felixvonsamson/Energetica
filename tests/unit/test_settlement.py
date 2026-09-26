"""Unit tests for the pure settlement of a market clearing (#1097).

Like the clearing tests, these build entries with no ``Player``, no DB and no engine: settlement is a
function of a :class:`MarketClearing` and the length of a tick.
"""

from __future__ import annotations

import pytest

from energetica.sim.market import MIN_PRICE, MarketEntry, clear_market
from energetica.sim.settlement import MIN_SETTLED_QUANTITY, energy_value, settle_clearing

SECONDS_PER_TICK = 3600  # one hour, so 1 MW at 1 per MWh is exactly 1e-6 in the value's units


def _offer(capacity: float, price: float, player_id: int = 1, facility: str = "plant") -> MarketEntry:
    return MarketEntry(player_id, capacity, price, facility)


def _demand(capacity: float, price: float, player_id: int = 2, facility: str = "load") -> MarketEntry:
    return MarketEntry(player_id, capacity, price, facility)


def test_energy_value_scales_with_quantity_price_and_tick_length() -> None:
    assert energy_value(10, 50, 3600) == pytest.approx(10 * 50 / 1_000_000)
    assert energy_value(10, 50, 1800) == pytest.approx(10 * 50 / 2 / 1_000_000)
    assert energy_value(10, -5, 3600) == pytest.approx(-10 * 5 / 1_000_000)


def test_offers_that_cleared_in_full_sell_their_whole_capacity() -> None:
    clearing = clear_market([_offer(100, 10), _offer(100, 50, facility="peaker")], [_demand(150, 80)])

    settlement = settle_clearing(clearing, SECONDS_PER_TICK)

    cheap, marginal = settlement.sales
    assert (cheap.facility, cheap.quantity) == ("plant", 100)
    assert cheap.revenue == pytest.approx(energy_value(100, clearing.price, SECONDS_PER_TICK))
    assert cheap.counts_as_generation
    assert cheap.dumped is None
    # The marginal offer sells the part that cleared, and nothing else is settled after it.
    assert (marginal.facility, marginal.quantity) == ("peaker", 50)


def test_nothing_sells_after_the_marginal_offer() -> None:
    clearing = clear_market([_offer(100, 10), _offer(100, 50), _offer(100, 90, facility="never")], [_demand(150, 80)])

    settlement = settle_clearing(clearing, SECONDS_PER_TICK)

    assert [sale.facility for sale in settlement.sales] == ["plant", "plant"]


def test_a_partial_sale_below_the_cutoff_trades_nothing() -> None:
    clearing = clear_market([_offer(100, 10), _offer(100, 50)], [_demand(100 + MIN_SETTLED_QUANTITY / 2, 80)])

    _, marginal = settle_clearing(clearing, SECONDS_PER_TICK).sales

    assert marginal.quantity == 0
    assert marginal.revenue == 0


def test_unsold_must_run_power_is_dumped_and_billed_at_the_price_floor() -> None:
    clearing = clear_market([_offer(60, MIN_PRICE, facility="wind")], [_demand(30, 100)])

    (sale,) = settle_clearing(clearing, SECONDS_PER_TICK).sales

    assert sale.quantity == 30
    assert not sale.counts_as_generation
    assert sale.dumped == 30
    assert sale.dump_cost == pytest.approx(energy_value(30, -MIN_PRICE, SECONDS_PER_TICK))
    assert sale.dump_cost > 0


def test_settlement_continues_past_a_must_run_offer_that_did_not_clear() -> None:
    """A must-run offer beyond the cleared quantity dumps and settlement carries on to the next offer."""
    clearing = clear_market(
        [_offer(60, MIN_PRICE, facility="wind"), _offer(40, MIN_PRICE, player_id=3, facility="solar")],
        [_demand(70, 100)],
    )

    wind, solar = settle_clearing(clearing, SECONDS_PER_TICK).sales

    assert (wind.quantity, wind.dumped) == (60, None)
    assert (solar.quantity, solar.dumped) == (10, 30)


def test_fully_served_demand_reports_no_shortfall() -> None:
    clearing = clear_market([_offer(100, 10)], [_demand(80, 90)])

    (purchase,) = settle_clearing(clearing, SECONDS_PER_TICK).purchases

    assert purchase.quantity == 80
    assert purchase.served is None
    assert purchase.cost == pytest.approx(energy_value(80, clearing.price, SECONDS_PER_TICK))


def test_unserved_demand_reports_how_much_it_received() -> None:
    clearing = clear_market([_offer(100, 10)], [_demand(80, 90), _demand(60, 50, player_id=4, facility="lab")])

    served, unserved = settle_clearing(clearing, SECONDS_PER_TICK).purchases

    assert served.served is None
    assert unserved.player_id == 4
    assert unserved.quantity == 20
    assert unserved.served == 20


def test_demand_priced_below_the_market_is_curtailed_to_zero() -> None:
    clearing = clear_market([_offer(100, 30)], [_demand(40, 10)])

    (purchase,) = settle_clearing(clearing, SECONDS_PER_TICK).purchases

    assert purchase.quantity == 0
    assert purchase.cost == 0
    assert purchase.served == 0


def test_an_empty_market_settles_to_nothing() -> None:
    settlement = settle_clearing(clear_market([], []), SECONDS_PER_TICK)

    assert settlement.sales == []
    assert settlement.purchases == []
