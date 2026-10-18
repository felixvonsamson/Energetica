"""The weather of a Workshop Run, and the representative week's borrowed weather (#1198, ADR-0008)."""

from __future__ import annotations

import numpy as np
import pytest

from energetica.sim.renewables import calculate_solar_irradiance, calculate_wind_speed, wind_power_fraction
from energetica.workshop.demand_block import DAYS_PER_YEAR
from energetica.workshop.facilities import FacilityId
from energetica.workshop.seasons import MIDDLE_WEEK_START, SEASON_DAYS, SEASONS, representative_week, season_days
from energetica.workshop.weather import (
    NORMAL_OUTPUT,
    WEATHER_POSITION,
    SeasonWeather,
    capacity_factor,
    closest_run,
    normal_output,
    representative_weather,
)

DAY = 86_400
WIND = FacilityId.ONSHORE_WIND_TURBINE
SOLAR = FacilityId.PV_SOLAR
HYDRO = FacilityId.SMALL_WATER_DAM


def _product(weather: np.ndarray, calendar: np.ndarray) -> np.ndarray:
    return weather * calendar


def test_the_run_picked_gives_the_average_output_closest_to_the_seasons() -> None:
    # Weather rising evenly through the season, so the run centred on the middle of the season matches it best.
    weather = np.linspace(0, 1, SEASON_DAYS).reshape(SEASON_DAYS, 1)

    assert closest_run(weather, np.ones_like(weather), _product) == MIDDLE_WEEK_START


def test_the_run_is_placed_on_the_middle_weeks_calendar() -> None:
    # The middle week's calendar doubles the output, so a run of half the season's weather matches it best.
    weather = np.arange(SEASON_DAYS, dtype=np.float64).reshape(SEASON_DAYS, 1) / 90
    calendar = np.ones_like(weather)
    calendar[MIDDLE_WEEK_START : MIDDLE_WEEK_START + 7] = 2.0
    target = (weather * calendar).mean()

    start = closest_run(weather, calendar, _product)

    # The run's average weather, doubled, is closest to the season's real average output.
    assert start == round(target / 2 * 90 - 3)


def test_the_week_is_the_middle_week_of_the_season() -> None:
    for season in ("spring", "summer", "autumn", "winter"):
        assert representative_week(season) == season_days(season)[42:49]


@pytest.fixture(scope="module")
def spring() -> SeasonWeather:
    return representative_weather(7).season("spring")


def test_the_week_borrows_the_wind_of_its_run_on_its_own_calendar(spring: SeasonWeather) -> None:
    day = representative_week("spring")[2]
    seconds = day * DAY + 15 * 3_600
    borrowed = seconds + (spring.wind_run - MIDDLE_WEEK_START) * DAY

    speed = calculate_wind_speed(WEATHER_POSITION, seconds, 7, DAYS_PER_YEAR, weather_seconds=borrowed)
    assert spring.week(WIND, seconds) == pytest.approx(wind_power_fraction(speed))


def test_the_week_borrows_the_clouds_of_its_run_under_its_own_sun(spring: SeasonWeather) -> None:
    day = representative_week("spring")[4]
    seconds = day * DAY + 12 * 3_600
    borrowed = seconds + (spring.solar_run - MIDDLE_WEEK_START) * DAY

    irradiance = calculate_solar_irradiance(WEATHER_POSITION, seconds, 7, DAYS_PER_YEAR, weather_seconds=borrowed)[0]
    assert spring.week(SOLAR, seconds) == pytest.approx(irradiance / 950)


def test_hydro_borrows_nothing(spring: SeasonWeather) -> None:
    seconds = representative_week("spring")[0] * DAY + 6 * 3_600

    assert spring.week(HYDRO, seconds) == spring.shares(HYDRO, seconds)


def test_the_season_keeps_its_real_average_output(spring: SeasonWeather) -> None:
    days = season_days("spring")
    wind = np.mean([spring.shares(WIND, day * DAY + hour * 3_600) for day in days for hour in range(24)])

    assert spring.average_output.wind == pytest.approx(wind)
    assert 0 < spring.average_output.solar < 1


