"""A player's balance sheet for a Round (#1008), built from constructed Trading-period results and purchases."""

from __future__ import annotations

import pytest

from energetica.workshop.balance_sheet import balance_sheet, period_sheet, season_status
from energetica.workshop.facilities import FacilityId, Fuel
from energetica.workshop.fleet import Purchase
from energetica.workshop.fuel import FuelPurchase
from energetica.workshop.operating_profit import round_operating_profit
from energetica.workshop.seasons import Season
from energetica.workshop.trading import FacilityPerformance, TradingResult

GAS = FacilityId.GAS_BURNER
WIND = FacilityId.ONSHORE_WIND_TURBINE
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES


def _performance(
    *,
    sold: float = 0.0,
    revenue: float = 0.0,
    dumped: float = 0.0,
    dump_cost: float = 0.0,
    bought: float = 0.0,
    purchase_cost: float = 0.0,
    count: int = 1,
    om_fixed: float = 0.0,
    om_variable_full: float = 0.0,
    capacity_factor: float = 0.0,
) -> FacilityPerformance:
    return FacilityPerformance(
        generation=sold + dumped,
        sold=sold,
        dumped=dumped,
        bought=bought,
        revenue=revenue,
        dump_cost=dump_cost,
        purchase_cost=purchase_cost,
        om=om_fixed + om_variable_full * capacity_factor,
        emissions=0.0,
        capacity_factor=capacity_factor,
        count=count,
        om_fixed=om_fixed,
        om_variable_full=om_variable_full,
    )


def _result(round_number: int, season: Season, facilities: dict[FacilityId, FacilityPerformance]) -> TradingResult:
    return TradingResult(round=round_number, season=season, facilities=facilities)


SPRING = _result(
    1,
    "spring",
    {
        GAS: _performance(sold=2e9, revenue=100_000.0, om_fixed=800.0, om_variable_full=3_200.0, capacity_factor=0.5),
        WIND: _performance(sold=1e9, revenue=40_000.0, dumped=4e8, dump_cost=10_000.0, count=2, om_fixed=7_500.0),
        BATTERIES: _performance(bought=5e8, purchase_cost=9_000.0, om_fixed=2_000.0),
    },
)
SUMMER = _result(
    1,
    "summer",
    {GAS: _performance(sold=1e9, revenue=60_000.0, om_fixed=800.0, om_variable_full=3_200.0, capacity_factor=0.25)},
)


def test_a_season_breaks_its_operating_income_down() -> None:
    sheet = period_sheet([SPRING])

    assert sheet.energy_sold == pytest.approx(3e9)
    assert sheet.sale_revenue == pytest.approx(140_000.0)
    assert sheet.energy_bought == pytest.approx(5e8)
    assert sheet.purchase_cost == pytest.approx(9_000.0)
    assert sheet.market_income == pytest.approx(131_000.0)
    assert sheet.energy_dumped == pytest.approx(4e8)
    assert sheet.dump_cost == pytest.approx(10_000.0)
    assert sheet.om_total == pytest.approx(2_400.0 + 7_500.0 + 2_000.0)
    assert sheet.operating_income == pytest.approx(131_000.0 - 10_000.0 - 11_900.0)


def test_o_and_m_has_a_line_per_facility_type_in_catalog_order_with_its_fixed_and_variable_parts() -> None:
    sheet = period_sheet([SPRING])

    assert [line.facility for line in sheet.om] == [WIND, GAS, BATTERIES]
    gas = sheet.om[1]
    assert (gas.count, gas.fixed, gas.variable_full, gas.usage) == (1, 800.0, 3_200.0, pytest.approx(0.5))
    assert gas.om == pytest.approx(gas.fixed + gas.variable_full * gas.usage)
    assert sheet.om[0].count == 2


def test_the_round_total_adds_up_its_seasons_and_matches_the_operating_profit_accumulator() -> None:
    sheet = balance_sheet(1, results=[SPRING, SUMMER], purchases=[], settled=(1, "summer"), blackouts=[])

    assert sheet.total is not None
    assert sheet.total.sale_revenue == pytest.approx(200_000.0)
    assert sheet.total.operating_income == pytest.approx(round_operating_profit([SPRING, SUMMER], 1))
    gas = next(line for line in sheet.total.om if line.facility == GAS)
    # Usage over the Round is the variable part charged over the variable part at full use.
    assert gas.usage == pytest.approx((1_600.0 + 800.0) / 6_400.0)


def _with_fuel(result: TradingResult, *purchases: FuelPurchase) -> TradingResult:
    return result.model_copy(update={"fuel": list(purchases)})


