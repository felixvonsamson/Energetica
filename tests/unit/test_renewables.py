"""Unit tests for the pure renewable output functions (#1102). No ``Player`` and no engine."""

from __future__ import annotations

import math

import pytest

from energetica.sim.astro import direct_horizontal_irradiance
from energetica.sim.renewable_curves import RIVER_FLOW_SPEED_SEASONAL, WIND_POWER_CURVE
from energetica.sim.renewables import (
    MAX_RIVER_SPEED,
    SOLAR_FULL_POWER_IRRADIANCE,
    WIND_CUT_OUT_SPEED,
    _normal_cdf,
    calculate_river_speed,
    hydro_power_fraction,
    solar_power_fraction,
    wind_power_fraction,
)


def test_wind_power_is_read_straight_off_the_curve_at_whole_speeds() -> None:
    for speed in (0, 3, 10, 40, WIND_CUT_OUT_SPEED):
        assert wind_power_fraction(speed) == pytest.approx(WIND_POWER_CURVE[speed])


def test_wind_power_interpolates_between_curve_entries() -> None:
    low, high = WIND_POWER_CURVE[9], WIND_POWER_CURVE[10]
    assert wind_power_fraction(9.25) == pytest.approx(low + 0.25 * (high - low))


def test_wind_power_is_zero_past_the_end_of_the_curve() -> None:
    assert wind_power_fraction(90.5) == 0


def test_the_curve_is_at_full_power_at_the_last_speed_before_cut_out_taper() -> None:
    assert WIND_POWER_CURVE[WIND_CUT_OUT_SPEED] == 1


def test_solar_power_fraction_reaches_one_at_the_full_power_irradiance() -> None:
    assert solar_power_fraction(SOLAR_FULL_POWER_IRRADIANCE) == 1
    assert solar_power_fraction(SOLAR_FULL_POWER_IRRADIANCE / 4) == pytest.approx(0.25)


def test_hydro_power_fraction_reaches_one_at_the_fastest_river_flow() -> None:
    assert hydro_power_fraction(MAX_RIVER_SPEED) == 1
    assert hydro_power_fraction(MAX_RIVER_SPEED / 2) == pytest.approx(0.5)


def test_river_speed_interpolates_between_days_and_wraps_the_year() -> None:
    days = len(RIVER_FLOW_SPEED_SEASONAL)
    day = 86_400.0
    assert calculate_river_speed(0, days) == pytest.approx(RIVER_FLOW_SPEED_SEASONAL[0] * MAX_RIVER_SPEED)
    halfway = (RIVER_FLOW_SPEED_SEASONAL[0] + RIVER_FLOW_SPEED_SEASONAL[1]) / 2 * MAX_RIVER_SPEED
    assert calculate_river_speed(day / 2, days) == pytest.approx(halfway)
    assert calculate_river_speed(days * day, days) == pytest.approx(calculate_river_speed(0, days))


def test_normal_cdf_matches_known_values() -> None:
    assert _normal_cdf(0, scale=1) == 0.5
    assert _normal_cdf(1, scale=1) == pytest.approx(0.8413447460685429)
    assert _normal_cdf(-1, scale=1) == pytest.approx(0.15865525393145707)
    assert _normal_cdf(0.15, scale=0.15) == pytest.approx(0.8413447460685429)
    assert _normal_cdf(-8, scale=1) == pytest.approx(6.22096057427178e-16, rel=1e-6)
    assert _normal_cdf(8, scale=1) == pytest.approx(1.0)


def test_there_is_no_direct_irradiance_when_the_sun_is_below_the_horizon() -> None:
    # 2023-07-01 00:00 UTC at the equator and longitude 0 is the middle of the night.
    assert direct_horizontal_irradiance(1_688_169_600, 0, 0) == pytest.approx(0, abs=1e-6)


def test_direct_irradiance_is_bounded_by_the_solar_constant() -> None:
    values = [direct_horizontal_irradiance(1_688_169_600 + hour * 3600, 0, 0) for hour in range(24)]
    assert max(values) > 300
    assert all(0 <= value <= 1360 for value in values)
    assert not any(math.isnan(value) for value in values)


@pytest.mark.parametrize(("latitude", "longitude"), [(-90, 0), (91, 0), (0, -180), (0, 181)])
def test_direct_irradiance_rejects_coordinates_outside_the_valid_range(latitude: float, longitude: float) -> None:
    with pytest.raises(ValueError):
        direct_horizontal_irradiance(1_688_169_600, latitude, longitude)
