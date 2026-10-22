"""Unit tests for Workshop's synthetic demand block (issue #997) and its demand curve (#1201).

The demand block is pure: it turns an amplitude and a settlement period into six demand bids,
which clear against real supply offers through the shared ``clear_market``. Nothing here builds
a ``Player``, touches a database or starts an engine, the same as the market-clearing tests.
"""

from __future__ import annotations

import math

import pytest

from energetica.sim.market import Fill, MarketClearing, MarketEntry, clear_market
from energetica.workshop.demand_block import (
    DAYS_PER_YEAR,
    DEMAND_TIERS,
    DemandCurve,
    SettlementPeriod,
    build_demand_block,
    national_demand_curve,
    nominal_demand,
    round_one_amplitude,
)
from energetica.workshop.seasons import SEASONS, season_days

# A curve whose shape factor is 1 everywhere, so nominal demand equals the amplitude.
_FLAT = DemandCurve((1.0,) * DAYS_PER_YEAR)
# A curve with four values a day, numbered 0, 1, 2, ... through the year, so a factor names where it was read.
_COUNTING = DemandCurve(tuple(float(index) for index in range(4 * DAYS_PER_YEAR)))
_NOON = SettlementPeriod(day=0, clearing=12, clearings_per_day=24)


def _offer(capacity: float, price: float, player_id: int = 1) -> MarketEntry:
    return MarketEntry(player_id, capacity, price, "facility")


def _tier_fill(clearing: MarketClearing, label: str) -> Fill:
    return next(fill for fill in clearing.demands if fill.entry.facility == label)


def test_six_tiers_in_locked_order() -> None:
    """The structure locked in the spec: six tiers, these shares, falling willingness to pay."""
    assert [(tier.label, tier.share) for tier in DEMAND_TIERS] == [
        ("must_serve", 1.00),
        ("low_flex", 0.30),
        ("medium_flex", 0.30),
        ("high_flex", 0.30),
        ("very_high_flex", 0.30),
        ("opportunistic", 0.30),
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
    # Widths sum to 250% of nominal demand on purpose: latent demand that only shows up when power is cheap.
    assert sum(entry.capacity for entry in block) == pytest.approx(2500)


def test_nominal_demand_is_the_amplitude_times_the_curve() -> None:
    curve = national_demand_curve()
    period = SettlementPeriod(day=200, clearing=30, clearings_per_day=96)

    assert nominal_demand(1000, curve, period) == pytest.approx(1000 * curve.factor(period))
    assert curve.factor(period) != pytest.approx(1)  # the real curve does shape demand


@pytest.mark.parametrize(
    ("clearing", "clearings_per_day", "factor"),
    [
        (0, 4, 8.0),  # one clearing per value: reads it exactly
        (3, 4, 11.0),
        (1, 2, 10.0),  # fewer clearings than values: reads the value at the clearing's start
        (1, 8, 8.5),  # more clearings than values: halfway between two values
        (7, 8, 11.5),  # ...including halfway into the next day's first value
    ],
)
def test_the_curve_is_read_at_the_start_of_the_period(clearing: int, clearings_per_day: int, factor: float) -> None:
    assert _COUNTING.factor(SettlementPeriod(day=2, clearing=clearing, clearings_per_day=clearings_per_day)) == factor


def test_the_curve_wraps_from_the_end_of_the_year_to_its_start() -> None:
    last_value = 4 * DAYS_PER_YEAR - 1

    halfway = _COUNTING.factor(SettlementPeriod(day=DAYS_PER_YEAR - 1, clearing=7, clearings_per_day=8))

    assert halfway == pytest.approx(last_value / 2)  # halfway between the last value and value 0


@pytest.mark.parametrize("length", [0, 1, DAYS_PER_YEAR + 1, 365 * 96])
def test_a_curve_needs_the_same_number_of_values_for_every_day(length: int) -> None:
    with pytest.raises(ValueError):
        DemandCurve((1.0,) * length)


def test_the_national_curve_covers_the_year_in_15_minute_steps() -> None:
    curve = national_demand_curve()

    assert len(curve.values) == DAYS_PER_YEAR * 96
    assert sum(curve.values) / len(curve.values) == pytest.approx(1, abs=1e-3)


def test_the_national_curve_has_weekends_on_days_5_and_6() -> None:
    """Day 0 is a Monday, so Saturday and Sunday are the two days of each week with the least demand on average."""
    values = national_demand_curve().values
    by_weekday = [0.0] * 7
    for index, value in enumerate(values):
        by_weekday[index // 96 % 7] += value

    weekdays, weekend = by_weekday[:5], by_weekday[5:]

    assert max(weekend) < min(weekdays)


def test_the_national_curve_wraps_around_the_year_without_a_jump() -> None:
    """The year repeats, so the step from its last value back to its first is no bigger than an ordinary step."""
    values = national_demand_curve().values
    steps = sorted(abs(b - a) for a, b in zip(values, values[1:]))

    assert abs(values[0] - values[-1]) <= steps[int(0.99 * len(steps))]


def test_every_season_starts_on_a_monday() -> None:
    assert [season_days(season)[0] % 7 for season in SEASONS] == [0, 0, 0, 0]


def test_period_rejects_a_clearing_outside_its_day() -> None:
    with pytest.raises(ValueError):
        SettlementPeriod(day=0, clearing=24, clearings_per_day=24)


def test_round_one_amplitude_scales_with_headcount() -> None:
    assert round_one_amplitude(per_player_base_amplitude=50e6, headcount=12) == pytest.approx(600e6)


def test_ample_supply_serves_every_tier() -> None:
    """Supply beyond the whole block: all 250% clears and the cheapest tier sets the price."""
    block = build_demand_block(1000, _FLAT, _NOON)

    clearing = clear_market([_offer(1500, 2), _offer(1500, 3)], block)

    assert clearing.quantity == pytest.approx(2500)
    assert clearing.price == 3
    assert clearing.unserved == pytest.approx(0)


def test_supply_priced_out_of_flexible_tiers() -> None:
    """Supply at €120/MWh serves must-serve, low and medium flex, and nothing cheaper."""
    block = build_demand_block(1000, _FLAT, _NOON)

    clearing = clear_market([_offer(5000, 120)], block)

    assert clearing.quantity == pytest.approx(1600)  # 1000 + 300 + 300
    assert clearing.price == 120  # demand drops from €140 to €80 across the offer, so the offer sets the price
    assert clearing.unserved == pytest.approx(900)
    assert _tier_fill(clearing, "must_serve").unmet == 0
    assert _tier_fill(clearing, "medium_flex").unmet == 0
    assert _tier_fill(clearing, "high_flex").unmet == pytest.approx(300)


def test_shortage_leaves_must_serve_unmet() -> None:
    """Supply below the must-serve tier: the shortfall shows on that tier, which is how blackout is detected."""
    block = build_demand_block(1000, _FLAT, _NOON)

    clearing = clear_market([_offer(300, 10), _offer(200, 60)], block)

    assert clearing.quantity == pytest.approx(500)
    # The must-serve bid is still the one in progress, so the price is unbounded. A blackout period is not
    # settled like a normal one (#992 §1, §8), so nothing should turn this price into money.
    assert clearing.price == math.inf
    assert _tier_fill(clearing, "must_serve").cleared == pytest.approx(500)
    assert _tier_fill(clearing, "must_serve").unmet == pytest.approx(500)
    assert clearing.unserved == pytest.approx(2500 - 500)
    assert sum(fill.cleared for fill in clearing.offers) == pytest.approx(500)
