"""Compare ways of compressing a season against full-season ground truth (#1164).

For every (seed, season), clear the market on the full 91 days and on each method's plan, with the same
players, and record each player's operating profit, blackout, and the plan's weather.

    .venv/bin/python -B prototypes/rep_day_1164/evaluate.py --seeds 32 --out /tmp/e1164/run.json
"""

from __future__ import annotations

import argparse
import json
import multiprocessing
import os
import sys
import time
from contextlib import contextmanager
from pathlib import Path

# Import this checkout's game code and the modules next to this file, not whatever the venv points at.
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parents[2] / "src"))

from energetica.sim.market import MarketEntry
from energetica.sim.national_demand import DemandCurve, national_demand_curve
from energetica.workshop import trading
from energetica.workshop.demand_block import SettlementPeriod
from energetica.workshop.facilities import CATALOG, FacilityId as F
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.fuel import CATALOG_FUEL_PRICES
from energetica.workshop.prices import DEFAULT_PRICES, PriceSheet
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import SEASONS

from conditions import DAY, SeasonConditions, season_conditions
from energetica.workshop.day_matching import matched_day, matched_days
from methods import Plan, closest_day, latin_three, middle_day, shipped, stitched_day

POOL_YEARS = 11  # the season itself plus 10 extra years of weather
CLEARINGS = 24
ROUND = 2  # each facility is built just in time to operate in this Round

# Merit order at roughly marginal fuel cost per MWh (fuel use × catalog fuel price): renewables at 0 so they
# always sell before dumping, nuclear 44, CCGT 182, gas burner 247, coal burner 288. Batteries buy when
# renewables or nuclear set the price and sell just under the CCGT, so they cycle.
SELL = {
    F.ONSHORE_WIND_TURBINE: 0.0,
    F.OFFSHORE_WIND_TURBINE: 0.0,
    F.PV_SOLAR: 0.0,
    F.NUCLEAR_REACTOR: 50.0,
    F.COMBINED_CYCLE: 200.0,
    F.GAS_BURNER: 270.0,
    F.COAL_BURNER: 300.0,
    F.LITHIUM_ION_BATTERIES: 190.0,
}
BUY = {F.LITHIUM_ION_BATTERIES: 60.0}

PLAYERS: dict[str, list[F]] = {
    "wind+peaker": [F.ONSHORE_WIND_TURBINE] * 6 + [F.GAS_BURNER] * 4,
    "wind+battery": [F.OFFSHORE_WIND_TURBINE, F.LITHIUM_ION_BATTERIES],
    "solar+ccgt": [F.PV_SOLAR] * 2 + [F.COMBINED_CYCLE],
    "nuclear": [F.NUCLEAR_REACTOR],
    "gas+coal": [F.COMBINED_CYCLE] * 2 + [F.COAL_BURNER],
}
AMPLITUDE = 50e6 * len(PLAYERS)
# Share of its capacity each storage type holds when a simulation starts. The game carries the charge over from
# the previous Trading period, so an empty start overstates how much a representative day's storage buys.
INITIAL_CHARGE = float(os.environ.get("INITIAL_CHARGE", "0"))
CYCLIC = os.environ.get("CYCLIC", "1") == "1"
WARM_PASSES = int(os.environ.get("WARM_PASSES", "6"))

METHODS = [
    middle_day,
    closest_day(1),
    latin_three(1),
    closest_day(POOL_YEARS),
    latin_three(POOL_YEARS),
    stitched_day(3),
    shipped(matched_day),
    shipped(matched_days),
]


def _bidders(stored: dict[int, dict] | None = None) -> list[trading.Bidder]:
    prices = PriceSheet(sell={**DEFAULT_PRICES.sell, **SELL}, buy={**DEFAULT_PRICES.buy, **BUY})
    return [
        trading.Bidder(
            player_id=index,
            owned_facilities=[
                OwnedFacility(facility=f, built_round=ROUND - CATALOG[f].construction_lag_rounds) for f in fleet
            ],
            prices=prices,
            stored_energy=stored[index]
            if stored is not None
            else {
                f: INITIAL_CHARGE * (CATALOG[f].base_storage_capacity or 0.0) * fleet.count(f)
                for f in set(fleet)
                if CATALOG[f].base_storage_capacity
            },
            fuel=None,
        )
        for index, fleet in enumerate(PLAYERS.values(), start=1)
    ]


