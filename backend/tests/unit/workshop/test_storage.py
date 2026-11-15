"""The energy a Workshop player's storage holds, and what happens to it when storage retires (#1001)."""

from __future__ import annotations

import pytest

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.storage import energy_at_risk, keep_what_fits, storage_capacity

# Lithium-ion batteries last 1 Round, hydrogen storage 3 (#975). Neither has a construction lag.
LITHIUM = FacilityId.LITHIUM_ION_BATTERIES
SOLID_STATE = FacilityId.SOLID_STATE_BATTERIES
HYDROGEN = FacilityId.HYDROGEN_STORAGE


def _capacity(facility: FacilityId) -> float:
    capacity = CATALOG[facility].base_storage_capacity
    assert capacity is not None
    return capacity


LITHIUM_CAPACITY = _capacity(LITHIUM)
HYDROGEN_CAPACITY = _capacity(HYDROGEN)


def _owned(facility: FacilityId, built_round: int, count: int = 1) -> list[OwnedFacility]:
    return [OwnedFacility(facility=facility, built_round=built_round)] * count


def test_capacity_adds_up_every_operating_facility_of_a_type() -> None:
    owned = [*_owned(HYDROGEN, 1, count=2), *_owned(LITHIUM, 2)]

    assert storage_capacity(HYDROGEN, owned, current_round=2) == 2 * HYDROGEN_CAPACITY


def test_a_retired_facility_holds_nothing() -> None:
    assert storage_capacity(LITHIUM, _owned(LITHIUM, 1), current_round=2) == 0


def test_energy_that_still_fits_the_type_is_not_at_risk() -> None:
    # One of three hydrogen tanks retires, and the two left hold what all three did.
    owned = [*_owned(HYDROGEN, 1), *_owned(HYDROGEN, 2, count=2)]
    stored = {HYDROGEN: 2 * HYDROGEN_CAPACITY}

    assert energy_at_risk(stored, owned, [], current_round=4) == {}


def test_energy_beyond_the_capacity_left_is_at_risk() -> None:
    stored = {LITHIUM: 1.5 * LITHIUM_CAPACITY}

    assert energy_at_risk(stored, _owned(LITHIUM, 1, count=3), [], current_round=2) == {LITHIUM: 1.5 * LITHIUM_CAPACITY}


def test_the_selection_takes_energy_out_of_risk() -> None:
    stored = {LITHIUM: 1.5 * LITHIUM_CAPACITY}

    assert energy_at_risk(stored, _owned(LITHIUM, 1, count=3), [LITHIUM], current_round=2) == {
        LITHIUM: 0.5 * LITHIUM_CAPACITY
    }
    assert energy_at_risk(stored, _owned(LITHIUM, 1, count=3), [LITHIUM, LITHIUM], current_round=2) == {}


def test_the_upgrade_tier_does_not_take_another_types_energy() -> None:
    stored = {LITHIUM: LITHIUM_CAPACITY}
    owned = [*_owned(LITHIUM, 1), *_owned(SOLID_STATE, 2)]

    assert energy_at_risk(stored, owned, [SOLID_STATE], current_round=2) == {LITHIUM: LITHIUM_CAPACITY}


def test_energy_that_fits_is_kept_whole() -> None:
    # Three batteries held 150 of their 300: two new ones hold the same 150, at 75%.
    stored = {LITHIUM: 1.5 * LITHIUM_CAPACITY}

    assert keep_what_fits(stored, _owned(LITHIUM, 2, count=2), current_round=2) == stored


def test_energy_beyond_the_capacity_is_lost() -> None:
    # Three batteries held 150 of their 300: one new one fills up at 100, and 50 is lost.
    stored = {LITHIUM: 1.5 * LITHIUM_CAPACITY}

    assert keep_what_fits(stored, _owned(LITHIUM, 2), current_round=2) == {LITHIUM: pytest.approx(LITHIUM_CAPACITY)}


def test_a_type_left_with_no_capacity_loses_all_its_energy() -> None:
    stored = {LITHIUM: LITHIUM_CAPACITY, HYDROGEN: HYDROGEN_CAPACITY}

    assert keep_what_fits(stored, [*_owned(LITHIUM, 1), *_owned(HYDROGEN, 1)], current_round=2) == {
        HYDROGEN: HYDROGEN_CAPACITY
    }
