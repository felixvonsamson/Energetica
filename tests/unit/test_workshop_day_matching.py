"""Choosing the days that stand for a season (#1164)."""

from __future__ import annotations

import itertools

import pytest

from energetica.workshop.day_matching import DayConditions, matched_day, matched_days


def _day(wind: float, sun: float = 0.2, demand: float = 1.0) -> DayConditions:
    return DayConditions(wind=wind, sun=sun, demand=demand)


def test_a_matched_day_is_the_day_closest_to_the_season_average() -> None:
    days = [_day(0.0), _day(0.9), _day(0.4), _day(0.1)]  # average wind 0.35

    assert matched_day(days) == [2]


def test_a_matched_day_weighs_misses_relative_to_the_average() -> None:
    # Day 0 misses wind by 0.05 of 0.5 (10%), day 1 misses sun by 0.05 of 0.1 (50%).
    days = [_day(0.45, sun=0.1), _day(0.5, sun=0.15), _day(0.55, sun=0.05), _day(0.5, sun=0.1)]

    assert matched_day(days) == [3]


def test_matched_days_take_one_day_from_each_third_by_wind_and_each_third_by_sun() -> None:
    # A 3×3 grid of thirds, four days in each cell, so every Latin square is possible.
    levels = [0.1, 0.5, 0.9]
    days = [_day(wind, sun) for wind, sun in itertools.product(levels, levels) for _ in range(4)]

    chosen = matched_days(days)

    assert sorted({days[index].wind for index in chosen}) == levels
    assert sorted({days[index].sun for index in chosen}) == levels


def test_matched_days_average_to_the_season_when_three_days_can() -> None:
    days = [_day(wind, sun) for wind, sun in itertools.product([0.1, 0.2, 0.5, 0.6, 0.8, 0.8], [0.1, 0.3, 0.5])]

    chosen = matched_days(days)

    assert sum(days[index].wind for index in chosen) / 3 == pytest.approx(0.5)
    assert sum(days[index].sun for index in chosen) / 3 == pytest.approx(0.3)


def test_matched_days_are_in_order() -> None:
    days = [_day(0.9, 0.1), _day(0.1, 0.5), _day(0.5, 0.9), _day(0.1, 0.1), _day(0.5, 0.5), _day(0.9, 0.9)]

    chosen = matched_days(days)

    assert chosen == sorted(chosen)
    assert len(set(chosen)) == 3


def test_matched_days_split_tied_days_into_thirds() -> None:
    assert len(matched_days([_day(0.3)] * 9)) == 3
