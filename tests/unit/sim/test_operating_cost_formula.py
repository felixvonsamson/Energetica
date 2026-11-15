"""Unit tests for the pure operating-cost formula (#1101). No ``Player`` and no engine."""

from __future__ import annotations

import pytest

from energetica.sim.operating_cost import operating_cost


def test_an_idle_facility_owes_only_the_fixed_share() -> None:
    assert operating_cost(100, fixed_share=0.2, utilisation=0) == pytest.approx(20)


def test_a_facility_at_full_use_owes_the_whole_cost() -> None:
    assert operating_cost(100, fixed_share=0.2, utilisation=1) == pytest.approx(100)


def test_the_variable_part_scales_with_utilisation() -> None:
    assert operating_cost(100, fixed_share=0.2, utilisation=0.5) == pytest.approx(60)


def test_an_all_fixed_cost_ignores_utilisation() -> None:
    assert operating_cost(100, fixed_share=1.0, utilisation=0) == 100
    assert operating_cost(100, fixed_share=1.0, utilisation=0.7) == pytest.approx(100)
