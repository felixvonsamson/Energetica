#!.venv/bin/python
"""The levelized cost of electricity (LCOE) of each Workshop generator, with and without the carbon tax (#1227).

LCOE is everything a facility costs over its lifetime, divided by the energy it generates over that lifetime:

    LCOE = (price + O&M + fuel + carbon tax) / energy generated

The carbon tax counts both the CO₂ emitted to build the facility and the CO₂ it emits generating. What the session
hands back to players from the tax takings is left out, since it does not depend on what the player owns.

Two commands:

    .venv/bin/python scripts/workshop_lcoe.py calculate    # worked out from the catalog and the weather's averages
    .venv/bin/python scripts/workshop_lcoe.py simulate     # measured with the Trading-period engine

``calculate`` takes each renewable's capacity factor from the weather model: the normal season output for wind and
solar, and a year of the river table for hydro. Facilities that burn fuel are shown at full output and at half
output, since how much they run depends on the market.

``simulate`` runs one facility of each type through every Round of its lifetime, in full-season mode, for several
weather seeds. It sells at the price floor into a demand far larger than its output, so it always runs as much as
the weather allows, and a backstop bidder keeps the grid up. O&M, fuel burned and CO₂ emitted are read from the
engine's results.
"""

from __future__ import annotations

import argparse
import statistics
import sys
from dataclasses import dataclass

from energetica.workshop.demand_block import DAYS_PER_YEAR, DemandCurve
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, WorkshopFacility
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, FUEL_USE
from energetica.workshop.prices import DEFAULT_PRICES, PRICE_CEILING, PRICE_FLOOR
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import SEASONS
from energetica.workshop.trading import Bidder, simulate_trading_period
from energetica.workshop.votes import CARBON_TAX_RATE
from energetica.workshop.weather import NORMAL_OUTPUT, RunWeather

HOURS_PER_ROUND = DAYS_PER_YEAR * 24
GENERATORS = [facility for facility in CATALOG.values() if facility.base_storage_capacity is None]
WEATHER_DEPENDENT = {FacilityCategory.WIND, FacilityCategory.PV, FacilityCategory.CSP, FacilityCategory.HYDRO}


@dataclass(frozen=True)
class Lcoe:
    """One facility's LCOE, per MWh, and the capacity factor it was worked out at."""

    capacity_factor: float
    without_tax: float
    with_tax: float


def fuel_cost_per_mwh(facility: WorkshopFacility) -> float:
    if facility.fuel_type is None:
        return 0.0
    return FUEL_USE[facility.id] * CATALOG_FUEL_PRICES[facility.fuel_type]


def lcoe(facility: WorkshopFacility, capacity_factor: float) -> Lcoe:
    """The LCOE of ``facility`` running at ``capacity_factor`` for its whole lifetime."""
    rounds = facility.lifetime_rounds
    mwh = facility.base_power_generation / 1e6 * HOURS_PER_ROUND * capacity_factor * rounds
    om = facility.om_per_round * (facility.om_fixed_share + (1 - facility.om_fixed_share) * capacity_factor) * rounds
    without_tax = (facility.base_price + om) / mwh + fuel_cost_per_mwh(facility)
    tax = CARBON_TAX_RATE * (facility.base_construction_pollution / mwh + facility.base_pollution)
    return Lcoe(capacity_factor, without_tax, without_tax + tax)


def hydro_capacity_factor() -> float:
    """A year of the river table, sampled hourly. Hydro follows no random weather."""
    weather = RunWeather(seed=0)
    shares = [weather.share(FacilityId.SMALL_WATER_DAM, hour * 3_600.0) for hour in range(HOURS_PER_ROUND)]
    return statistics.fmean(shares)


def weather_capacity_factor(facility: WorkshopFacility, hydro: float) -> float:
    match facility.category:
        case FacilityCategory.WIND:
            return statistics.fmean(NORMAL_OUTPUT[season].wind for season in SEASONS)
        case FacilityCategory.PV | FacilityCategory.CSP:
            return statistics.fmean(NORMAL_OUTPUT[season].solar for season in SEASONS)
        case _:
            return hydro


def _row(facility: WorkshopFacility, result: Lcoe) -> str:
    return f"| {facility.name} | {result.capacity_factor:.0%} | {result.without_tax:,.0f} | {result.with_tax:,.0f} |"


