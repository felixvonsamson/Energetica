"""Unit tests for the pure fuel and pollution formulas (#1100). No ``Player`` and no engine."""

from __future__ import annotations

import pytest

from energetica.sim.fuel_and_pollution import emissions_produced, fuel_burned


def test_fuel_burned_is_proportional_to_output() -> None:
    assert fuel_burned(80, 25, 100) == pytest.approx(20)
    assert fuel_burned(80, 100, 100) == pytest.approx(80)


def test_no_output_burns_no_fuel() -> None:
    assert fuel_burned(80, 0, 100) == 0


def test_emissions_are_proportional_to_output() -> None:
    assert emissions_produced(400, 50, 200) == pytest.approx(100)


def test_no_output_emits_nothing() -> None:
    assert emissions_produced(400, 0, 200) == 0
