"""Which facilities a Workshop session offers its players (#998), and what unlocks more (#1011).

A player only ever sees a facility once it is available, so each unlock comes as a surprise. Every
session starts with the base tier of each category (#975). An upgrade unlocks once the money every
player has spent on its base tier reaches that technology's threshold. The check happens when a Round ends, and the upgrade can be bought from the next Round. Concentrated solar
power has no base tier, so it unlocks from a set Round instead. Hydrogen storage and pumped hydro unlock
the first Round the storage lever allows every type. The session keeps each
:class:`Unlock`, so the Recap can announce it.

Storage follows the Round's storage lever (#1004): none, batteries only, or every type. Hydrogen storage
and pumped hydro are offered only with every type, which needs the full-season format. If the facilitator
switches back, players keep the ones they built, but cannot buy more.
"""

from __future__ import annotations

from collections.abc import Collection, Iterable
from typing import Literal

from pydantic import BaseModel, ConfigDict

from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, WorkshopFacility
from energetica.workshop.fleet import Purchase
from energetica.workshop.player import WORKSHOP_STARTING_BUDGET
from energetica.workshop.round_format import StorageAvailability

STARTING_FACILITIES: frozenset[FacilityId] = frozenset(
    {
        FacilityId.ONSHORE_WIND_TURBINE,
        FacilityId.COAL_BURNER,
        FacilityId.GAS_BURNER,
        FacilityId.SMALL_WATER_DAM,
        FacilityId.NUCLEAR_REACTOR,
        FacilityId.PV_SOLAR,
        FacilityId.LITHIUM_ION_BATTERIES,
    }
)

#: Each base tier and the upgrade that investing in it unlocks (#975).
UPGRADES: dict[FacilityId, FacilityId] = {
    FacilityId.ONSHORE_WIND_TURBINE: FacilityId.OFFSHORE_WIND_TURBINE,
    FacilityId.COAL_BURNER: FacilityId.MODERN_COAL_PLANT,
    FacilityId.GAS_BURNER: FacilityId.COMBINED_CYCLE,
    FacilityId.SMALL_WATER_DAM: FacilityId.LARGE_WATER_DAM,
    FacilityId.NUCLEAR_REACTOR: FacilityId.NUCLEAR_REACTOR_GEN4,
    FacilityId.PV_SOLAR: FacilityId.MULTI_LAYER_PV,
    FacilityId.LITHIUM_ION_BATTERIES: FacilityId.SOLID_STATE_BATTERIES,
}

#: The first Round Concentrated solar power can be bought in. It has no base tier to invest in.
CSP_UNLOCK_ROUND = 3

#: Each base tier's unlock threshold, as a share of every player's starting budget combined. Cheap technologies get a
#: smaller share, so that the room does not need far more of them than it would ever use. At catalog prices, a
#: 6-player room needs 12 coal burners, 15 gas burners, 10 onshore wind turbines, 5 small dams, 3 nuclear reactors,
#: 15 PV solar farms or 15 lithium-ion batteries.
THRESHOLD_SHARES: dict[FacilityId, float] = {
    FacilityId.ONSHORE_WIND_TURBINE: 0.4,
    FacilityId.COAL_BURNER: 0.4,
    FacilityId.GAS_BURNER: 0.4,
    FacilityId.SMALL_WATER_DAM: 0.4,
    FacilityId.NUCLEAR_REACTOR: 0.5,
    FacilityId.PV_SOLAR: 0.3,
    FacilityId.LITHIUM_ION_BATTERIES: 0.15,
}

UnlockTrigger = Literal["investment_threshold", "round_gate", "format_lever"]


class Unlock(BaseModel):
    """A facility becoming available to buy, for the Recap to announce."""

    model_config = ConfigDict(frozen=True)

    facility: FacilityId
    round: int
    """The first Round it can be bought in."""
    trigger: UnlockTrigger


#: The storage offered only when the storage lever allows every type.
FULL_SEASON_STORAGE: frozenset[FacilityId] = frozenset({FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO})


def _allowed(facility: WorkshopFacility, storage: StorageAvailability) -> bool:
    """Whether the storage lever ``storage`` lets players buy ``facility``. Generation is always allowed."""
    if facility.base_storage_capacity is None:
        return True
    if storage == "batteries":
        return facility.category == FacilityCategory.BATTERIES
    return storage == "all"


def available_facilities(storage: StorageAvailability, unlocked: Collection[FacilityId] = ()) -> list[WorkshopFacility]:
    """The facilities players can see and buy now, in catalog order, with the storage lever at ``storage`` and
    ``unlocked`` unlocked.
    """
    return [
        facility
        for facility in CATALOG.values()
        if (facility.id in STARTING_FACILITIES or facility.id in FULL_SEASON_STORAGE or facility.id in unlocked)
        and _allowed(facility, storage)
    ]


def invested(purchases: Iterable[Purchase]) -> dict[FacilityId, float]:
    """The money spent buying each base tier in ``purchases``. Every base tier is listed, even one nobody bought."""
    spent = dict.fromkeys(UPGRADES, 0.0)
    for purchase in purchases:
        if purchase.facility in spent:
            spent[purchase.facility] += purchase.price
    return spent


def unlock_thresholds(player_count: int) -> dict[FacilityId, float]:
    """The spend on each base tier that unlocks its upgrade, in a session of ``player_count`` players."""
    return {base: share * player_count * WORKSHOP_STARTING_BUDGET for base, share in THRESHOLD_SHARES.items()}


def round_end_unlocks(
    *,
    next_round: int,
    spent: dict[FacilityId, float],
    thresholds: dict[FacilityId, float],
    unlocked: Collection[FacilityId],
) -> list[Unlock]:
    """What unlocks when a Round ends, to be bought from ``next_round`` on.

    ``spent`` is the money spent on each base tier so far (:func:`invested`), and ``unlocked`` what has already
    unlocked. An upgrade unlocks once the spend on its base tier reaches that tier's entry in ``thresholds``
    (:func:`unlock_thresholds`), and Concentrated solar power once ``next_round`` reaches :data:`CSP_UNLOCK_ROUND`.
    """
    unlocks = [
        Unlock(facility=upgrade, round=next_round, trigger="investment_threshold")
        for base, upgrade in UPGRADES.items()
        if upgrade not in unlocked and spent[base] > 0 and spent[base] >= thresholds[base]
    ]
    if next_round >= CSP_UNLOCK_ROUND and FacilityId.CSP_SOLAR not in unlocked:
        unlocks.append(Unlock(facility=FacilityId.CSP_SOLAR, round=next_round, trigger="round_gate"))
    return unlocks


def format_lever_unlocks(
    *, round_number: int, storage: StorageAvailability, unlocked: Collection[FacilityId]
) -> list[Unlock]:
    """What unlocks if Round ``round_number`` starts with the storage lever at ``storage``.

    Hydrogen storage and pumped hydro unlock the first time a Round allows every storage type. The session checks
    at the Recap before it, so the Recap can announce them, or when the session starts for Round 1. Whether players
    can buy them still follows each Round's lever (:func:`available_facilities`).
    """
    if storage != "all":
        return []
    return [
        Unlock(facility=facility, round=round_number, trigger="format_lever")
        for facility in CATALOG
        if facility in FULL_SEASON_STORAGE and facility not in unlocked
    ]
