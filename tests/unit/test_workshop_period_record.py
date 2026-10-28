"""A Trading period's record of every settlement point (#1007).

The engine keeps, beside each player's result, the time series and the merit order of each settlement
point it cleared. These tests use a flat demand curve and steady weather, as the engine's tests do. With
an amplitude of 30 MW, the demand block bids 30 MW at any price (must-serve), then 9 MW each up to 250,
140, 80, 40 and 10.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pytest

from energetica.sim.market import market_optimum, merit_order, MarketEntry
from energetica.workshop.demand_block import DAYS_PER_YEAR, DemandCurve
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.prices import DEFAULT_PRICES, PriceSheet
from energetica.workshop.schemas import WorkshopSeasonOverviewOut
from energetica.workshop.round_format import ClearingsPerDay, RoundFormat, TradingFormat
from energetica.workshop.seasons import SEASON_DAYS
from energetica.workshop.trading import Bidder, TradingOutcome, simulate_trading_period
from energetica.workshop.weather import Shares

from ._weather_helpers import FixedWeather

_FLAT = DemandCurve((1.0,) * DAYS_PER_YEAR)
_AMPLITUDE = 30e6
_WEEK_HOURS = 7 * 24

GAS = FacilityId.GAS_BURNER  # 38 MW
WIND = FacilityId.ONSHORE_WIND_TURBINE  # 45 MW
BATTERIES = FacilityId.LITHIUM_ION_BATTERIES  # 90 MW, 300 MWh, 90% efficient


def _bidder(
    *facilities: FacilityId,
    sell: dict[FacilityId, float] | None = None,
    buy: dict[FacilityId, float] | None = None,
    stored_energy: dict[FacilityId, float] | None = None,
    player_id: int = 1,
) -> Bidder:
    return Bidder(
        player_id=player_id,
        owned_facilities=[OwnedFacility(facility=facility, built_round=1) for facility in facilities],
        prices=PriceSheet(sell={**DEFAULT_PRICES.sell, **(sell or {})}, buy={**DEFAULT_PRICES.buy, **(buy or {})}),
        stored_energy=stored_energy or {},
    )


def _simulate(
    *bidders: Bidder,
    weather: Shares = lambda _facility, _seconds: 1.0,
    clearings_per_day: ClearingsPerDay = 24,
    trading_format: TradingFormat = "representative_week",
) -> TradingOutcome:
    return simulate_trading_period(
        list(bidders),
        round_number=1,
        season="spring",
        round_format=RoundFormat(trading_format=trading_format, clearings_per_day=clearings_per_day),
        amplitude=_AMPLITUDE,
        curve=_FLAT,
        weather=FixedWeather(weather),
    )


def _row(record: TradingPeriodRecord, player_id: int, facility: FacilityId) -> int:
    return record.pools.index((player_id, facility.value))


def _sunny_mornings(seconds: float) -> float:
    """Full wind until noon, then 10%."""
    return 1.0 if seconds % 86_400 < 12 * 3_600 else 0.1


def test_a_representative_week_has_one_point_per_clearing() -> None:
    record = _simulate(_bidder(GAS), clearings_per_day=96).record

    assert record.point_count == 7 * 96
    assert record.clearings_per_day == 96
    assert len(record.days) == 7
    assert record.generation.shape == (1, 7 * 96)
    assert record.blackouts == ()


def test_a_full_season_has_every_clearing_of_every_day() -> None:
    record = _simulate(_bidder(GAS), trading_format="full_season").record

    assert len(record.days) == SEASON_DAYS
    assert record.point_count == SEASON_DAYS * 24


def test_the_series_add_up_to_the_players_result() -> None:
    outcome = _simulate(
        _bidder(GAS, WIND, BATTERIES, sell={GAS: 50.0, WIND: 0.0, BATTERIES: 300.0}, buy={BATTERIES: 100.0}),
        weather=lambda _facility, seconds: _sunny_mornings(seconds),
    )
    record = outcome.record
    hours_scaled = SEASON_DAYS // 7  # each clearing is one hour of the representative week, scaled to the season

    for facility, performance in outcome.results[1].facilities.items():
        row = _row(record, 1, facility)
        assert record.generation[row].sum() * hours_scaled == pytest.approx(performance.generation)
        assert record.dumped[row].sum() * hours_scaled == pytest.approx(performance.dumped)
        assert record.charged[row].sum() * hours_scaled == pytest.approx(performance.bought)
        sold = record.generation[row] - record.dumped[row]
        assert sold.sum() * hours_scaled == pytest.approx(performance.sold)


def test_stored_energy_follows_charging_and_ends_where_the_period_does() -> None:
    # One turbine at 70% makes 31.5 MW. The batteries bid above every tier but must-serve, so they buy the 1.5 MW
    # of wind left over once the 30 MW must-serve demand is met, every hour. They ask too much to ever sell. The week
    # that counts starts from what the first pass, for the cyclic start, stored. Seven batteries have room for both
    # passes.
    outcome = _simulate(
        _bidder(WIND, *[BATTERIES] * 7, sell={WIND: 0.0, BATTERIES: 1_000.0}, buy={BATTERIES: 500.0}),
        weather=lambda facility, _seconds: 0.7 if facility == WIND else 1.0,
    )
    record = outcome.record
    row = _row(record, 1, BATTERIES)
    # What is bought reaches the store at the square root of the round-trip efficiency.
    stored_per_hour = 1.5e6 * (CATALOG[BATTERIES].base_efficiency or 0.0) ** 0.5

    assert record.charged[row] == pytest.approx(np.full(_WEEK_HOURS, 1.5e6))
    assert record.stored[row] == pytest.approx(stored_per_hour * np.arange(_WEEK_HOURS + 1, 2 * _WEEK_HOURS + 1))
    assert record.stored[row, -1] == pytest.approx(outcome.stored_energy[1][BATTERIES])
    # A facility that stores nothing holds nothing.
    assert not record.stored[_row(record, 1, WIND)].any()


def test_each_pool_keeps_the_storage_capacity_it_had() -> None:
    # The state of charge is the stored energy over this capacity. Retired facilities leave the fleet, so it cannot
    # be worked out again after the period.
    record = _simulate(_bidder(WIND, *[BATTERIES] * 3)).record

    assert record.storage_capacity[_row(record, 1, BATTERIES)] == pytest.approx(
        3 * (CATALOG[BATTERIES].base_storage_capacity or 0.0)
    )
    assert record.storage_capacity[_row(record, 1, WIND)] == 0.0


def test_the_demand_tiers_served_add_up_to_the_cleared_quantity() -> None:
    record = _simulate(_bidder(GAS, sell={GAS: 50.0})).record

    # Gas sells all 38 MW: 30 MW to must-serve and 8 MW to the tier bidding 250, which sets the price.
    assert record.served.sum(axis=0) == pytest.approx(record.quantity)
    assert record.served[:, 0] == pytest.approx([30e6, 8e6, 0, 0, 0, 0])
    assert record.price == pytest.approx(np.full(_WEEK_HOURS, 250.0))


def test_each_merit_order_clears_again_at_the_recorded_price_and_quantity() -> None:
    record = _simulate(
        _bidder(GAS, WIND, BATTERIES, sell={GAS: 50.0, WIND: 0.0, BATTERIES: 300.0}, buy={BATTERIES: 100.0}),
        _bidder(GAS, sell={GAS: 200.0}, player_id=2),
        weather=lambda _facility, seconds: _sunny_mornings(seconds),
    ).record

    for point in range(record.point_count):
        order = record.merit_order(point)
        assert order is not None
        offers = merit_order(
            [MarketEntry(p, c, pr, f) for p, c, pr, f in zip(*(order.offers[k] for k in _KEYS), strict=True)]
        )
        demands = merit_order(
            [MarketEntry(p, c, pr, f) for p, c, pr, f in zip(*(order.demands[k] for k in _KEYS), strict=True)],
            descending=True,
        )
        assert market_optimum(offers, demands) == pytest.approx((order.price, order.quantity))
        assert sum(order.offers["cleared"]) == pytest.approx(order.quantity)
        assert sum(order.demands["cleared"]) == pytest.approx(order.quantity)


_KEYS = ("player_id", "capacity", "price", "facility")


def test_a_merit_order_keeps_the_bids_that_did_not_sell() -> None:
    record = _simulate(_bidder(GAS, sell={GAS: 50.0}), _bidder(GAS, sell={GAS: 600.0}, player_id=2)).record

    order = record.merit_order(0)

    assert order is not None
    assert order.offers["player_id"] == [1, 2]
    assert order.offers["price"] == [50.0, 600.0]
    assert order.offers["capacity"] == pytest.approx([38e6, 38e6])
    assert order.offers["cumul_capacities"] == pytest.approx([38e6, 76e6])
    assert order.offers["cleared"] == pytest.approx([38e6, 0.0])
    # Every demand tier bids, the must-serve one at an unbounded price.
    assert order.demands["facility"][0] == "must_serve"
    assert order.demands["price"][0] == math.inf
    assert len(order.demands["facility"]) == 6


def test_a_blackout_keeps_the_merit_order_that_failed_and_nothing_for_the_day_after_it() -> None:
    # The wind cannot meet the 30 MW must-serve demand once it drops to 9 MW at noon. The grid restarts at noon the
    # next day, when the wind is still too weak for the rationed demand, and goes down again.
    record = _simulate(
        _bidder(WIND, WIND, sell={WIND: 0.0}), weather=lambda _facility, seconds: _sunny_mornings(seconds)
    ).record

    assert record.blackouts[:2] == (12, 36)
    failed = record.merit_order(12)
    assert failed is not None
    assert failed.offers["capacity"] == pytest.approx([9e6])
    assert record.merit_order(13) is None
    assert record.merit_order(35) is None
    assert record.merit_order(36) is not None
    assert np.isnan(record.price[13:36]).all()
    assert not record.generation[:, 12:37].any()
    assert not record.served[:, 12:37].any()


def test_a_point_outside_the_period_has_no_merit_order() -> None:
    record = _simulate(_bidder(GAS)).record

    with pytest.raises(IndexError):
        record.merit_order(_WEEK_HOURS)


def test_a_saved_record_loads_back_the_same(tmp_path: Path) -> None:
    record = _simulate(
        _bidder(WIND, BATTERIES, sell={WIND: 0.0, BATTERIES: 300.0}, buy={BATTERIES: 100.0}),
        weather=lambda _facility, seconds: _sunny_mornings(seconds),
    ).record
    path = tmp_path / "records" / "round-1-spring.npz"

    record.save(path)
    loaded = TradingPeriodRecord.load(path)

    names = ("round", "season", "clearings_per_day", "days", "blackouts", "pools", "tiers", "lines", "average_output")
    for name in names:
        assert getattr(loaded, name) == getattr(record, name)
    for name in (
        "price",
        "quantity",
        "generation",
        "dumped",
        "charged",
        "stored",
        "storage_capacity",
        "served",
        "offered",
    ):
        np.testing.assert_array_equal(getattr(loaded, name), getattr(record, name))
    assert loaded.merit_order(5) == record.merit_order(5)


def test_the_season_overview_sums_by_type_and_summarizes_the_price() -> None:
    # Two players' gas burners make one series. 96 clearings a day: 12 a point of the overview's power, 4 an hour.
    outcome = _simulate(
        _bidder(GAS, WIND, sell={GAS: 50.0, WIND: 0.0}),
        _bidder(GAS, sell={GAS: 120.0}, player_id=2),
        weather=lambda _facility, seconds: _sunny_mornings(seconds),
        clearings_per_day=96,
    )
    record = outcome.record
    overview = WorkshopSeasonOverviewOut.from_record(record)

    gas = record.generation[_row(record, 1, GAS)] + record.generation[_row(record, 2, GAS)]
    [daily_gas] = [series.values for series in overview.daily_energy if series.facility == GAS]
    assert daily_gas == pytest.approx(gas.reshape(7, 96).sum(axis=1) / 4)
    [power_gas] = [series.values for series in overview.power if series.facility == GAS]
    assert overview.points_per_day == 8
    assert power_gas == pytest.approx(gas.reshape(7 * 8, 12).mean(axis=1))

    day = record.price[:96]
    assert (overview.price_min[0], overview.price_max[0]) == (day.min(), day.max())
    assert overview.price_mean[0] == pytest.approx(day.mean())
    assert overview.hourly_price[:24] == pytest.approx(day.reshape(24, 4).mean(axis=1))
