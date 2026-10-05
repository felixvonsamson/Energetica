"""Which facilities a Workshop session offers its players (#998).

A player only ever sees a facility once it is available, so each unlock comes as a surprise. Every
session starts with the base tier of each category (#975). Upgrades unlock once the session's
cumulative investment in their base tier crosses a threshold (#1011), Concentrated solar power at a
set Round (#975), and hydrogen storage and pumped hydro when the full-season format is switched on
(#1004). Those tickets add that state here. Until then a session offers only its starting facilities.
"""

from __future__ import annotations

from energetica.workshop.facilities import CATALOG, FacilityId, WorkshopFacility

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


def available_facilities() -> list[WorkshopFacility]:
    """The facilities players can see and buy now, in catalog order."""
    return [facility for facility in CATALOG.values() if facility.id in STARTING_FACILITIES]
