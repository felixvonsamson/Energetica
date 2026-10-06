"""The facilities a Workshop player owns (#998).

The session buys them (#999) and retires each one at the end of its lifetime (#1000). This module
says what a player owns, how long each facility has left, whether it operates in a given Round, how
much it ran, and the O&M it owes for a Trading period (#1000).
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import NamedTuple

from pydantic import BaseModel, ConfigDict

from energetica.sim.operating_cost import operating_cost
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.seasons import SEASONS


class OwnedFacility(BaseModel):
    """One facility a player owns."""

    model_config = ConfigDict(frozen=True)

    facility: FacilityId
    built_round: int


class LifetimeLeft(NamedTuple):
    """How long an owned facility has left."""

    rounds: int
    """Rounds it still works for, counting the current one. Zero once it is past its lifetime."""
    under_construction: bool
    """True while its construction lag runs. It then keeps its whole lifetime."""


def lifetime_left(owned: OwnedFacility, *, current_round: int) -> LifetimeLeft:
    """How long ``owned`` has left in ``current_round``.

    A facility built in Round ``b`` with a construction lag of ``L`` Rounds works from Round ``b + L``
    for ``lifetime_rounds`` Rounds. Nothing in it changes during a Round, so the current Round counts
    as one of those left.
    """
    facility = CATALOG[owned.facility]
    first_working_round = owned.built_round + facility.construction_lag_rounds
    if current_round < first_working_round:
        return LifetimeLeft(rounds=facility.lifetime_rounds, under_construction=True)
    rounds = first_working_round + facility.lifetime_rounds - current_round
    return LifetimeLeft(rounds=max(rounds, 0), under_construction=False)


def is_operating(owned: OwnedFacility, *, current_round: int) -> bool:
    """Whether ``owned`` works in ``current_round``: its construction lag is over and its lifetime is not.

    Only an operating facility produces power or owes O&M.
    """
    left = lifetime_left(owned, current_round=current_round)
    return not left.under_construction and left.rounds > 0


def capacity_factor(owned: OwnedFacility, production: Sequence[float]) -> float:
    """How much of its maximum output ``owned`` produced on average, from 0 to 1.

    ``production`` is its output in W, sampled at evenly spaced time steps. For storage, that is the
    power it discharges. Raises :class:`ValueError` if it is empty, or if a sample is below zero or
    above the facility's maximum output, which would mean the caller simulated it wrongly.
    """
    if not production:
        raise ValueError("a capacity factor needs at least one production sample")
    maximum = CATALOG[owned.facility].base_power_generation
    if not all(0 <= sample <= maximum for sample in production):
        raise ValueError(f"{owned.facility} produced outside 0 to its maximum of {maximum} W")
    return sum(production) / len(production) / maximum


def om_owed(owned: OwnedFacility, *, current_round: int, production: Sequence[float]) -> float:
    """The O&M ``owned`` owes for one Trading period of ``current_round``, in which it produced ``production``.

    ``production`` is its output in W over the period, sampled at evenly spaced time steps. Nothing is
    owed while it is not operating. Otherwise it owes its share of ``om_per_round`` for one period: the
    fixed share, plus the rest scaled by its :func:`capacity_factor` (#992 §6). Nothing charges this
    yet: the Trading-period engine (#1003) will, once it knows how much each facility produced.
    """
    if not is_operating(owned, current_round=current_round):
        return 0.0
    facility = CATALOG[owned.facility]
    return operating_cost(
        facility.om_per_round / len(SEASONS), facility.om_fixed_share, capacity_factor(owned, production)
    )
