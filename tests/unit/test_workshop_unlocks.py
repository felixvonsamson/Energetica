"""Which facilities a Workshop session offers, and how the storage lever changes them (#998, #1004)."""

from __future__ import annotations

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.prices import is_storage
from energetica.workshop.round_format import StorageAvailability
from energetica.workshop.unlocks import available_facilities


def _offered(storage: StorageAvailability) -> set[FacilityId]:
    return {facility.id for facility in available_facilities(storage)}


def test_batteries_only_offers_the_starting_facilities() -> None:
    assert FacilityId.LITHIUM_ION_BATTERIES in _offered("batteries")
    assert FacilityId.HYDROGEN_STORAGE not in _offered("batteries")
    assert FacilityId.PUMPED_HYDRO not in _offered("batteries")


def test_no_storage_offers_no_storage_at_all() -> None:
    assert not any(is_storage(facility) for facility in _offered("off"))


def test_every_storage_type_adds_hydrogen_storage_and_pumped_hydro() -> None:
    assert _offered("all") == _offered("batteries") | {FacilityId.HYDROGEN_STORAGE, FacilityId.PUMPED_HYDRO}


def test_the_storage_lever_leaves_generation_alone() -> None:
    generation = {facility for facility in _offered("batteries") if not is_storage(facility)}

    assert {facility for facility in _offered("off") if not is_storage(facility)} == generation
    assert {facility for facility in _offered("all") if not is_storage(facility)} == generation


def test_facilities_are_offered_in_catalog_order() -> None:
    order = list(CATALOG)

    offered = [facility.id for facility in available_facilities("all")]

    assert offered == sorted(offered, key=order.index)
