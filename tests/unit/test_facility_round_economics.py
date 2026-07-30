"""Unit tests for the facility round-economics seam (issue #874, S2).

The point of the seam is that ``Config.facility_round_economics`` is a pure
translation of fields ``energetica/config/assets.py`` already carries
(``lifespan``, ``base_construction_time``, ``O&M_factor_per_day``) into
round units given an arbitrary ``seconds_per_round`` -- no new data, no
Workshop-specific state.
"""

from __future__ import annotations

import pytest

from energetica.config.assets import Config, const_config
from energetica.enums import ControllableFacilityType, FunctionalFacilityType, TechnologyType

ONE_IN_GAME_DAY = 86400


def test_translates_seconds_into_rounds_for_a_one_day_round() -> None:
    """With a round the length of one in-game day, lifetime/lag land in the same
    units the raw config already documents them in (days), and the O&M fraction
    passes through unchanged.
    """
    economics = Config.facility_round_economics(ControllableFacilityType.STEAM_ENGINE, ONE_IN_GAME_DAY)

    steam_engine = const_config["assets"]["steam_engine"]
    assert economics.lifetime_rounds == steam_engine["lifespan"] / ONE_IN_GAME_DAY
    assert economics.construction_lag_rounds == steam_engine["base_construction_time"] / ONE_IN_GAME_DAY
    assert economics.om_fraction_of_price_per_round == pytest.approx(steam_engine["O&M_factor_per_day"])


def test_om_fraction_scales_with_round_length() -> None:
    """A round twice as long accrues twice the O&M fraction per round."""
    short_round = Config.facility_round_economics(ControllableFacilityType.STEAM_ENGINE, ONE_IN_GAME_DAY)
    long_round = Config.facility_round_economics(ControllableFacilityType.STEAM_ENGINE, 2 * ONE_IN_GAME_DAY)

    assert long_round.om_fraction_of_price_per_round == pytest.approx(2 * short_round.om_fraction_of_price_per_round)


@pytest.mark.parametrize("facility_type", [FunctionalFacilityType.INDUSTRY, TechnologyType.PHYSICS])
def test_rejects_facility_types_without_round_economics(facility_type: object) -> None:
    """Functional facilities and technologies carry no lifespan/O&M in ``assets.py``,
    so asking for their round economics is a caller bug, not a silent zero.
    """
    with pytest.raises(ValueError, match="no round economics"):
        Config.facility_round_economics(facility_type, ONE_IN_GAME_DAY)
