"""Unit tests for the pure settlement of a market clearing (#1097).

Like the clearing tests, these build entries with no ``Player``, no DB and no engine: settlement is a
function of a :class:`MarketClearing` and the length of a tick.
"""

from __future__ import annotations

import pytest

from energetica.sim.market import MarketEntry, clear_market
from energetica.sim.settlement import MIN_SETTLED_QUANTITY, energy_value, settle_clearing

SECONDS_PER_TICK = 3600  # one hour, so 1 MW at 1 per MWh is exactly 1e-6 in the value's units
FLOOR = -5  # a price floor, as the persistent world uses
DUMP_COST = 5  # per MWh


def _offer(
    capacity: float, price: float, player_id: int = 1, facility: str = "plant", *, must_run: bool = False
) -> MarketEntry:
    return MarketEntry(player_id, capacity, price, facility, must_run=must_run)


def _demand(capacity: float, price: float, player_id: int = 2, facility: str = "load") -> MarketEntry:
    return MarketEntry(player_id, capacity, price, facility)


def test_energy_value_scales_with_quantity_price_and_tick_length() -> None:
    assert energy_value(10, 50, 3600) == pytest.approx(10 * 50 / 1_000_000)
    assert energy_value(10, 50, 1800) == pytest.approx(10 * 50 / 2 / 1_000_000)
    assert energy_value(10, -5, 3600) == pytest.approx(-10 * 5 / 1_000_000)


def test_offers_that_cleared_in_full_sell_their_whole_capacity() -> None:
    clearing = clear_market([_offer(100, 10), _offer(100, 50, facility="peaker")], [_demand(150, 80)])

    settlement = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST)

    cheap, marginal = settlement.sales
    assert (cheap.facility, cheap.power_sold) == ("plant", 100)
    assert cheap.revenue == pytest.approx(energy_value(100, clearing.price, SECONDS_PER_TICK))
    assert cheap.power_produced == 100
    assert cheap.power_dumped == 0
    # The marginal offer sells the part that cleared, and nothing else is settled after it.
    assert (marginal.facility, marginal.power_sold, marginal.power_produced) == ("peaker", 50, 50)


def test_nothing_sells_after_the_marginal_offer() -> None:
    clearing = clear_market([_offer(100, 10), _offer(100, 50), _offer(100, 90, facility="never")], [_demand(150, 80)])

    settlement = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST)

    assert [sale.facility for sale in settlement.sales] == ["plant", "plant"]


def test_a_partial_sale_below_the_cutoff_trades_nothing() -> None:
    clearing = clear_market([_offer(100, 10), _offer(100, 50)], [_demand(100 + MIN_SETTLED_QUANTITY / 2, 80)])

    _, marginal = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).sales

    assert marginal.power_sold == 0
    assert marginal.revenue == 0


def test_unsold_must_run_power_is_dumped_and_billed_at_the_dump_cost() -> None:
    clearing = clear_market([_offer(60, FLOOR, facility="wind", must_run=True)], [_demand(30, 100)])

    (sale,) = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).sales

    assert sale.power_sold == 30
    assert sale.power_produced == 60  # sold plus dumped: must-run power is produced whether it sells or not
    assert sale.power_dumped == 30
    assert sale.dump_cost == pytest.approx(energy_value(30, DUMP_COST, SECONDS_PER_TICK))
    assert sale.dump_cost > 0


def test_must_run_power_sold_below_the_cutoff_counts_as_dumped() -> None:
    """A must-run sale too small to trade is dumped rather than lost, so all of the offer is produced."""
    clearing = clear_market(
        [_offer(60, FLOOR, facility="wind", must_run=True)], [_demand(MIN_SETTLED_QUANTITY / 2, 100)]
    )

    (sale,) = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).sales

    assert (sale.power_sold, sale.power_dumped, sale.power_produced) == (0, 60, 60)


def test_settlement_continues_past_a_must_run_offer_that_did_not_clear() -> None:
    """A must-run offer beyond the cleared quantity dumps and settlement carries on to the next offer."""
    clearing = clear_market(
        [
            _offer(60, FLOOR, facility="wind", must_run=True),
            _offer(40, FLOOR, player_id=3, facility="solar", must_run=True),
        ],
        [_demand(70, 100)],
    )

    wind, solar = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).sales

    assert (wind.power_sold, wind.power_dumped) == (60, 0)
    assert (solar.power_sold, solar.power_dumped) == (10, 30)


