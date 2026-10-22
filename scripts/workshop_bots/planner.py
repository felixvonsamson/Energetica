"""How a rational bot decides: the outlook it builds from what it knows, the plants it buys, and its prices.

A bot buys what adds most to its final score. The score counts cash and what plants are still worth at the end, and
cash earns nothing, so a plant is worth buying when what it earns until the end, plus what it is still worth then,
beats its price. Each plant it adds pushes prices down for all its plants, so it buys in small steps and looks again
after each one.
"""

from __future__ import annotations

import dataclasses
import math
from collections import Counter
from collections.abc import Callable, Mapping
from dataclasses import dataclass

import numpy as np

from energetica.workshop.demand_block import PER_PLAYER_BASE_AMPLITUDE
from energetica.workshop.votes import CARBON_TAX_RATE
from forecast import (
    FLEX_TIERS,
    RENEWABLE_PRICE,
    Offer,
    Outlook,
    SeasonOutlook,
    amplitude_seen,
    demand_shape,
    fuel_cost,
    is_storage,
    renewable_power,
    spec,
    typical_shares,
    weather_kind,
)
from market import SEASONS, Ctx

STARTING_BUDGET = 50e6
# A price a bot assumes for anyone's fossil plant it has not seen bid yet.
UNSEEN_FIRM_PRICE = 60.0
# What the bot buys at once, as a share of peak must-serve demand: small, so it sees its own effect on prices.
STEP_SHARE = 0.03


@dataclass
class Beliefs:
    """How a bot sees the future, and how wrong it tends to be."""

    noise: float  # the spread of its forecast errors on demand, as a share
    others_bias: float  # how much more than demand growth it expects the other players to build, as a share
    decay: float  # what an extra plant's profit keeps each Round after this one, as competitors catch up
    year: int  # which typical year of weather it expects
    cover: float = 0.85  # before any trading, the share of their part of the peak it expects each other player to cover
    firm_trust: float = 0.5  # how far it expects the others' fossil and nuclear plants to keep up with demand growth
    reaction: float = 0.0  # for each plant it adds, how many of the same it expects each other player to add


def operating(ctx: Ctx, round_number: int) -> dict[str, int]:
    """How many of each facility type the bot has working in ``round_number``."""
    counts: Counter[str] = Counter()
    for owned in ctx.fleet:
        item = spec(owned["facility"])
        start = owned["built_round"] + item.construction_lag_rounds
        if start <= round_number < start + item.lifetime_rounds:
            counts[owned["facility"]] += 1
    return dict(counts)


def clearings_per_day(ctx: Ctx) -> int:
    return (ctx.session.get("round_format") or {}).get("clearings_per_day") or 24


def fuel_prices(ctx: Ctx) -> dict[str, float]:
    return {fuel: line["price"] for fuel, line in ctx.fuel.items()}


def others_fleets(ctx: Ctx, beliefs: Beliefs) -> dict[int, dict[tuple[int, str], float]]:
    """Each Round's view of the other players' plants: W of each player's fossil and nuclear types, from the merit
    order, and of each renewable type, estimated from its output. Taken from the Round's last season that held."""
    by_round: dict[int, dict[tuple[int, str], float]] = {}
    for round_number in sorted({view.round for view in ctx.history}):
        views = [view for view in ctx.history if view.round == round_number]
        held = [view for view in views if not view.blackout] or views
        fleet: dict[tuple[int, str], float] = {}
        for line in held[-1].offers:
            if line["player_id"] != ctx.me and not is_storage(line["facility"]) and weather_kind(line["facility"]) is None:
                fleet[(line["player_id"], line["facility"])] = line["capacity"]
        estimates: dict[tuple[int, str], list[float]] = {}
        for view in held:
            for key, power in renewable_power(view, ctx.me, operating(ctx, view.round), beliefs.year).items():
                estimates.setdefault(key, []).append(power)
        fleet.update({key: float(np.mean(powers)) for key, powers in estimates.items()})
        by_round[round_number] = fleet
    return by_round


