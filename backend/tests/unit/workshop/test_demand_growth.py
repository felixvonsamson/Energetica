"""Unit tests for Workshop's natural demand growth (#1226): how much demand grows from one Round to the next."""

from __future__ import annotations

import pytest

from energetica.workshop.demand_growth import (
    BASE_GROWTH,
    MAX_PERFORMANCE,
    MIN_PERFORMANCE,
    TARGET_ROUND_PROFIT,
    growth_factor,
    growth_through,
)


def test_a_room_on_target_grows_by_the_base_growth() -> None:
    assert growth_factor(TARGET_ROUND_PROFIT) == pytest.approx(1 + BASE_GROWTH)


def test_a_room_that_earns_more_grows_more() -> None:
    assert growth_factor(1.5 * TARGET_ROUND_PROFIT) > growth_factor(TARGET_ROUND_PROFIT) > growth_factor(1e6)


def test_a_room_that_earns_little_or_loses_money_still_grows_a_little() -> None:
    least = 1 + BASE_GROWTH * MIN_PERFORMANCE
    assert growth_factor(0.0) == pytest.approx(least)
    assert growth_factor(-50e6) == pytest.approx(least)


def test_growth_is_capped_for_a_room_that_earns_a_lot() -> None:
    assert growth_factor(100 * TARGET_ROUND_PROFIT) == pytest.approx(1 + BASE_GROWTH * MAX_PERFORMANCE)


def test_growth_compounds_from_round_to_round() -> None:
    growth = {2: 1.3, 3: 1.5}
    assert growth_through(growth, 1) == 1.0
    assert growth_through(growth, 2) == pytest.approx(1.3)
    assert growth_through(growth, 3) == pytest.approx(1.3 * 1.5)
    # A Round with no factor yet has not grown.
    assert growth_through(growth, 4) == pytest.approx(1.3 * 1.5)
