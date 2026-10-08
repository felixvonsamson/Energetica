"""A player's operating profit (#1006), added up from constructed Trading-period results."""

from __future__ import annotations

import pytest

from energetica.workshop.facilities import FacilityId
from energetica.workshop.operating_profit import (
    period_operating_profit,
    round_operating_profit,
    session_operating_profit,
)
from energetica.workshop.seasons import Season
from energetica.workshop.trading import FacilityPerformance, TradingResult

GAS = FacilityId.GAS_BURNER
WIND = FacilityId.ONSHORE_WIND_TURBINE
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES


def _performance(
    revenue: float = 0.0, dump_cost: float = 0.0, purchase_cost: float = 0.0, om: float = 0.0
) -> FacilityPerformance:
    return FacilityPerformance(
        generation=0.0,
        sold=0.0,
        dumped=0.0,
        bought=0.0,
        revenue=revenue,
        dump_cost=dump_cost,
        purchase_cost=purchase_cost,
        om=om,
        emissions=0.0,
        capacity_factor=0.0,
    )


def _result(round_number: int, season: Season, facilities: dict[FacilityId, FacilityPerformance]) -> TradingResult:
    return TradingResult(round=round_number, season=season, facilities=facilities)


def test_a_period_earns_its_income_less_every_operating_cost() -> None:
    result = _result(
        1,
        "spring",
        {
            GAS: _performance(revenue=1_000.0, om=100.0),
            WIND: _performance(revenue=500.0, dump_cost=30.0, om=20.0),
            BATTERIES: _performance(revenue=400.0, purchase_cost=250.0, om=10.0),
        },
    )

    assert period_operating_profit(result) == pytest.approx(1_900.0 - 100.0 - 30.0 - 20.0 - 250.0 - 10.0)


def test_a_period_can_lose_money() -> None:
    result = _result(1, "winter", {GAS: _performance(revenue=0.0, om=300.0)})

    assert period_operating_profit(result) == pytest.approx(-300.0)


def test_a_round_adds_up_only_its_own_periods() -> None:
    results = [
        _result(1, "spring", {GAS: _performance(revenue=100.0)}),
        _result(1, "summer", {GAS: _performance(revenue=200.0, om=50.0)}),
        _result(2, "spring", {GAS: _performance(revenue=1_000.0)}),
    ]

    assert round_operating_profit(results, 1) == pytest.approx(250.0)
    assert round_operating_profit(results, 2) == pytest.approx(1_000.0)
    assert round_operating_profit(results, 3) == 0.0


def test_the_session_total_is_the_sum_of_its_rounds() -> None:
    results = [
        _result(1, "spring", {GAS: _performance(revenue=100.0, om=10.0)}),
        _result(1, "autumn", {WIND: _performance(revenue=80.0, dump_cost=5.0)}),
        _result(2, "summer", {BATTERIES: _performance(revenue=60.0, purchase_cost=40.0)}),
        _result(3, "winter", {GAS: _performance(om=25.0)}),
    ]

    total = session_operating_profit(results)

    assert total == pytest.approx(90.0 + 75.0 + 20.0 - 25.0)
    assert total == pytest.approx(sum(round_operating_profit(results, round_number) for round_number in (1, 2, 3)))


def test_a_player_with_no_results_has_made_nothing() -> None:
    assert session_operating_profit([]) == 0.0
    assert round_operating_profit([], 1) == 0.0