def test_must_run_power_priced_above_the_market_is_dumped_in_full() -> None:
    """Must-run power can carry any price; if it does not clear, all of it is dumped at the caller's cost."""
    clearing = clear_market(
        [_offer(100, 10), _offer(50, 40, player_id=3, facility="wind", must_run=True)], [_demand(80, 30)]
    )

    _, wind = settle_clearing(clearing, SECONDS_PER_TICK, dump_cost_per_mwh=25).sales

    assert (wind.facility, wind.power_sold, wind.revenue) == ("wind", 0, 0)
    assert wind.power_dumped == 50
    assert wind.dump_cost == pytest.approx(50 * 25 / 1_000_000)


def test_must_run_offers_at_player_prices_settle_wherever_they_sit_in_the_merit_order() -> None:
    """Workshop's case: renewables are must-run at prices players chose, beside ordinary offers.

    100 MW is bid. Hydro (must-run at Workshop's floor of -25) and the 50 MW of gas at 10 clear. Wind
    (must-run at 20) is the marginal offer: it sells 30 MW and dumps 20. Nothing after it sells: the
    ordinary offer at 30 sells and dumps nothing, and solar (must-run at 40) dumps all 30 MW. Dumping
    costs 25 per MWh, as in Workshop.
    """
    clearing = clear_market(
        [
            _offer(20, -25, player_id=5, facility="hydro", must_run=True),
            _offer(50, 10, facility="gas"),
            _offer(50, 20, player_id=3, facility="wind", must_run=True),
            _offer(50, 30, facility="coal"),
            _offer(30, 40, player_id=4, facility="solar", must_run=True),
        ],
        [_demand(100, 25)],
    )

    sales = settle_clearing(clearing, SECONDS_PER_TICK, dump_cost_per_mwh=25).sales

    assert [(s.facility, s.power_sold, s.power_dumped, s.power_produced) for s in sales] == [
        ("hydro", 20, 0, 20),
        ("gas", 50, 0, 50),
        ("wind", 30, 20, 50),
        ("solar", 0, 30, 30),
    ]
    _, _, wind, solar = sales
    assert wind.dump_cost == pytest.approx(20 * 25 / 1_000_000)
    assert solar.dump_cost == pytest.approx(30 * 25 / 1_000_000)


def test_fully_served_demand_reports_no_shortfall() -> None:
    clearing = clear_market([_offer(100, 10)], [_demand(80, 90)])

    (purchase,) = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).purchases

    assert (purchase.power_bought, purchase.power_unserved, purchase.power_bid) == (80, 0, 80)
    assert not purchase.curtailed
    assert purchase.cost == pytest.approx(energy_value(80, clearing.price, SECONDS_PER_TICK))


def test_unserved_demand_reports_how_much_it_received() -> None:
    clearing = clear_market([_offer(100, 10)], [_demand(80, 90), _demand(60, 50, player_id=4, facility="lab")])

    served, unserved = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).purchases

    assert not served.curtailed
    assert unserved.player_id == 4
    assert (unserved.power_bought, unserved.power_unserved, unserved.power_bid) == (20, 40, 60)
    assert unserved.curtailed


def test_demand_priced_below_the_market_is_curtailed_to_zero() -> None:
    clearing = clear_market([_offer(100, 30)], [_demand(40, 10)])

    (purchase,) = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).purchases

    assert (purchase.power_bought, purchase.power_unserved) == (0, 40)
    assert purchase.cost == 0
    assert purchase.curtailed


def test_a_partial_purchase_below_the_cutoff_buys_nothing_and_is_curtailed_to_zero() -> None:
    """Under the cutoff a purchase counts as no trade, and the demand is cut to what was bought: nothing."""
    clearing = clear_market(
        [_offer(100, 10)], [_demand(100 - MIN_SETTLED_QUANTITY / 2, 90), _demand(60, 50, player_id=4)]
    )

    _, purchase = settle_clearing(clearing, SECONDS_PER_TICK, DUMP_COST).purchases

    assert (purchase.power_bought, purchase.power_unserved, purchase.power_bid) == (0, 60, 60)
    assert purchase.cost == 0
    assert purchase.curtailed


def test_an_empty_market_settles_to_nothing() -> None:
    settlement = settle_clearing(clear_market([], []), SECONDS_PER_TICK, DUMP_COST)

    assert settlement.sales == []
    assert settlement.purchases == []
