"""The seasons of a Workshop Round (#992). Each Round has one Trading period per season, in this order."""

from __future__ import annotations

from typing import Literal, get_args

from energetica.workshop.demand_block import DAYS_PER_YEAR

Season = Literal["spring", "summer", "autumn", "winter"]
SEASONS: tuple[Season, ...] = get_args(Season)

#: How many days a season has: 13 weeks, a quarter of Workshop's 364-day year.
SEASON_DAYS = DAYS_PER_YEAR // len(SEASONS)

#: The day of the year, counted from 0 on 1 January, that spring starts on: 1 March, in the same calendar
#: as the demand curve. The other seasons follow it.
SPRING_START = 59

WEEK_DAYS = 7

#: The day of its season, counted from 0, that the representative week starts on: the week centred on the
#: season's middle day (#1198).
MIDDLE_WEEK_START = SEASON_DAYS // 2 - WEEK_DAYS // 2


def season_days(season: Season) -> list[int]:
    """The days of the year in ``season``, in order. Winter runs over the end of the year."""
    start = SPRING_START + SEASONS.index(season) * SEASON_DAYS
    return [(start + day) % DAYS_PER_YEAR for day in range(SEASON_DAYS)]


def representative_week(season: Season) -> list[int]:
    """The days of the year of ``season``'s representative week, in order: the middle week of the season."""
    return season_days(season)[MIDDLE_WEEK_START : MIDDLE_WEEK_START + WEEK_DAYS]
