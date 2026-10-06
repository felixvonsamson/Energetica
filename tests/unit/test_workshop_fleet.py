"""How long each facility a Workshop player owns has left (#998), and whether it operates, how much it
ran, and the O&M it owes (#1000).
"""

from __future__ import annotations

import pytest

from energetica.workshop.facilities import FacilityId
from energetica.workshop.fleet import (
    OwnedFacility,
    capacity_factor,
    is_operating,
    lifetime_left,
    om_owed,
)

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


# --- whether a facility is operating (#1000) ------------------------------------------------


def test_a_facility_under_construction_is_not_operating() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    assert not is_operating(reactor, current_round=3)


def test_a_facility_operates_from_its_first_working_round_through_its_last() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    assert all(is_operating(reactor, current_round=r) for r in range(4, 12))


def test_a_facility_past_its_lifetime_is_not_operating() -> None:
    wind = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=2)

    assert not is_operating(wind, current_round=4)


# --- capacity factor and the O&M a facility owes in a Trading period (#1000) ----------------

# A nuclear reactor's maximum output is 167 MW, and its O&M is at most 110,000 a Round, half of it fixed.
# An onshore wind turbine's O&M is at most 15,000 a Round, all of it fixed. A Round has four Trading
# periods, so each period owes a quarter of that.


def test_the_capacity_factor_is_the_average_output_over_the_maximum() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    assert capacity_factor(reactor, [167e6, 0.0, 83.5e6, 83.5e6]) == pytest.approx(0.5)


def test_a_capacity_factor_needs_at_least_one_sample() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    with pytest.raises(ValueError):
        capacity_factor(reactor, [])


@pytest.mark.parametrize("sample", [168e6, -1.0])
def test_a_capacity_factor_rejects_output_outside_zero_and_the_maximum(sample: float) -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    with pytest.raises(ValueError):
        capacity_factor(reactor, [167e6, sample])


def test_a_facility_under_construction_owes_no_om() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    assert om_owed(reactor, current_round=3, production=[0.0, 0.0]) == 0.0


def test_an_operating_facility_owes_a_quarter_of_its_fixed_share_plus_the_rest_scaled_by_use() -> None:
    reactor = OwnedFacility(facility=FacilityId.NUCLEAR_REACTOR, built_round=3)

    # Running at 40%: 110,000 / 4 × (0.5 + 0.5 × 0.4).
    assert om_owed(reactor, current_round=4, production=[66.8e6, 0.0, 133.6e6]) == pytest.approx(19_250)


def test_a_facility_with_only_fixed_om_owes_it_all_even_when_idle() -> None:
    wind = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=2)

    assert om_owed(wind, current_round=3, production=[0.0, 0.0]) == 3_750


def test_a_facility_past_its_lifetime_owes_no_om() -> None:
    wind = OwnedFacility(facility=FacilityId.ONSHORE_WIND_TURBINE, built_round=2)

    assert om_owed(wind, current_round=4, production=[0.0, 0.0]) == 0.0
