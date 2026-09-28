"""Characterization of the weather that drives wind, solar and hydro output (#1102).

The wind speed, solar irradiance and river flow speed are pure functions of a position, a time in seconds
and a random seed. Changing any of them changes the weather every player experiences, so these tests pin
the values the persistent world produces today at a spread of places, times and seeds. The game year is
72 days long here, and the times below are chosen to fall in different seasons and at different hours.

The values were computed in the environment the game server runs in: x86_64, in UTC. The Perlin noise from
``noise`` is computed in single precision, and its result depends on the processor. On x86_64 and arm64,
wind speed agrees to within one part in a million, which the tolerance below allows for. The cloud-cover
noise behind solar irradiance can differ by far more (30% for one case here), so the solar test runs only on
x86_64.
"""

from __future__ import annotations

import platform

import pytest

from energetica.freeplay.app import create_app
from energetica.freeplay.globals import engine
from energetica.sim.renewables import calculate_river_speed, calculate_solar_irradiance, calculate_wind_speed

DAY = 86_400.0
#: Relative tolerance for values that pass through the single-precision Perlin noise.
NOISE_REL = 1e-6

# (position, seconds, seed, wind speed, (irradiance, clear-sky irradiance, clear-sky index))
WEATHER = [
    ((0.0, 0.0), 0.0, 7, 41.18950095920929, (0.0, 0.0, 0.55)),
    ((0.0, 0.0), 43_200.0, 7, 32.55813402096812, (40.71476796123668, 211.4935736467797, 0.19251066242435977)),
    (
        (0.0, 0.0),
        DAY * 100 + 30_000,
        7,
        23.277858661524935,
        (141.8716380617919, 874.0859449782483, 0.16230856802682303),
    ),
    (
        (3.5, 12.25),
        DAY * 200 + 60_000,
        7,
        0.33911635865726913,
        (0.0, 0.0, 0.7032460302846861),
    ),
    ((-4.0, 25.0), DAY * 300 + 3_600, 123, 28.00908726238791, (0.0, 0.0, 0.17709815379179905)),
    (
        (0.0, 0.0),
        DAY * 350 + 50_000,
        123,
        3.052254864429787,
        (8.746211669955951, 26.74877224166871, 0.32697619131584943),
    ),
]

# (seconds, river flow speed in m/s)
RIVER = [
    (0.0, 0.63),
    (DAY * 10 + 43_200.0, 0.72625),
    (DAY * 200 + 1.0, 0.9274997974537037),
    (DAY * 364 + 80_000.0, 0.5750000000000001),
]


@pytest.fixture(autouse=True)
def _engine() -> None:
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    assert engine.days_per_year == 72, "these values were pinned for a 72-day year"


@pytest.mark.parametrize(("position", "seconds", "seed", "wind", "sun"), WEATHER)
def test_wind_speed(position: tuple[float, float], seconds: float, seed: int, wind: float, sun: tuple) -> None:
    assert calculate_wind_speed(position, seconds, seed, engine.days_per_year) == pytest.approx(wind, rel=NOISE_REL)


@pytest.mark.skipif(
    platform.machine() not in ("x86_64", "AMD64"),
    reason="cloud-cover noise differs by processor; the values were pinned on x86_64, as the game server runs",
)
@pytest.mark.parametrize(("position", "seconds", "seed", "wind", "sun"), WEATHER)
def test_solar_irradiance(position: tuple[float, float], seconds: float, seed: int, wind: float, sun: tuple) -> None:
    assert calculate_solar_irradiance(position, seconds, seed, engine.days_per_year) == pytest.approx(
        sun, rel=NOISE_REL, abs=1e-12
    )


@pytest.mark.parametrize(("seconds", "speed"), RIVER)
def test_river_flow_speed(seconds: float, speed: float) -> None:
    assert calculate_river_speed(seconds, engine.days_per_year) == pytest.approx(speed, rel=1e-12)
