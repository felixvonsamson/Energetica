"""Weather fakes for the Trading-period engine's tests."""

from __future__ import annotations

from dataclasses import dataclass

from energetica.workshop.seasons import MIDDLE_WEEK_START, Season
from energetica.workshop.weather import AverageOutput, SeasonWeather, Shares


@dataclass(frozen=True)
class FixedWeather:
    """Weather that gives each renewable ``shares(facility, seconds)`` in every season. The representative week
    borrows nothing, unless ``week`` gives it shares of its own.
    """

    shares: Shares
    week: Shares | None = None
    average_output: AverageOutput = AverageOutput(wind=0.5, solar=0.5)

    def season(self, season: Season, /) -> SeasonWeather:
        return SeasonWeather(
            shares=self.shares,
            week=self.week or self.shares,
            average_output=self.average_output,
            wind_run=MIDDLE_WEEK_START,
            solar_run=MIDDLE_WEEK_START,
        )


def steady(share: float) -> FixedWeather:
    """Weather under which every renewable produces ``share`` of its power all the time."""
    return FixedWeather(lambda _facility, _seconds: share)
