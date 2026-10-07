"""The facilities a Workshop player owns (#998).

Buying one is #999, and retiring one at the end of its lifetime is #1000. This module only says what
a player owns and how long each facility has left.
"""

from __future__ import annotations

from typing import NamedTuple

from pydantic import BaseModel, ConfigDict

from energetica.workshop.facilities import CATALOG, FacilityId


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
