"""Unit tests for the pure dispatch limits (#1099). No ``Player`` and no engine."""

from __future__ import annotations

import math

import pytest

from energetica.sim.dispatch import fuel_power_limit, max_output, min_output, ramping_speed, storage_power_limit


def test_ramping_speed_is_the_share_of_power_that_fits_in_a_tick() -> None:
    # A 100 MW facility that ramps over 10 minutes, in a 60 second tick, moves 10 MW per tick.
    assert ramping_speed(100, 600, 60) == pytest.approx(10)


def test_fuel_limit_is_unbounded_without_a_fuel() -> None:
    assert fuel_power_limit(100, []) == math.inf


def test_fuel_limit_scales_the_available_fuel_to_power() -> None:
    # Full power burns 4 units per tick, so 1 unit of fuel supports a quarter of 100 MW.
    assert fuel_power_limit(100, [(4, 1)]) == pytest.approx(25)


def test_fuel_limit_follows_the_scarcest_fuel() -> None:
    assert fuel_power_limit(100, [(4, 4), (2, 1)]) == pytest.approx(50)


def test_fuel_limit_is_zero_when_a_fuel_has_run_out_and_negative_when_overdrawn() -> None:
    assert fuel_power_limit(100, [(4, 0)]) == 0
    assert fuel_power_limit(100, [(4, -1)]) < 0


def test_storage_limit_converts_energy_to_the_power_it_can_sustain() -> None:
    # 1 MWh over a 3600 s tick is 1 MW, and a perfectly efficient store with a huge ramp is not ramp limited.
    assert storage_power_limit(1, 1.0, 1e9, 3600) == pytest.approx(1)


def test_storage_limit_is_cut_by_the_one_way_efficiency() -> None:
    assert storage_power_limit(1, 0.64, 1e9, 3600) == pytest.approx(0.8)


def test_storage_limit_leaves_room_to_ramp_down() -> None:
    # With ramp 2 the sustainable power is sqrt(2 * energy_capacity * ramp), below the energy capacity itself.
    assert storage_power_limit(8, 1.0, 2, 3600) == pytest.approx(math.sqrt(2 * 8 * 2))


def test_storage_limit_is_zero_when_empty_or_overfull() -> None:
    assert storage_power_limit(0, 0.9, 10, 60) == 0
    assert storage_power_limit(-5, 0.9, 10, 60) == 0


def test_max_output_is_the_tightest_of_resources_ramping_and_power() -> None:
    assert max_output(resource_limit=5, previous_output=10, ramping_speed=10, power=100) == 5
    assert max_output(resource_limit=50, previous_output=10, ramping_speed=10, power=100) == 20
    assert max_output(resource_limit=50, previous_output=95, ramping_speed=10, power=100) == 50
    assert max_output(resource_limit=500, previous_output=95, ramping_speed=10, power=100) == 100


def test_min_output_is_what_the_facility_cannot_ramp_down_below() -> None:
    assert min_output(resource_limit=500, previous_output=30, ramping_speed=10, power=100) == 20
    assert min_output(resource_limit=15, previous_output=30, ramping_speed=10, power=100) == 15


def test_min_output_is_never_negative() -> None:
    assert min_output(resource_limit=500, previous_output=5, ramping_speed=10, power=100) == 0
    assert min_output(resource_limit=-3, previous_output=30, ramping_speed=10, power=100) == 0
