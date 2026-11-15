"""The facility-card showcase's demo data (#1482): generated from the Workshop backend and checked in."""

from __future__ import annotations

from pathlib import Path

from energetica.workshop.facilities import CATALOG, FacilityId, session_price
from energetica.workshop.session import DEFAULT_ROUND_COUNT
from energetica.workshop.showcase import SHOWCASE_DATA_PATH, render_showcase_data, showcase_facilities

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_the_checked_in_showcase_data_is_up_to_date() -> None:
    checked_in = (REPO_ROOT / SHOWCASE_DATA_PATH).read_text()
    assert checked_in == render_showcase_data(), (
        f"{SHOWCASE_DATA_PATH} is stale. Run `bun run generate-showcase-data` and commit the result."
    )


def test_the_showcase_shows_the_five_facilities_of_the_old_screenshot_in_order() -> None:
    assert [facility.id for facility in showcase_facilities()] == [
        FacilityId.PV_SOLAR,
        FacilityId.OFFSHORE_WIND_TURBINE,
        FacilityId.LITHIUM_ION_BATTERIES,
        FacilityId.NUCLEAR_REACTOR,
        FacilityId.COAL_BURNER,
    ]


def test_a_showcase_facility_costs_its_price_for_the_default_session_length_with_no_price_shock() -> None:
    for facility in showcase_facilities():
        assert facility.base_price == session_price(facility.id, DEFAULT_ROUND_COUNT)
        assert facility.price == facility.base_price


def test_the_showcase_keeps_the_catalog_figures() -> None:
    nuclear = next(facility for facility in showcase_facilities() if facility.id == FacilityId.NUCLEAR_REACTOR)
    catalog = CATALOG[FacilityId.NUCLEAR_REACTOR]
    assert nuclear.lifetime_rounds == catalog.lifetime_rounds
    assert nuclear.base_power_generation == catalog.base_power_generation
