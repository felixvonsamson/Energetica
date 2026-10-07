"""Unit tests for Workshop's synthetic demand block (issue #997).

The demand block is pure: it turns an amplitude and a settlement period into six demand bids,
which clear against real supply offers through the shared ``clear_market``. Nothing here builds
a ``Player``, touches a database or starts an engine, the same as the market-clearing tests.
"""

from __future__ import annotations

import math

import pytest

from energetica.sim.demand_shape import demand_shape_factor
from energetica.sim.market import Fill, MarketClearing, MarketEntry, clear_market
from energetica.sim.national_demand import DemandCurve, national_demand_curve
from energetica.workshop.demand_block import (
    DAYS_PER_YEAR,
    DEMAND_TIERS,
    SettlementPeriod,
    build_demand_block,
    nominal_demand,
    round_one_amplitude,
)

# A curve whose shape factor is 1 everywhere, so nominal demand equals the amplitude.
_FLAT = DemandCurve(intraday=(1.0,), seasonal=(1.0,))
_NOON = SettlementPeriod(day=0, clearing=12, clearings_per_day=24)


def _offer(capacity: float, price: float, player_id: int = 1) -> MarketEntry:
    return MarketEntry(player_id, capacity, price, "facility")


def _tier_fill(clearing: MarketClearing, label: str) -> Fill:
    return next(fill for fill in clearing.demands if fill.entry.facility == label)


def test_six_tiers_in_locked_order() -> None:
    """The structure locked in the spec: six tiers, these shares, falling willingness to pay."""
    assert [(tier.label, tier.share) for tier in DEMAND_TIERS] == [
        ("must_serve", 0.80),
        ("low_flex", 0.10),
        ("medium_flex", 0.15),
        ("high_flex", 0.20),
        ("very_high_flex", 0.20),
        ("opportunistic", 0.20),
    ]
    assert DEMAND_TIERS[0].willingness_to_pay == math.inf
    prices = [tier.willingness_to_pay for tier in DEMAND_TIERS]
    assert prices == sorted(prices, reverse=True)
    assert len(set(prices)) == len(prices)


def test_tiers_carry_distinct_negative_sentinel_player_ids() -> None:
    """No tier can be mistaken for a real player, whose ids are positive."""
    ids = [tier.player_id for tier in DEMAND_TIERS]
    assert all(player_id < 0 for player_id in ids)
    assert len(set(ids)) == len(ids)


def test_block_splits_nominal_demand_by_tier_share() -> None:
    block = build_demand_block(1000, _FLAT, _NOON)

    assert [(entry.facility, entry.capacity, entry.price, entry.player_id) for entry in block] == [
        (tier.label, pytest.approx(1000 * tier.share), tier.willingness_to_pay, tier.player_id) for tier in DEMAND_TIERS
    ]
    # Widths sum to 165% of nominal demand on purpose: latent demand that only shows up when power is cheap.
    assert sum(entry.capacity for entry in block) == pytest.approx(1650)


def test_nominal_demand_reuses_demand_shape_factor() -> None:
    curve = national_demand_curve()
    period = SettlementPeriod(day=200, clearing=30, clearings_per_day=96)

    expected = 1000 * demand_shape_factor(curve.intraday, curve.seasonal, 96, DAYS_PER_YEAR, 200 * 96 + 30)

    assert nominal_demand(1000, curve, period) == pytest.approx(expected)
    assert expected != pytest.approx(1000)  # the real curve does shape demand


def test_period_rejects_a_clearing_outside_its_day() -> None:
    with pytest.raises(ValueError):
        SettlementPeriod(day=0, clearing=24, clearings_per_day=24)


def test_round_one_amplitude_scales_with_headcount() -> None:
    assert round_one_amplitude(per_player_base_amplitude=50e6, headcount=12) == pytest.approx(600e6)


def test_ample_supply_serves_every_tier() -> None:
    """Supply beyond the whole block: all 165% clears and the cheapest tier sets the price."""
    block = build_demand_block(1000, _FLAT, _NOON)

    clearing = clear_market([_offer(1000, 2), _offer(1000, 3)], block)

    assert clearing.quantity == pytest.approx(1650)
    assert clearing.price == 3
    assert clearing.unserved == pytest.approx(0)


def test_supply_priced_out_of_flexible_tiers() -> None:
    """Supply at €200/MWh serves must-serve, low and medium flex, and nothing cheaper."""
    block = build_demand_block(1000, _FLAT, _NOON)

    clearing = clear_market([_offer(5000, 200)], block)

    assert clearing.quantity == pytest.approx(1050)  # 800 + 100 + 150
    assert clearing.price == 200  # demand drops from €240 to €120 across the offer, so the offer sets the price
    assert clearing.unserved == pytest.approx(600)
    assert _tier_fill(clearing, "must_serve").unmet == 0
    assert _tier_fill(clearing, "medium_flex").unmet == 0
    assert _tier_fill(clearing, "high_flex").unmet == pytest.approx(200)


def test_shortage_leaves_must_serve_unmet() -> None:
    """Supply below the must-serve tier: the shortfall shows on that tier, which is how blackout is detected."""
    block = build_demand_block(1000, _FLAT, _NOON)

    clearing = clear_market([_offer(300, 10), _offer(200, 60)], block)

    assert clearing.quantity == pytest.approx(500)
    # The must-serve bid is still the one in progress, so the price is unbounded. A blackout period is not
    # settled like a normal one (#992 §1, §8), so nothing should turn this price into money.
    assert clearing.price == math.inf
    assert _tier_fill(clearing, "must_serve").cleared == pytest.approx(500)
    assert _tier_fill(clearing, "must_serve").unmet == pytest.approx(300)
    assert clearing.unserved == pytest.approx(1650 - 500)
    assert sum(fill.cleared for fill in clearing.offers) == pytest.approx(500)
