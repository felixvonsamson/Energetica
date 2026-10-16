"""Workshop's synthetic demand: six demand bids standing in for the country's consumers (#992 §1).

Workshop has no consumers among its players, so the market's demand side is built here. Each
settlement period, the nominal demand is

    nominal_demand = amplitude x shape_factor

where the shape factor comes from the :class:`DemandCurve`: French national consumption over a
whole 364-day year, one value per 15 minutes, with its weekday and weekend pattern (#1201). That
nominal demand is split into six stacked tiers, from must-serve down to opportunistic, each bid
into the shared ``clear_market`` as its own :class:`~energetica.sim.market.MarketEntry`. The tier
widths sum to 165% of nominal demand on purpose: the extra is latent demand that only shows up
when power is cheap.

Each tier bids under a reserved negative ``player_id`` and carries its label in the entry's
``facility`` field, so a clearing's demand side reads like any other and needs no new dump shape.

Pure: no players, no state, no I/O. ``unserved`` and ``Fill.unmet`` on the resulting clearing are
how a blackout is detected (an unmet must-serve tier), and are never shown to players as a
number. In that case the clearing price is ``math.inf``, the must-serve bid, so the Trading-period
engine settles nothing from that clearing on (#1005).

``amplitude`` is a free per-Round number. This module only knows its Round-1 baseline. In later Rounds,
natural demand growth moves it (:mod:`~energetica.workshop.demand_growth`, #1226), and the demand-shift
events move it on top of that (#1012).
"""

from __future__ import annotations

import math
import pickle
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Sequence

from energetica.sim.market import MarketEntry

#: Workshop's seasonal cycle is a year of 364 days, so each season is exactly 13 weeks (#1004).
DAYS_PER_YEAR = 364

#: The nominal demand each player brings to the session's Round-1 amplitude, in W. A placeholder until the
#: game-balance pass (#1145).
PER_PLAYER_BASE_AMPLITUDE = 50e6


_DATA_DIR = Path(__file__).parent / "data"


@dataclass(frozen=True, slots=True)
class DemandTier:
    """One slice of nominal demand and the most it will pay per MWh."""

    label: str  # carried in ``MarketEntry.facility``
    share: float  # fraction of nominal demand
    willingness_to_pay: float  # €/MWh
    player_id: int  # reserved, negative, so it can never be a real player's id


#: The tier structure (six tiers, these shares, this price order) is locked by the spec. The €/MWh
#: figures below must-serve are placeholders until game-balance tuning.
DEMAND_TIERS: tuple[DemandTier, ...] = (
    DemandTier("must_serve", 0.80, math.inf, -1),
    DemandTier("low_flex", 0.10, 480, -2),
    DemandTier("medium_flex", 0.15, 240, -3),
    DemandTier("high_flex", 0.20, 120, -4),
    DemandTier("very_high_flex", 0.20, 24, -5),
    DemandTier("opportunistic", 0.20, 5, -6),
)


@dataclass(frozen=True, slots=True)
class SettlementPeriod:
    """One market clearing within a simulated day."""

    day: int  # day of the year, counted from 0
    clearing: int  # which clearing within that day, counted from 0
    clearings_per_day: int  # the Round's market-clearing frequency: 24, 96 or 288

    def __post_init__(self) -> None:
        """Reject a clearing index that falls outside its day."""
        if not 0 <= self.clearing < self.clearings_per_day:
            raise ValueError(f"clearing {self.clearing} is outside a day of {self.clearings_per_day} clearings")


@dataclass(frozen=True, slots=True)
class DemandCurve:
    """How demand varies over Workshop's year, as a factor that averages about 1.

    ``values`` covers the whole 364-day year in equal steps, with the same number of values for each day. Value 0
    is midnight at the start of day 0, which is a Monday, so every seventh day is a Monday and the weekends fall
    on days 5 and 6 of each week. The year repeats, so the last value leads back to the first.
    """

    values: Sequence[float]

    def __post_init__(self) -> None:
        """Reject a curve that does not give each day of the year the same number of values."""
        if not self.values or len(self.values) % DAYS_PER_YEAR:
            raise ValueError(f"a demand curve needs a whole number of values per day, not {len(self.values)}")

    def factor(self, period: SettlementPeriod) -> float:
        """The curve at the start of ``period``, interpolated in a straight line between its two nearest values."""
        values_per_day = len(self.values) // DAYS_PER_YEAR
        # Where the period starts, in steps of the curve, as a whole number of steps and a remainder. Integer
        # arithmetic keeps the index exact when the clearings line up with the curve's steps.
        index, remainder = divmod(
            (period.day * period.clearings_per_day + period.clearing) * values_per_day, period.clearings_per_day
        )
        fraction = remainder / period.clearings_per_day
        start = self.values[index % len(self.values)]
        end = self.values[(index + 1) % len(self.values)]
        return start * (1 - fraction) + end * fraction


@cache
def national_demand_curve() -> DemandCurve:
    """Load the national demand curve. Read from disk once, then shared.

    It is RTE (French grid operator) national consumption, averaged over 2018, 2019 and 2021 with the years lined
    up so day 0 is a Monday, and not smoothed: 364 x 96 values, one per 15 minutes. It ships as package data in
    ``workshop/data/`` (see ``package-data`` in pyproject.toml). The notebook that makes it is described in #1201.
    """
    with open(_DATA_DIR / "national_demand_year_15min.pck", "rb") as file:
        return DemandCurve(tuple(float(value) for value in pickle.load(file)))


def round_one_amplitude(per_player_base_amplitude: float, headcount: int) -> float:
    """The amplitude a session starts from. Headcount applies here once, not again every Round."""
    return per_player_base_amplitude * headcount


def nominal_demand(amplitude: float, curve: DemandCurve, period: SettlementPeriod) -> float:
    """Demand in W for one settlement period: ``amplitude`` shaped by the curve at the period's time of the year."""
    return amplitude * curve.factor(period)


def build_demand_block(amplitude: float, curve: DemandCurve, period: SettlementPeriod) -> list[MarketEntry]:
    """The six demand bids for one settlement period, ready to pass to ``clear_market``."""
    demand = nominal_demand(amplitude, curve, period)
    return [
        MarketEntry(tier.player_id, demand * tier.share, tier.willingness_to_pay, tier.label) for tier in DEMAND_TIERS
    ]