def alive(by_round: Mapping[int, Mapping[tuple[int, str], float]], target: int) -> dict[tuple[int, str], float]:
    """The others' plants still working in Round ``target``. Plants first seen in a Round retire their lifetime later,
    so the bot works out each player's plants by the Round they appeared, as a player reading the record could."""
    working: dict[tuple[int, str], float] = {}
    seen: dict[tuple[int, str], float] = {}
    for round_number in sorted(by_round):
        for key, power in by_round[round_number].items():
            added = power - seen.get(key, 0.0)
            seen[key] = power
            if added > 0 and target <= round_number + spec(key[1]).lifetime_rounds - 1:
                working[key] = working.get(key, 0.0) + added
    return working


def others_offers(
    ctx: Ctx, season: str, cpd: int, shares: Mapping[str, np.ndarray], scale: float, beliefs: Beliefs
) -> list[Offer]:
    """The other players' offers in ``season`` of this Round: their plants still working by then, from the record,
    plus what the bot expects them to build, ``scale`` times what they had."""
    latest = ctx.history[-1]
    points = len(shares["wind"])
    by_round = others_fleets(ctx, beliefs)
    now = by_round[max(by_round)]
    working = now if latest.round == ctx.round else alive(by_round, ctx.round)
    price_of = {(line["player_id"], line["facility"]): line["price"] for line in latest.offers}
    # The others' fossil and nuclear plants may not keep up with demand: how far the bot counts on them is a belief.
    # Plants that retire are not assumed to be replaced: no one can count on that.
    firm_scale = 1 + (scale - 1) * beliefs.firm_trust
    offers: list[Offer] = []
    for (player, facility), power in working.items():
        kind = weather_kind(facility)
        if kind is None:
            built = now.get((player, facility), 0.0) * (firm_scale - 1)
            offers.append(Offer(price_of.get((player, facility), UNSEEN_FIRM_PRICE), np.full(points, power + built)))
        else:
            built = now.get((player, facility), 0.0) * (scale - 1)
            price = price_of.get((player, facility), RENEWABLE_PRICE)
            offers.append(Offer(price, (power + built) * shares[kind], True))
    return offers


def round_one_others(ctx: Ctx, demand_peak: float, points: int, rng, beliefs: Beliefs) -> list[Offer]:
    """Before any trading, the bot guesses how much of their share of the peak each other player covers."""
    cover = max(0.5, rng.gauss(beliefs.cover, 0.1))
    others = ctx.player_count - 1
    return [Offer(UNSEEN_FIRM_PRICE, np.full(points, cover * demand_peak / ctx.player_count)) for _ in range(others)]


def build_outlook(ctx: Ctx, beliefs: Beliefs, rng, *, seasons=SEASONS, tight: frozenset[str] = frozenset()) -> Outlook:
    """The bot's forecast of this Round's seasons, with fresh errors drawn from ``rng``.

    Demand is the amplitude this Round's record shows if a season of it has been traded, or last Round's grown by the
    Recap's forecast. Others' plants are what the latest record shows, grown with demand if that record is from an
    earlier Round, since the others build too. ``tight`` lists seasons the bot expects 10% more demand in.
    """
    cpd = clearings_per_day(ctx)
    this_round = [view for view in ctx.history if view.round == ctx.round]
    last_round = [view for view in ctx.history if view.round == ctx.round - 1]
    error = rng.gauss(0, beliefs.noise)
    if this_round and (amplitude := amplitude_seen(this_round)):
        amplitude *= 1 + error / 3
        others_scale = 1.0
    elif last_round and (amplitude := amplitude_seen(last_round)):
        growth = ctx.growth() * (1 + error)
        amplitude *= growth
        others_scale = max(0.8, growth * (1 + rng.gauss(beliefs.others_bias, beliefs.noise)))
    else:
        amplitude = PER_PLAYER_BASE_AMPLITUDE * ctx.player_count * (1 + error)
        others_scale = None
    taxed = ctx.carbon_tax_on
    # A blackout resets everyone's cash to the starting budget: the bot would lose what it holds above it, and what
    # the rest of the Round would have earned.
    outlook = Outlook(blackout_cost=max(ctx.money - STARTING_BUDGET, 0.0) + STARTING_BUDGET)
    for season in seasons:
        shares = typical_shares(season, cpd, beliefs.year)
        demand = amplitude * demand_shape(season, cpd) * (1.1 if season in tight else 1.0)
        if others_scale is None or not ctx.history:
            others = round_one_others(ctx, float(demand.max()), len(demand), rng, beliefs)
        else:
            others = others_offers(ctx, season, cpd, shares, others_scale, beliefs)
        outlook.seasons.append(SeasonOutlook(season, cpd, demand, others, shares, fuel_prices(ctx), taxed))
    return outlook


