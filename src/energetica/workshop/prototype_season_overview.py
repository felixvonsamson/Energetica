"""PROTOTYPE (#1399), throwaway: the data behind the full-season review prototypes.

- A season overview: each simulated day's market energy by facility type, and its price.
- Any range of days at full resolution, in the same shape as a week (``WorkshopPeriodWeekOut``).

Not for main. See the prototype branch ``prototype/1399-season-overview``.
"""

from __future__ import annotations

import warnings

import numpy as np
from pydantic import BaseModel

from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.schemas import (
    WorkshopPeriodWeekOut,
    WorkshopPoolSeriesOut,
    WorkshopTierSeriesOut,
    _finite_or_none,
)


STRIP_POINTS_PER_DAY = 8


class PrototypeFacilityDailyOut(BaseModel):
    facility: str
    energy: list[float]
    """Wh the whole market's pools of this type generated each day."""


class PrototypeSeasonOverviewOut(BaseModel):
    days: list[int]
    price_mean: list[float | None]
    """Each day's average price, per MWh."""
    price_min: list[float | None]
    price_max: list[float | None]
    demand: list[float]
    """Wh the demand tiers were served each day."""
    facilities: list[PrototypeFacilityDailyOut]
    strip_points_per_day: int
    """How many points each day has in ``strip``."""
    strip: list[PrototypeFacilityDailyOut]
    """The market's average power (W) of each facility type, ``strip_points_per_day`` points a day, in ``energy``."""
    hourly_price: list[float | None]
    """The average price of each hour of the season."""

    @classmethod
    def from_record(cls, record: TradingPeriodRecord) -> PrototypeSeasonOverviewOut:
        cpd = record.clearings_per_day
        day_count = len(record.days)
        hours = 24 / cpd

        def per_day(values: np.ndarray) -> np.ndarray:
            return values.reshape(*values.shape[:-1], day_count, cpd)

        mean, low, high = _price_stats(record, day_count, cpd)
        energy_by_type: dict[str, np.ndarray] = {}
        generation = per_day(record.generation).sum(axis=2) * hours
        for row, (_, facility) in enumerate(record.pools):
            energy_by_type[facility] = energy_by_type.get(facility, 0) + generation[row]
        # About 8 points a day: 3-hour averages.
        per_point = max(1, cpd // STRIP_POINTS_PER_DAY)
        strip_points = cpd // per_point
        fine = (
            record.generation[:, : day_count * strip_points * per_point]
            .reshape(len(record.pools), day_count * strip_points, per_point)
            .mean(axis=2)
        )
        strip_by_type: dict[str, np.ndarray] = {}
        for row, (_, facility) in enumerate(record.pools):
            strip_by_type[facility] = strip_by_type.get(facility, 0) + fine[row]
        return cls(
            strip_points_per_day=strip_points,
            strip=[
                PrototypeFacilityDailyOut(facility=facility, energy=power.tolist())
                for facility, power in strip_by_type.items()
            ],
            hourly_price=_finite_or_none(_price_stats(record, day_count * 24, cpd // 24)[0].tolist()),
            days=list(record.days),
            price_mean=_finite_or_none(mean.tolist()),
            price_min=_finite_or_none(low.tolist()),
            price_max=_finite_or_none(high.tolist()),
            demand=(per_day(record.served).sum(axis=(0, 2)) * hours).tolist(),
            facilities=[
                PrototypeFacilityDailyOut(facility=facility, energy=energy.tolist())
                for facility, energy in energy_by_type.items()
            ],
        )


def days_out(record: TradingPeriodRecord, first_day: int, count: int) -> WorkshopPeriodWeekOut:
    """``count`` days from ``first_day`` (the day's position in the period), at every settlement point."""
    cpd = record.clearings_per_day
    first_day = max(0, min(first_day, len(record.days) - 1))
    count = max(1, min(count, len(record.days) - first_day))
    start = first_day * cpd
    points = slice(start, start + count * cpd)
    return WorkshopPeriodWeekOut(
        week=0,
        days=list(record.days[first_day : first_day + count]),
        first_point=start,
        price=_finite_or_none(record.price[points].tolist()),
        quantity=_finite_or_none(record.quantity[points].tolist()),
        pools=[
            WorkshopPoolSeriesOut(
                player_id=player_id,
                facility=facility,  # type: ignore[arg-type]
                generation=record.generation[row, points].tolist(),
                dumped=record.dumped[row, points].tolist(),
                charged=record.charged[row, points].tolist(),
                stored=record.stored[row, points].tolist(),
                storage_capacity=float(record.storage_capacity[row]),
            )
            for row, (player_id, facility) in enumerate(record.pools)
        ],
        tiers=[
            WorkshopTierSeriesOut(tier=tier, served=record.served[row, points].tolist())
            for row, tier in enumerate(record.tiers)
        ],
    )


def _price_stats(record: TradingPeriodRecord, groups: int, size: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The average, lowest and highest price over ``groups`` runs of ``size`` points."""
    price = record.price.astype(float).reshape(groups, size)
    price = np.where(np.isfinite(price), price, np.nan)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(price, axis=1), np.nanmin(price, axis=1), np.nanmax(price, axis=1)
