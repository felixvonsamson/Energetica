"""Workshop's synthetic demand: six demand bids standing in for the country's consumers (#992 §1).

Workshop has no consumers among its players, so the market's demand side is built here. Each
settlement period, the nominal demand is

    nominal_demand = amplitude x seasonal_factor x intraday_factor

with the shape from :func:`~energetica.sim.demand_shape.demand_shape_factor`, unchanged. That
nominal demand is split into six stacked tiers, from must-serve down to opportunistic, each bid
into the shared ``clear_market`` as its own :class:`~energetica.sim.market.MarketEntry`. The tier
widths sum to 165% of nominal demand on purpose: the extra is latent demand that only shows up
when power is cheap.

Each tier bids under a reserved negative ``player_id`` and carries its label in the entry's
``facility`` field, so a clearing's demand side reads like any other and needs no new dump shape.

Pure: no players, no state, no I/O. ``unserved`` and ``Fill.unmet`` on the resulting clearing are
how a blackout will be detected (an unmet must-serve tier), and are never shown to players as a
number. In that case the clearing price is ``math.inf``, the must-serve bid, so a blackout period
must not be settled as a normal one.

``amplitude`` is a free per-Round number. This module only knows its Round-1 baseline. How it moves
in later Rounds is open: the demand-shift events are specified, but the "player progression"
channel the spec mentions never got a formula (#992, Further Notes).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from energetica.sim.demand_shape import demand_shape_factor
from energetica.sim.market import MarketEntry
from energetica.sim.national_demand import DemandCurve

#: Workshop's seasonal cycle is a real calendar year, so a season is 365/4 days (#992 §2).
DAYS_PER_YEAR = 365

#: The nominal demand each player brings to the session's Round-1 amplitude, in W. A placeholder until the
#: game-balance pass (#1145).
PER_PLAYER_BASE_AMPLITUDE = 50e6


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


def round_one_amplitude(per_player_base_amplitude: float, headcount: int) -> float:
    """The amplitude a session starts from. Headcount applies here once, not again every Round."""
    return per_player_base_amplitude * headcount


def nominal_demand(amplitude: float, curve: DemandCurve, period: SettlementPeriod) -> float:
    """Demand in W for one settlement period: ``amplitude`` shaped by the curve's season and time of day."""
    real_t = period.day * period.clearings_per_day + period.clearing
    shape = demand_shape_factor(curve.intraday, curve.seasonal, period.clearings_per_day, DAYS_PER_YEAR, real_t)
    return amplitude * shape


def build_demand_block(amplitude: float, curve: DemandCurve, period: SettlementPeriod) -> list[MarketEntry]:
    """The six demand bids for one settlement period, ready to pass to ``clear_market``."""
    demand = nominal_demand(amplitude, curve, period)
    return [
        MarketEntry(tier.player_id, demand * tier.share, tier.willingness_to_pay, tier.label) for tier in DEMAND_TIERS
    ]
