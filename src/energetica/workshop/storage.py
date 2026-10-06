"""The energy a Workshop player's storage holds, and what happens to it when storage retires (#1001).

Storage facilities of one type share a single amount of stored energy, the same way their power is
pooled: the Trading-period engine (#1003) runs all of a player's facilities of a type as one, scaled
by how many there are. Their state of charge is that energy over their combined capacity.

When some of a type retire, the energy stays with the type and only its capacity shrinks. Whatever no
longer fits is lost when the Investment phase closes, unless the player builds more of that same type
in it. Energy never moves to another type, not even the upgrade tier of the same category (#992 §6).
Nothing pays for lost energy.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility, is_operating


def _unit_capacity(facility: FacilityId) -> float:
    """The energy one ``facility`` holds, in Wh. Zero if it is not storage."""
    return CATALOG[facility].base_storage_capacity or 0.0


def storage_capacity(facility: FacilityId, owned_facilities: Iterable[OwnedFacility], *, current_round: int) -> float:
    """The energy every operating ``facility`` in ``owned_facilities`` holds together in ``current_round``, in Wh."""
    return sum(
        _unit_capacity(owned.facility)
        for owned in owned_facilities
        if owned.facility == facility and is_operating(owned, current_round=current_round)
    )


def energy_at_risk(
    stored_energy: Mapping[FacilityId, float],
    owned_facilities: Iterable[OwnedFacility],
    selection: Iterable[FacilityId],
    *,
    current_round: int,
) -> dict[FacilityId, float]:
    """The energy of each storage type that fits neither its facilities nor the selection, in Wh.

    This is what the player loses when the Investment phase of ``current_round`` closes, unless they
    select more of that type. A type with nothing at risk is left out.
    """
    owned_facilities, selection = list(owned_facilities), list(selection)
    at_risk = {}
    for facility, energy in stored_energy.items():
        capacity = storage_capacity(facility, owned_facilities, current_round=current_round) + selection.count(
            facility
        ) * _unit_capacity(facility)
        if energy > capacity:
            at_risk[facility] = energy - capacity
    return at_risk


def keep_what_fits(
    stored_energy: Mapping[FacilityId, float], owned_facilities: Iterable[OwnedFacility], *, current_round: int
) -> dict[FacilityId, float]:
    """``stored_energy`` with each type's energy cut down to its capacity in ``current_round``.

    A type left with no energy is left out.
    """
    owned_facilities = list(owned_facilities)
    kept = {
        facility: min(energy, storage_capacity(facility, owned_facilities, current_round=current_round))
        for facility, energy in stored_energy.items()
    }
    return {facility: energy for facility, energy in kept.items() if energy > 0}
