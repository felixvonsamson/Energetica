"""Unit tests for the pure operating-cost formula (#1101). No ``Player`` and no engine."""

from __future__ import annotations

import pytest

from energetica.enums import ControllableFacilityType
from energetica.sim.operating_cost import fixed_cost_share, operating_cost


def test_a_facility_whose_cost_does_not_scale_with_use_owes_all_of_it() -> None:
    assert fixed_cost_share("windmill", scales_with_use=False) == 1.0


def test_nuclear_reactors_owe_half_regardless_of_use() -> None:
    assert fixed_cost_share("nuclear_reactor", scales_with_use=True) == 0.5
    assert fixed_cost_share("nuclear_reactor_gen4", scales_with_use=True) == 0.5


def test_other_facilities_that_scale_with_use_owe_a_fifth() -> None:
    assert fixed_cost_share("coal_burner", scales_with_use=True) == 0.2


def test_facility_enum_members_are_recognised_as_nuclear() -> None:
    """The persistent world passes enum members, which must match the plain names."""
    assert fixed_cost_share(ControllableFacilityType.NUCLEAR_REACTOR, scales_with_use=True) == 0.5


def test_an_idle_facility_owes_only_the_fixed_share() -> None:
    assert operating_cost(100, fixed_share=0.2, utilisation=0) == pytest.approx(20)


def test_a_facility_at_full_use_owes_the_whole_cost() -> None:
    assert operating_cost(100, fixed_share=0.2, utilisation=1) == pytest.approx(100)


def test_the_variable_part_scales_with_utilisation() -> None:
    assert operating_cost(100, fixed_share=0.2, utilisation=0.5) == pytest.approx(60)


def test_an_all_fixed_cost_ignores_utilisation() -> None:
    assert operating_cost(100, fixed_share=1.0, utilisation=0) == 100
    assert operating_cost(100, fixed_share=1.0, utilisation=0.7) == pytest.approx(100)
