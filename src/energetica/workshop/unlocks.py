"""Which facilities a Workshop session offers its players (#998).

A player only ever sees a facility once it is available, so each unlock comes as a surprise. Every
session starts with the base tier of each category (#975). Upgrades unlock once the session's
cumulative investment in their base tier crosses a threshold (#1011), and Concentrated solar power at a
set Round (#975). Those tickets add that state here.

Storage follows the Round's storage lever (#1004): none, batteries only, or every type. Hydrogen storage
and pumped hydro are offered only with every type, which needs the full-season format. If the moderator
switches back, players keep the ones they built, but cannot buy more.
"""

from __future__ import annotations

from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, WorkshopFacility
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

#: The storage offered only when the storage lever allows every type.
FULL_SEASON_STORAGE: frozenset[FacilityId] = frozenset({FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO})


def _allowed(facility: WorkshopFacility, storage: StorageAvailability) -> bool:
    """Whether the storage lever ``storage`` lets players buy ``facility``. Generation is always allowed."""
    if facility.base_storage_capacity is None:
        return True
    if storage == "batteries":
        return facility.category == FacilityCategory.BATTERIES
    return storage == "all"


def available_facilities(storage: StorageAvailability) -> list[WorkshopFacility]:
    """The facilities players can see and buy now, with the storage lever at ``storage``, in catalog order."""
    return [
        facility
        for facility in CATALOG.values()
        if (facility.id in STARTING_FACILITIES or facility.id in FULL_SEASON_STORAGE) and _allowed(facility, storage)
    ]
