"""PROTOTYPE (#1399), throwaway: the data behind the full-season review prototypes.

- A season overview: each simulated day's market energy by facility type, and its price.
- Any range of days at full resolution, in the same shape as a week (``WorkshopPeriodWeekOut``).

Not for main. See the prototype branch ``prototype/1399-season-overview``.
"""

from __future__ import annotations

import numpy as np
from pydantic import BaseModel

from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.schemas import (
    WorkshopPeriodWeekOut,
    WorkshopPoolSeriesOut,
    WorkshopTierSeriesOut,
    _finite_or_none,
)


class PrototypeFacilityDailyOut(BaseModel):
    facility: str
    energy: list[float]
    """Wh the whole market's pools of this type generated each day."""


class PrototypeSeasonOverviewOut(BaseModel):
    days: list[int]
    price_mean: list[float | None]
    """Each day's price weighted by the power cleared, per MWh."""
    price_min: list[float | None]
    price_max: list[float | None]
    demand: list[float]
    """Wh the demand tiers were served each day."""
    facilities: list[PrototypeFacilityDailyOut]

    @classmethod
    def from_record(cls, record: TradingPeriodRecord) -> PrototypeSeasonOverviewOut:
        cpd = record.clearings_per_day
        day_count = len(record.days)
        hours = 24 / cpd

        def per_day(values: np.ndarray) -> np.ndarray:
            return values.reshape(*values.shape[:-1], day_count, cpd)

        price = per_day(record.price.astype(float))
        quantity = per_day(np.nan_to_num(record.quantity.astype(float)))
        finite = np.where(np.isfinite(price), price, np.nan)
        with np.errstate(invalid="ignore", divide="ignore"):
            weights = np.where(np.isfinite(finite), quantity, 0.0)
            mean = np.nansum(np.nan_to_num(finite) * weights, axis=1) / weights.sum(axis=1)
            mean = np.where(weights.sum(axis=1) > 0, mean, np.nanmean(finite, axis=1))
        energy_by_type: dict[str, np.ndarray] = {}
        generation = per_day(record.generation).sum(axis=2) * hours
        for row, (_, facility) in enumerate(record.pools):
            energy_by_type[facility] = energy_by_type.get(facility, 0) + generation[row]
        return cls(
            days=list(record.days),
            price_mean=_finite_or_none(mean.tolist()),
            price_min=_finite_or_none(np.nanmin(finite, axis=1).tolist()),
            price_max=_finite_or_none(np.nanmax(finite, axis=1).tolist()),
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
