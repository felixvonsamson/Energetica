"""The demo data for the facility-card showcase on the landing site's workshop page (#1482).

The showcase draws real facility cards, so their figures come from the backend rather than being written by hand. Each
facility is built the way the facilities route builds it, for a session of the default length, under a fixed weather
seed and with no price shock. ``scripts/generate_showcase_data.py`` (``bun run generate-showcase-data``) writes them to
:data:`SHOWCASE_DATA_PATH`, which is checked in, and a test fails when that copy is stale.

The file is a TypeScript module with ``as const`` rather than JSON: TypeScript reads every string in an imported JSON
file as ``string``, so a facility's ``id`` or ``fuel_type`` would not fit the card's union types.
"""

from __future__ import annotations

import json
from pathlib import PurePosixPath
from typing import Any

from energetica.workshop.facilities import CATALOG, FacilityId, session_price
from energetica.workshop.fuel import CATALOG_FUEL_PRICES
from energetica.workshop.schemas import WorkshopFacilityOut
from energetica.workshop.session import DEFAULT_ROUND_COUNT

#: Where the generated module lives, from the repository root.
SHOWCASE_DATA_PATH = PurePosixPath("frontend/apps/landing/src/lib/facility-showcase.generated.ts")

#: The facilities the showcase shows, in order: those of the screenshot it replaces.
SHOWCASE_FACILITIES = (
    FacilityId.PV_SOLAR,
    FacilityId.OFFSHORE_WIND_TURBINE,
    FacilityId.LITHIUM_ION_BATTERIES,
    FacilityId.NUCLEAR_REACTOR,
    FacilityId.COAL_BURNER,
)

#: The weather the renewables' capacity factors are worked out under. Any seed would do; it is fixed so the data only
#: changes when the catalog or the weather model does.
SHOWCASE_WEATHER_SEED = 0

#: How many significant digits each number keeps. The weather-derived figures come out of NumPy, whose last digits can
#: differ between machines; rounding keeps the file the same everywhere, and nine digits is far more than a card shows.
SIGNIFICANT_DIGITS = 9


def showcase_facilities() -> list[WorkshopFacilityOut]:
    """The showcase's facilities as the facilities route would serve them in a session of the default length, with no
    price shock, so each one's ``price`` is its ``base_price``.
    """
    return [
        WorkshopFacilityOut.from_catalog(
            CATALOG[facility],
            price_round_count=DEFAULT_ROUND_COUNT,
            price=session_price(facility, DEFAULT_ROUND_COUNT),
            for_sale=True,
            weather_seed=SHOWCASE_WEATHER_SEED,
        )
        for facility in SHOWCASE_FACILITIES
    ]


def _rounded(value: Any) -> Any:
    """``value`` with every float in it rounded to :data:`SIGNIFICANT_DIGITS` significant digits."""
    if isinstance(value, float):
        return float(f"{value:.{SIGNIFICANT_DIGITS}g}")
    if isinstance(value, dict):
        return {key: _rounded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_rounded(item) for item in value]
    return value


def render_showcase_data() -> str:
    """The contents of :data:`SHOWCASE_DATA_PATH`: the showcase's facilities and each fuel's catalog price per kg, which
    the cards' fuel-cost tooltip needs.
    """
    facilities = _rounded([facility.model_dump(mode="json") for facility in showcase_facilities()])
    fuel_prices = _rounded({fuel.value: price for fuel, price in CATALOG_FUEL_PRICES.items()})
    return (
        "// Generated from the Workshop backend by `bun run generate-showcase-data`. Do not edit by hand: change the\n"
        "// backend and run it again. `tests/unit/test_workshop_showcase.py` fails when this file is stale (#1482).\n"
        "\n"
        "/** The facilities the workshop page's facility-card showcase draws, in order. */\n"
        f"export const showcaseFacilities = {json.dumps(facilities, indent=4)} as const;\n"
        "\n"
        "/** Each fuel's catalog price per kg, for the cards' fuel-cost tooltip. */\n"
        f"export const showcaseFuelPrices = {json.dumps(fuel_prices, indent=4)} as const;\n"
    )