def test_fuel_has_a_line_per_fuel_and_comes_off_the_operating_income() -> None:
    spring = _with_fuel(
        SPRING,
        FuelPurchase(fuel=Fuel.URANIUM, quantity=2.0, price=1_000.0),
        FuelPurchase(fuel=Fuel.GAS, quantity=10_000.0, price=0.5),
    )

    sheet = period_sheet([spring])

    assert [(line.fuel, line.name, line.quantity, line.price, line.cost) for line in sheet.fuel] == [
        (Fuel.GAS, "Gas", 10_000.0, 0.5, 5_000.0),
        (Fuel.URANIUM, "Uranium", 2.0, 1_000.0, 2_000.0),
    ]
    assert sheet.fuel_total == pytest.approx(7_000.0)
    assert sheet.operating_income == pytest.approx(period_sheet([SPRING]).operating_income - 7_000.0)


def test_the_round_totals_fuel_at_its_average_price() -> None:
    spring = _with_fuel(SPRING, FuelPurchase(fuel=Fuel.GAS, quantity=10_000.0, price=0.5))
    summer = _with_fuel(SUMMER, FuelPurchase(fuel=Fuel.GAS, quantity=30_000.0, price=0.7))

    [line] = period_sheet([spring, summer]).fuel

    assert line.quantity == pytest.approx(40_000.0)
    assert line.cost == pytest.approx(5_000.0 + 21_000.0)
    assert line.quantity * line.price == pytest.approx(line.cost)
    sheet = balance_sheet(1, results=[spring, summer], purchases=[], settled=(1, "summer"), blackouts=[])
    assert sheet.total is not None
    assert sheet.total.operating_income == pytest.approx(round_operating_profit([spring, summer], 1))


def test_a_season_with_no_fuel_has_no_fuel_lines() -> None:
    sheet = period_sheet([SPRING])

    assert (sheet.fuel, sheet.fuel_total) == ([], 0.0)


def test_seasons_fill_in_as_they_are_settled() -> None:
    sheet = balance_sheet(1, results=[SPRING], purchases=[], settled=(1, "spring"), blackouts=[])

    assert [season.status for season in sheet.seasons] == ["settled", "upcoming", "upcoming", "upcoming"]
    assert sheet.seasons[0].sheet == period_sheet([SPRING])
    assert sheet.seasons[1].sheet is None


def test_nothing_is_settled_before_the_rounds_first_trading_period() -> None:
    sheet = balance_sheet(2, results=[SPRING], purchases=[], settled=(1, "winter"), blackouts=[])

    assert all(season.status == "upcoming" for season in sheet.seasons)
    assert sheet.total is None


def test_a_settled_season_with_nothing_operating_shows_zero() -> None:
    sheet = balance_sheet(1, results=[], purchases=[], settled=(1, "spring"), blackouts=[])

    spring = sheet.seasons[0].sheet
    assert spring is not None
    assert (spring.market_income, spring.om, spring.operating_income) == (0.0, [], 0.0)


def test_a_blackout_marks_its_season_and_skips_the_rest_of_the_round() -> None:
    sheet = balance_sheet(1, results=[SPRING, SUMMER], purchases=[], settled=(1, "summer"), blackouts=[(1, "summer")])

    assert [season.status for season in sheet.seasons] == ["settled", "settled", "skipped", "skipped"]
    assert [season.blackout for season in sheet.seasons] == [False, True, False, False]


def test_a_blackout_in_another_round_skips_nothing() -> None:
    assert season_status(2, "winter", settled=(2, "winter"), blackouts=[(1, "spring")]) == "settled"


def test_investments_are_the_rounds_purchases_by_type_and_come_off_the_net_profit() -> None:
    purchases = [
        Purchase(facility=GAS, round=1, price=90_000.0),
        Purchase(facility=BATTERIES, round=1, price=660_000.0),
        Purchase(facility=GAS, round=1, price=90_000.0),
        Purchase(facility=WIND, round=2, price=270_000.0),
    ]

    sheet = balance_sheet(1, results=[SPRING], purchases=purchases, settled=(1, "spring"), blackouts=[])

    assert [(line.facility, line.count, line.cost) for line in sheet.investments] == [
        (GAS, 2, 180_000.0),
        (BATTERIES, 1, 660_000.0),
    ]
    assert sheet.investment_total == pytest.approx(840_000.0)
    assert sheet.net_profit == pytest.approx(period_sheet([SPRING]).operating_income - 840_000.0)


def test_before_any_season_is_settled_the_net_profit_is_minus_the_investments() -> None:
    purchases = [Purchase(facility=GAS, round=1, price=90_000.0)]

    sheet = balance_sheet(1, results=[], purchases=purchases, settled=None, blackouts=[])

    assert sheet.net_profit == pytest.approx(-90_000.0)