@contextmanager
def _plan_hooks(c: SeasonConditions, plan: Plan):
    """Make the engine simulate one host day per plan day, with each clearing's demand taken from its source."""
    original_days, original_block = trading.simulated_days, trading.build_demand_block

    def days(*_: object) -> list[int]:
        return list(range(len(plan)))

    def block(amplitude: float, curve: DemandCurve, period: SettlementPeriod) -> list[MarketEntry]:
        _year, season_day = plan[period.day][period.clearing]
        return original_block(amplitude, curve, SettlementPeriod(c.days[season_day], period.clearing, CLEARINGS))

    trading.simulated_days, trading.build_demand_block = days, block
    try:
        yield
    finally:
        trading.simulated_days, trading.build_demand_block = original_days, original_block


def _weather(c: SeasonConditions, plan: Plan):
    step = DAY / CLEARINGS

    def weather(facility: F, seconds: float) -> float:
        host, clearing = int(seconds // DAY), round((seconds % DAY) / step)
        year, season_day = plan[host][clearing]
        return c.share(CATALOG[facility].category, year, season_day, clearing)

    return weather


def _profit(result: trading.TradingResult) -> float:
    money = sum(p.revenue - p.dump_cost - p.purchase_cost for p in result.facilities.values())
    fuel = sum(
        p.fuel_burned * CATALOG_FUEL_PRICES[CATALOG[f].fuel_type]
        for f, p in result.facilities.items()
        if CATALOG[f].fuel_type
    )
    return money - fuel


def _simulate(c: SeasonConditions, plan: Plan, stored: dict[int, dict] | None):
    with _plan_hooks(c, plan):
        return trading.simulate_trading_period(
            _bidders(stored),
            round_number=ROUND,
            season=c.season,  # type: ignore[arg-type]
            round_format=RoundFormat(clearings_per_day=CLEARINGS),
            amplitude=AMPLITUDE,
            curve=national_demand_curve(),
            weather=_weather(c, plan),
        )


def _run(c: SeasonConditions, plan: Plan, passes: int | None = None) -> dict:
    # Cyclic storage: run the plan once to find the charge it ends with, then again starting from that charge,
    # so storage starts each simulated stretch the way it would after a stretch of the same conditions.
    # The catalog's battery holds 37 hours at full power, so reaching that charge can take several passes.
    stored = None
    for _ in range((WARM_PASSES if passes is None else passes) if CYCLIC else 0):
        warm = _simulate(c, plan, stored)
        stored = {pid: warm.stored_energy.get(pid, {}) for pid in range(1, len(PLAYERS) + 1)}
    outcome = _simulate(c, plan, stored)
    names = list(PLAYERS)
    shares = [[c.wind[y, d, k], c.pv[y, d, k]] for day in plan for k, (y, d) in enumerate(day)]
    return {
        "profit": {names[pid - 1]: _profit(r) for pid, r in outcome.results.items()},
        "blackout": outcome.blackout,
        "wind_cf": sum(s[0] for s in shares) / len(shares),
        "pv_cf": sum(s[1] for s in shares) / len(shares),
        "sources": [sorted({tuple(map(int, s)) for s in day}) for day in plan] if len(plan) < 10 else None,
    }


def evaluate(job: tuple[int, str]) -> dict:
    seed, season = job
    c = season_conditions(seed, season, POOL_YEARS, CLEARINGS)
    truth_plan = [[(0, d)] * CLEARINGS for d in range(len(c.days))]
    row = {"seed": seed, "season": season, "truth": _run(c, truth_plan, passes=1)}
    for method in METHODS:
        row[method.__name__] = _run(c, method(c))
    return row


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=int, default=8)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    jobs = [(seed, season) for seed in range(args.seeds) for season in SEASONS]
    start = time.time()
    with multiprocessing.Pool() as pool:
        rows = []
        for i, row in enumerate(pool.imap_unordered(evaluate, jobs), 1):
            rows.append(row)
            print(f"{i}/{len(jobs)} {time.time() - start:.0f}s", file=sys.stderr, flush=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(rows))


if __name__ == "__main__":
    main()