def calculate(_: argparse.Namespace) -> None:
    hydro = hydro_capacity_factor()
    rows = []
    for facility in GENERATORS:
        if facility.category in WEATHER_DEPENDENT:
            rows.append((facility, lcoe(facility, weather_capacity_factor(facility, hydro))))
        else:
            rows.append((facility, lcoe(facility, 1.0)))
            rows.append((facility, lcoe(facility, 0.5)))
    print("| Facility | Capacity factor | LCOE without tax | LCOE with tax |")
    print("|---|---:|---:|---:|")
    for facility, result in sorted(rows, key=lambda row: row[1].without_tax):
        print(_row(facility, result))


# --- simulate --------------------------------------------------------------------------------------------------

_FLAT = DemandCurve((1.0,) * DAYS_PER_YEAR)
# Far more demand than any one facility makes, so all its output sells.
_AMPLITUDE = 2_000e6
# Enough gas burners priced at the ceiling to cover the must-serve demand whatever the facility under test does.
_BACKSTOP_COUNT = 40


def simulate_lifetime(facility: WorkshopFacility, seed: int) -> tuple[float, float, float, float, float]:
    """Energy generated (MWh), O&M, fuel cost, CO₂ emitted generating (kg) and the average capacity factor, over the
    lifetime of one ``facility`` built so that it works from Round 1.
    """
    built = 1 - facility.construction_lag_rounds
    tested = Bidder(
        player_id=1,
        owned_facilities=[OwnedFacility(facility=facility.id, built_round=built)],
        prices=DEFAULT_PRICES.with_price(facility.id, "sell", PRICE_FLOOR),
        stored_energy={},
    )
    mwh = om = fuel = emissions = 0.0
    factors = []
    for round_number in range(1, facility.lifetime_rounds + 1):
        weather = RunWeather(seed, round_number)
        backstop = Bidder(
            player_id=2,
            owned_facilities=[OwnedFacility(facility=FacilityId.GAS_BURNER, built_round=round_number)]
            * _BACKSTOP_COUNT,
            prices=DEFAULT_PRICES.with_price(FacilityId.GAS_BURNER, "sell", PRICE_CEILING),
            stored_energy={},
        )
        for season in SEASONS:
            outcome = simulate_trading_period(
                [tested, backstop],
                round_number=round_number,
                season=season,
                round_format=RoundFormat(trading_format="full_season"),
                amplitude=_AMPLITUDE,
                curve=_FLAT,
                weather=weather,
            )
            assert not outcome.blackouts
            performance = outcome.results[1].facilities[facility.id]
            mwh += performance.generation / 1e6
            om += performance.om
            fuel += performance.fuel_burned * CATALOG_FUEL_PRICES[facility.fuel_type] if facility.fuel_type else 0.0
            emissions += performance.emissions
            factors.append(performance.capacity_factor)
    return mwh, om, fuel, emissions, statistics.fmean(factors)


def simulate(args: argparse.Namespace) -> None:
    print("| Facility | Capacity factor | LCOE without tax | LCOE with tax | Spread across seeds (without tax) |")
    print("|---|---:|---:|---:|---:|")
    rows = []
    for facility in GENERATORS:
        without, with_tax, factors = [], [], []
        for seed in range(args.seeds):
            mwh, om, fuel, emissions, factor = simulate_lifetime(facility, seed)
            cost = facility.base_price + om + fuel
            tax = CARBON_TAX_RATE * (facility.base_construction_pollution + emissions)
            without.append(cost / mwh)
            with_tax.append((cost + tax) / mwh)
            factors.append(factor)
        rows.append((facility, statistics.fmean(factors), without, with_tax))
        print(f"  done: {facility.name}", file=sys.stderr, flush=True)
    for facility, factor, without, with_tax in sorted(rows, key=lambda row: statistics.fmean(row[2])):
        print(
            f"| {facility.name} | {factor:.0%} | {statistics.fmean(without):,.0f} | {statistics.fmean(with_tax):,.0f} "
            f"| {min(without):,.0f} to {max(without):,.0f} |"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("calculate")
    simulate_parser = commands.add_parser("simulate")
    simulate_parser.add_argument("--seeds", type=int, default=8, help="how many weather seeds to average over")
    args = parser.parse_args()
    {"calculate": calculate, "simulate": simulate}[args.command](args)


if __name__ == "__main__":
    main()