def test_the_average_output_alone_is_the_seasons(spring: SeasonWeather) -> None:
    assert representative_weather(7).average_output("spring") == spring.average_output


def test_the_normal_output_still_matches_the_weather() -> None:
    # The full 128 seeds take a while, so a few stand in for them. Seasons differ from normal by a few percent,
    # so a change to the weather that moves every season by more than this means NORMAL_OUTPUT needs working out again.
    sample = normal_output(range(8))
    for season in SEASONS:
        assert sample[season].wind == pytest.approx(NORMAL_OUTPUT[season].wind, rel=0.05)
        assert sample[season].solar == pytest.approx(NORMAL_OUTPUT[season].solar, rel=0.05)


def test_the_borrowed_week_matches_the_seasons_average_output(spring: SeasonWeather) -> None:
    week = representative_week("spring")
    wind = np.mean([spring.week(WIND, day * DAY + hour * 3_600) for day in week for hour in range(24)])
    solar = np.mean([spring.week(SOLAR, day * DAY + hour * 3_600) for day in week for hour in range(24)])

    assert wind == pytest.approx(spring.average_output.wind, rel=0.05)
    assert solar == pytest.approx(spring.average_output.solar, rel=0.05)


def test_each_round_has_weather_of_its_own() -> None:
    noon = representative_week("spring")[0] * DAY + 12 * 3_600

    assert representative_weather(7).share(WIND, noon) == representative_weather(7, round_number=1).share(WIND, noon)
    assert representative_weather(7, round_number=1).share(WIND, noon) != representative_weather(
        7, round_number=2
    ).share(WIND, noon)


def test_the_calendar_is_the_same_every_round() -> None:
    # At night there is no sun, whatever the Round's clouds.
    midnight = representative_week("summer")[0] * DAY

    assert representative_weather(7, round_number=3).share(SOLAR, midnight) == 0


def test_winter_weather_runs_on_over_the_new_year() -> None:
    # 1 January is in the middle of winter, so its weather follows on from the same Round's 31 December, a year
    # after the weather of the Round's spring.
    year = DAYS_PER_YEAR * DAY
    new_year = 3 * 3_600

    speed = calculate_wind_speed(WEATHER_POSITION, new_year, 7, DAYS_PER_YEAR, weather_seconds=year + new_year)
    assert representative_weather(7).share(WIND, new_year) == pytest.approx(wind_power_fraction(speed))
    # The last day of winter and the first of the next spring follow on from one another, across Rounds.
    spring = season_days("spring")[0] * DAY
    speed = calculate_wind_speed(WEATHER_POSITION, spring, 7, DAYS_PER_YEAR, weather_seconds=year + spring)
    assert representative_weather(7, round_number=2).share(WIND, spring) == pytest.approx(wind_power_fraction(speed))


@pytest.mark.parametrize("facility", [WIND, SOLAR, HYDRO])
def test_a_renewable_facilitys_capacity_factor_is_a_share_of_its_power(facility: FacilityId) -> None:
    factor = capacity_factor(7, facility)

    assert factor is not None
    assert 0 < factor < 1


def test_the_capacity_factor_is_the_average_output_over_the_year() -> None:
    weather = representative_weather(7)
    seasons = [weather.average_output(season) for season in SEASONS]

    assert capacity_factor(7, WIND) == pytest.approx(sum(output.wind for output in seasons) / len(SEASONS))
    assert capacity_factor(7, SOLAR) == pytest.approx(sum(output.solar for output in seasons) / len(SEASONS))


def test_facilities_of_the_same_kind_share_a_capacity_factor() -> None:
    assert capacity_factor(7, FacilityId.OFFSHORE_WIND_TURBINE) == capacity_factor(7, WIND)
    assert capacity_factor(7, FacilityId.CSP_SOLAR) == capacity_factor(7, SOLAR)


@pytest.mark.parametrize(
    "facility", [FacilityId.COAL_BURNER, FacilityId.NUCLEAR_REACTOR, FacilityId.LITHIUM_ION_BATTERIES]
)
def test_a_facility_that_does_not_follow_the_weather_has_no_capacity_factor(facility: FacilityId) -> None:
    assert capacity_factor(7, facility) is None