# --- investing -----------------------------------------------------------------------------------------------------


@dataclass
class Plan:
    picks: Counter
    gain: float  # what the picks add to the final score, as the bot sees it
    spent: float


PriceRule = Callable[[Mapping[str, int]], dict[str, float]]


def plan_investment(
    ctx: Ctx,
    outlook: Outlook,
    candidates: list[str],
    budget: float,
    beliefs: Beliefs,
    price_rule: PriceRule,
    *,
    hurdle: float = 0.0,
    required: Mapping[str, int] | None = None,
) -> Plan:
    """Buy, step by step, the candidate that adds most to the final score per euro, until none adds more than
    ``hurdle`` per euro or the budget runs out. ``required`` facilities are bought first, whatever they add.
    """
    last_round = ctx.session["round_count"]
    now = Counter(operating(ctx, ctx.round))
    later = Counter(operating(ctx, ctx.round + 1))
    peak = max(float(season.demand.max()) for season in outlook.seasons)
    picks: Counter = Counter()
    left = budget
    gain = 0.0
    profit_cache: dict[tuple, float] = {}
    others = ctx.player_count - 1

    def profit(fleet: Counter, bought: Counter) -> float:
        """The Round's profit with ``fleet``, if the others answer what the bot ``bought`` this Round in kind."""
        key = (tuple(sorted((f, n) for f, n in fleet.items() if n)), tuple(sorted(bought.items())))
        if key not in profit_cache:
            rivals = {f: n * beliefs.reaction * others for f, n in bought.items()}
            profit_cache[key] = outlook.profit(fleet, price_rule(fleet), rivals)
        return profit_cache[key]

    def value(facility: str, count: int) -> float:
        item = spec(facility)
        lag = item.construction_lag_rounds
        # A plant that works from next Round is judged on a market with next Round's fleet, using this Round's
        # forecast as a stand-in for next Round's.
        bought = Counter({f: n for f, n in picks.items() if spec(f).construction_lag_rounds == 0})
        base = now + bought
        if lag:
            bought = Counter(picks)
            base = later + picks
        adding = Counter({facility: count})
        extra = profit(base + adding, bought + adding) - profit(base, bought)
        start = ctx.round + lag
        rounds = max(0, min(item.lifetime_rounds, last_round - start + 1))
        weight = sum(beliefs.decay**k for k in range(lag, lag + rounds))
        left_at_end = min(max(start + item.lifetime_rounds - 1 - last_round, 0), item.lifetime_rounds)
        price = ctx.offered[facility]["price"]
        residual = price * left_at_end / item.lifetime_rounds
        tax = item.base_construction_pollution * CARBON_TAX_RATE if ctx.carbon_tax_on else 0.0
        return extra * weight + count * (residual - price - tax)

    def affordable(facility: str) -> int:
        if facility not in ctx.offered:
            return 0
        room = ctx.room_for(facility) - picks[facility]
        return int(min(room, left // ctx.offered[facility]["price"]))

    for facility, count in (required or {}).items():
        count = min(count, affordable(facility))
        if count > 0:
            gain += value(facility, count)
            picks[facility] += count
            left -= count * ctx.offered[facility]["price"]
    for _ in range(200):
        best: tuple[float, str, int, float] | None = None
        for facility in candidates:
            most = affordable(facility)
            if most <= 0:
                continue
            step = max(1, round(STEP_SHARE * peak / spec(facility).base_power_generation))
            # Bigger steps too: one small step may not be enough to close a gap the forecast shows.
            for count in sorted({min(step * k, most) for k in (1, 2, 4, 8)}):
                added = value(facility, count)
                ratio = added / (count * ctx.offered[facility]["price"])
                if ratio > hurdle and (best is None or ratio > best[0]):
                    best = (ratio, facility, count, added)
        if best is None:
            break
        _, facility, count, added = best
        picks[facility] += count
        left -= count * ctx.offered[facility]["price"]
        gain += added
    return Plan(picks, gain, budget - left)


# --- prices --------------------------------------------------------------------------------------------------------


def cost_plus(ctx: Ctx, markup: float, *, nuclear_margin: float = 5.0) -> PriceRule:
    """Fossil plants at fuel cost (and tax) times ``markup``, nuclear just above fuel cost, renewables low."""
    prices = fuel_prices(ctx)

    def rule(fleet: Mapping[str, int]) -> dict[str, float]:
        out = {}
        for facility in fleet:
            if is_storage(facility):
                continue
            if weather_kind(facility) is not None:
                out[facility] = RENEWABLE_PRICE
            elif spec(facility).category.value == "nuclear":
                out[facility] = round(fuel_cost(facility, prices, taxed=ctx.carbon_tax_on) + nuclear_margin, 1)
            else:
                out[facility] = round(fuel_cost(facility, prices, taxed=ctx.carbon_tax_on) * markup + 1)
        return out

    return rule


def scenarios(season: SeasonOutlook, spread: float) -> list[SeasonOutlook]:
    """The season as forecast, and a looser and a tighter version of it: demand ``spread`` lower and the others'
    plants ``spread`` more, and the other way round."""
    out = [season]
    for sign in (-1, 1):
        others = [Offer(o.price, o.power * (1 - sign * spread), o.must_run, o.owner) for o in season.others]
        out.append(dataclasses.replace(season, demand=season.demand * (1 + sign * spread), others=others, _runs={}))
    return out


def best_response(season: SeasonOutlook, fleet: Mapping[str, int], start: Mapping[str, float], spread: float) -> dict[str, float]:
    """Each fossil or nuclear plant type's price that earns the bot most on average over a looser, the forecast and a
    tighter season, with the others' prices as the record shows them. A price just under what the forecast says the
    market clears at earns most if the forecast is right, and nothing if the market turns out looser, so a bot unsure
    of its forecast prices lower. Tries a ladder of prices, one plant type at a time, twice over.
    """
    cases = scenarios(season, spread)

    def earned(prices: Mapping[str, float]) -> float:
        return sum(case.profit(fleet, prices) for case in cases) / len(cases)

    prices = dict(start)
    firm = [f for f, n in fleet.items() if n > 0 and not is_storage(f) and weather_kind(f) is None]
    for _ in range(2):
        for facility in firm:
            cost = fuel_cost(facility, season.fuel_prices, taxed=season.taxed)
            ladder = {cost + step for step in (1, 5, 10, 20, 35, 60, 100, 160)}
            ladder |= {w - 1 for _, w in FLEX_TIERS if w - 1 > cost}
            ladder |= {cost * 2, cost * 3}
            # Just under each rival's price: a tie goes to whoever placed first.
            ladder |= {o.price - 1 for o in season.others if not o.must_run and o.price - 1 > cost}
            best_price, best = prices[facility], earned(prices)
            for price in sorted(ladder):
                trial = earned({**prices, facility: price})
                if trial > best + 1:
                    best_price, best = price, trial
            prices[facility] = round(best_price, 1)
    return prices


def storage_prices(season_prices: np.ndarray, facility: str) -> tuple[float, float]:
    """Buy at the cheapest quarter of the forecast prices and sell at the dearest, and never below what makes up for
    the energy lost."""
    buy = float(np.quantile(season_prices, 0.25))
    sell = float(np.quantile(season_prices, 0.75))
    efficiency = spec(facility).base_efficiency or 0.7
    return round(buy) + 1, round(max(sell, (buy + 1) / efficiency + 1))


def fuel_need(season: SeasonOutlook, fleet: Mapping[str, int], prices: Mapping[str, float]) -> dict[str, float]:
    return season.burn(fleet, prices)


def loan_cost(ctx: Ctx) -> float:
    return ctx.loan["payment"] * ctx.loan["payment_count"] - ctx.loan["amount"]


def own_intensity(ctx: Ctx) -> tuple[float, float]:
    """The bot's CO₂ per MWh and the room's, from the last period's output."""
    if ctx.last is None:
        return 0.0, 0.0
    mine = room = mine_mwh = room_mwh = 0.0
    for (player, facility), values in ctx.last.generation_series().items():
        energy = float(np.sum(values))
        co2 = energy * spec(facility).base_pollution
        room, room_mwh = room + co2, room_mwh + energy
        if player == ctx.me:
            mine, mine_mwh = mine + co2, mine_mwh + energy
    return (mine / mine_mwh if mine_mwh else 0.0), (room / room_mwh if room_mwh else math.inf)
