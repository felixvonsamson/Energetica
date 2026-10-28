"""The figures a Workshop player sees when hovering a facility card's stats (#1400), worked out from the catalog."""

from __future__ import annotations

import pytest

from energetica.workshop.facilities import (
    CATALOG,
    FacilityId,
    full_output_per_season,
    om_fixed_per_season,
    om_variable_per_mwh,
)

COAL_BURNER = CATALOG[FacilityId.COAL_BURNER]


def test_the_fixed_om_is_the_fixed_share_of_a_rounds_om_spread_over_its_four_seasons() -> None:
    # 5M per Round, 20% fixed: 1M a Round, 250k a season.
    assert om_fixed_per_season(COAL_BURNER) == pytest.approx(250_000)


def test_a_season_at_full_output_is_the_power_over_the_seasons_hours() -> None:
    # 35 MW for 13 weeks of 168 hours: 2,184 hours, so 76,440 MWh.
    assert full_output_per_season(COAL_BURNER) == pytest.approx(76_440e6)


def test_the_variable_om_per_mwh_is_the_variable_share_of_a_rounds_om_over_a_round_at_full_output() -> None:
    # 80% of 5M, 4M a Round, over 4 seasons of 76,440 MWh: about 13.08 per MWh.
    assert om_variable_per_mwh(COAL_BURNER) == pytest.approx(13.08, abs=0.01)


def test_a_facility_charged_the_same_whatever_its_use_has_no_variable_om() -> None:
    assert om_variable_per_mwh(CATALOG[FacilityId.PV_SOLAR]) == 0
