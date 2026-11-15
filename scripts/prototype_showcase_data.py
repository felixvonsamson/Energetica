"""PROTOTYPE (#1462), throwaway: dump the facility-card showcase's demo data from the backend catalog.

Run from the repo root: .venv/bin/python scripts/prototype_showcase_data.py
"""

import json
import sys

from energetica.workshop.facilities import (
    CATALOG,
    full_output_per_season,
    om_fixed_per_season,
    om_variable_per_mwh,
    session_price,
)
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, FUEL_USE
from energetica.workshop.weather import capacity_factor, expected_generation

FACILITIES = ["pv_solar", "offshore_wind_turbine", "lithium_ion_batteries", "nuclear_reactor", "coal_burner"]
ROUND_COUNT = 5
WEATHER_SEED = 0

out = []
for facility_id in FACILITIES:
    facility = CATALOG[facility_id]
    price = session_price(facility_id, ROUND_COUNT)
    out.append(
        {
            **facility.model_dump(mode="json", exclude={"base_price"}),
            "base_price": price,
            "price": price,
            "fuel_use": FUEL_USE.get(facility_id),
            "capacity_factor": capacity_factor(WEATHER_SEED, facility_id),
            "om_fixed_per_season": om_fixed_per_season(facility),
            "om_variable_per_mwh": om_variable_per_mwh(facility),
            "full_output_per_season": full_output_per_season(facility),
            "expected_generation": expected_generation(facility_id),
        }
    )
json.dump({"facilities": out, "fuel_prices": CATALOG_FUEL_PRICES}, sys.stdout, indent=4)
print()
