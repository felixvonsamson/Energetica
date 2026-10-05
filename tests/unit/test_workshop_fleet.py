"""How long each facility a Workshop player owns has left (#998)."""

from __future__ import annotations

from energetica.workshop.facilities import FacilityId
from energetica.workshop.fleet import OwnedFacility, lifetime_left

# An onshore wind turbine has no construction lag and lasts 2 Rounds. A nuclear reactor takes one
# Round to build and lasts 8 (#975).


def test_a_facility_works_from_the_round_it_is_built_in() -> None:
    wind = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=2)

    assert lifetime_left(wind, current_round=2) == (2, False)


def test_each_round_that_passes_uses_up_one_round_of_lifetime() -> None:
    wind = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=2)

    assert lifetime_left(wind, current_round=3) == (1, False)


def test_a_facility_past_its_lifetime_has_none_left() -> None:
    wind = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=2)

    assert lifetime_left(wind, current_round=4) == (0, False)


def test_a_facility_under_construction_keeps_its_whole_lifetime() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    assert lifetime_left(reactor, current_round=3) == (8, True)


def test_a_facility_starts_using_its_lifetime_once_its_construction_lag_is_over() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    assert lifetime_left(reactor, current_round=4) == (8, False)
    assert lifetime_left(reactor, current_round=11) == (1, False)
