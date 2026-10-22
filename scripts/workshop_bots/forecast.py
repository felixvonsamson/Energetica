"""A bot's forecast of the market: the prices a Round's seasons should clear at, and what the bot's own plants would
earn there.

The forecast clears a representative week of each season the way the game does: every offer in price order against
the six demand tiers, at each settlement point. It is built from what a player can know:

- the rules: the demand curve's shape, the demand tiers, the catalog, and what weather a season usually brings, from
  a typical year of the weather model, not the Run's own;
- the public record of past Trading periods: the must-serve demand served, every player's output by facility type,
  and the merit order, which shows each player's offers and prices;
- its own fleet and the Recap's demand forecast.

What it cannot know, it guesses, and the guesses are where its mistakes come from: how much demand really grows, how
much the other players build, and how windy and sunny the season will be.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from functools import cache

import numpy as np

from energetica.workshop.demand_block import (
    DEMAND_TIERS,
    PER_PLAYER_BASE_AMPLITUDE,
    SettlementPeriod,
    national_demand_curve,
)
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId
from energetica.workshop.fuel import CATALOG_FUEL_PRICES, FUEL_USE
from energetica.workshop.prices import DUMP_COST, SCARCITY_PRICE
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import SEASONS, representative_week
from energetica.workshop.trading import demand_scale
from energetica.workshop.votes import CARBON_TAX_RATE
from energetica.workshop.weather import RunWeather

WEEKS_PER_SEASON = 13
SECONDS_PER_DAY = 86_400
# The flexible tiers: their share of must-serve demand and what they pay at most. Must-serve buys at any price.
FLEX_TIERS = [(tier.share, tier.willingness_to_pay) for tier in DEMAND_TIERS if math.isfinite(tier.willingness_to_pay)]
WEATHER_KIND = {
    FacilityCategory.WIND: "wind",
    FacilityCategory.PV: "solar",
    FacilityCategory.CSP: "solar",
    FacilityCategory.HYDRO: "hydro",
}
KIND_FACILITY = {
    "wind": FacilityId.ONSHORE_WIND_TURBINE,
    "solar": FacilityId.PV_SOLAR,
    "hydro": FacilityId.SMALL_WATER_DAM,
}
STORAGE_CATEGORIES = {FacilityCategory.BATTERIES, FacilityCategory.HYDROGEN_STORAGE, FacilityCategory.PUMPED_HYDRO}
# A renewable's price: just above what dumping costs, so it sells whenever anyone buys it.
RENEWABLE_PRICE = -DUMP_COST + 5
# The margin over forecast demand a bot wants supply to cover, so that a forecast error does not black the grid out.
RESERVE = 0.05


def spec(facility: str):
    return CATALOG[FacilityId(facility)]


def weather_kind(facility: str) -> str | None:
    return WEATHER_KIND.get(spec(facility).category)


def is_storage(facility: str) -> bool:
    return spec(facility).category in STORAGE_CATEGORIES


def fuel_cost(facility: str, fuel_prices: Mapping[str, float], *, taxed: bool) -> float:
    """Fuel, and the carbon tax once it is on, per MWh. Zero for a facility that burns nothing."""
    item = spec(facility)
    if item.fuel_type is None:
        return 0.0
    price = fuel_prices.get(item.fuel_type.value, CATALOG_FUEL_PRICES[item.fuel_type])
    tax = item.base_pollution * CARBON_TAX_RATE if taxed else 0.0
    return FUEL_USE[FacilityId(facility)] * price + tax


# --- rules a player can read: demand shape and a typical season's weather ------------------------------------------


def _times(season: str, clearings_per_day: int) -> list[tuple[int, int]]:
    return [(day, k) for day in representative_week(season) for k in range(clearings_per_day)]


@cache
def demand_shape(season: str, clearings_per_day: int) -> np.ndarray:
    """Must-serve demand at each point of the season's week, for an amplitude of 1, scaled like the game scales it."""
    curve = national_demand_curve()
    scale = demand_scale(season, RoundFormat(clearings_per_day=clearings_per_day), curve)
    return scale * np.array([curve.factor(SettlementPeriod(d, k, clearings_per_day)) for d, k in _times(season, clearings_per_day)])


@cache
def typical_shares(season: str, clearings_per_day: int, year: int) -> dict[str, np.ndarray]:
    """The share of its power each kind of renewable produces at each point of the season's week, in a typical year
    of the weather model. ``year`` picks one of a few such years, so bots do not all expect the same weather.
    """
    weather = RunWeather(seed=10_000 + year).season(season)
    seconds = [d * SECONDS_PER_DAY + k * SECONDS_PER_DAY / clearings_per_day for d, k in _times(season, clearings_per_day)]
    return {kind: np.array([weather.week(facility, t) for t in seconds]) for kind, facility in KIND_FACILITY.items()}


# --- clearing ------------------------------------------------------------------------------------------------------


@dataclass
class Offer:
    """One offer into the forecast: a price and the power offered at each point. ``owner`` is the facility type for
    the bot's own offers, None for anyone else's."""

    price: float
    power: np.ndarray
    must_run: bool = False
    owner: str | None = None


@dataclass
class Cleared:
    price: np.ndarray  # at each point
    sold: list[np.ndarray]  # each offer's W sold at each point, in the order given
    blackout: np.ndarray  # bool at each point
    supply: np.ndarray  # W offered in all, at each point


def clear(demand: np.ndarray, offers: list[Offer], charging: np.ndarray | None = None) -> Cleared:
    """Clear every point at once, as the game's uniform-price market does, against the six demand tiers.
    ``charging`` is storage buying to charge, in W at each point, on top of the tiers."""
    points = len(demand)
    extra = np.zeros(points) if charging is None else charging
    if not offers:
        return Cleared(np.full(points, SCARCITY_PRICE), [], np.ones(points, dtype=bool), np.zeros(points))
    prices = np.array([offer.price for offer in offers])
    power = np.array([np.broadcast_to(offer.power, (points,)) for offer in offers])
    order = np.argsort(prices, kind="stable")
    sorted_prices = prices[order]
    cumulative = np.cumsum(power[order], axis=0)
    candidates = np.unique(np.concatenate([sorted_prices, [w for _, w in FLEX_TIERS], [SCARCITY_PRICE]]))
    candidates = candidates[candidates <= SCARCITY_PRICE]
    taken = np.searchsorted(sorted_prices, candidates, side="right")
    supply = np.where(taken[:, None] > 0, cumulative[np.maximum(taken - 1, 0)], 0.0)
    above = np.array([1 + sum(share for share, w in FLEX_TIERS if w > c) for c in candidates])
    at_or_above = np.array([1 + sum(share for share, w in FLEX_TIERS if w >= c) for c in candidates])
    meets = supply >= above[:, None] * demand[None, :] + extra[None, :]
    found = meets.any(axis=0)
    first = np.argmax(meets, axis=0)
    price = np.where(found, candidates[first], SCARCITY_PRICE)
    blackout = supply[-1] < demand * (1 - 1e-9)
    quantity = np.minimum(supply[first, np.arange(points)], at_or_above[first] * demand + extra)
    # Offers fill in merit order, and at the same price in the order they were placed, as in the game. The bot's own
    # offers come last, so it never counts on winning a tie.
    before = cumulative - power[order]
    sold = np.empty_like(power)
    sold[order] = np.clip(quantity[None, :] - before, 0.0, power[order])
    # Where supply falls short, everything offered runs flat out, as it would up to the moment the grid goes down.
    sold = np.where(blackout[None, :], power, sold)
    return Cleared(price, list(sold), blackout, supply[-1])


def storage_schedule(prices: np.ndarray, clearings_per_day: int, fleet: Mapping[str, int]) -> tuple[np.ndarray, np.ndarray]:
    """When the bot's storage charges and discharges, in W at each point: each day, it charges at the cheapest points
    and discharges at the dearest, as long as the spread makes up for the energy lost."""
    points = len(prices)
    hours = 24 / clearings_per_day
    charge, discharge = np.zeros(points), np.zeros(points)
    for facility, count in fleet.items():
        if count <= 0 or not is_storage(facility):
            continue
        item = spec(facility)
        efficiency = item.base_efficiency or 0.7
        power = item.base_power_generation * count
        span = max(1, round((item.base_storage_capacity or 0) / item.base_power_generation / hours))
        for start in range(0, points, clearings_per_day):
            day = prices[start : start + clearings_per_day]
            order = np.argsort(day, kind="stable")
            for low, high in zip(order[:span], order[::-1][:span]):
                if day[high] * efficiency > day[low] and low != high:
                    charge[start + low] += power
                    discharge[start + high] += power * efficiency
    return charge, discharge


def season_om(facility: str, count: int, capacity_factor: float) -> float:
    """O&M for one season: the fixed share, plus the rest scaled by use, as the game charges it."""
    item = spec(facility)
    return count * item.om_per_round / 4 * (item.om_fixed_share + (1 - item.om_fixed_share) * capacity_factor)


# --- the forecast of one season ------------------------------------------------------------------------------------


@dataclass
class Run:
    cleared: Cleared
    own: list[Offer]
    start: int  # where the bot's own offers start among the cleared ones
    charge: np.ndarray  # the bot's storage charging, in W at each point
    discharge: np.ndarray


@dataclass
class SeasonOutlook:
    season: str
    clearings_per_day: int
    demand: np.ndarray  # must-serve W at each point
    others: list[Offer]
    shares: dict[str, np.ndarray]  # each kind of renewable's share of its power at each point
    fuel_prices: dict[str, float]
    taxed: bool
    _runs: dict = field(default_factory=dict, repr=False)

    @property
    def hours(self) -> float:
        return 24 / self.clearings_per_day

    def own_offers(self, fleet: Mapping[str, int], prices: Mapping[str, float]) -> list[Offer]:
        offers = []
        for facility, count in fleet.items():
            if count <= 0 or is_storage(facility):
                continue
            power = spec(facility).base_power_generation * count
            kind = weather_kind(facility)
            if kind is not None:
                offers.append(Offer(prices.get(facility, RENEWABLE_PRICE), power * self.shares[kind], True, facility))
            else:
                offers.append(Offer(prices[facility], np.full(len(self.demand), power), False, facility))
        return offers

    def run(
        self, fleet: Mapping[str, int], prices: Mapping[str, float], rivals: Mapping[str, float] | None = None
    ) -> Run:
        """Clear the season with the bot's fleet, and ``rivals``: plants it expects the others to build in answer to
        its own, priced like its own. With storage, it clears twice: once to see when power is cheap and dear, then
        again with the storage charging and discharging then, which moves the prices it trades at."""
        rivals = {f: n for f, n in (rivals or {}).items() if n > 0 and not is_storage(f)}
        key = (
            tuple(sorted((f, n) for f, n in fleet.items() if n)),
            tuple(sorted(prices.items())),
            tuple(sorted(rivals.items())),
        )
        if key in self._runs:
            return self._runs[key]
        # Counts may be fractions: a rival is as likely as not to answer with one more plant.
        answer = [
            Offer(offer.price, offer.power * rivals[offer.owner], offer.must_run)
            for offer in self.own_offers({f: 1 for f in rivals}, prices)
        ]
        others = self.others + answer
        own = self.own_offers(fleet, prices)
        cleared = clear(self.demand, others + own)
        charge = discharge = np.zeros(len(self.demand))
        if any(n > 0 and is_storage(f) for f, n in fleet.items()):
            charge, discharge = storage_schedule(cleared.price, self.clearings_per_day, fleet)
            # Storage discharges into the market at any price it can get, and charges whatever it pays.
            cleared = clear(self.demand, others + own + [Offer(-DUMP_COST, discharge)], charge)
        result = Run(cleared, own, len(others), charge, discharge)
        self._runs[key] = result
        return result

    def profit(
        self, fleet: Mapping[str, int], prices: Mapping[str, float], rivals: Mapping[str, float] | None = None
    ) -> float:
        """The bot's profit over the season: sales less fuel, carbon tax, dumping and O&M. If the forecast shows a
        blackout, nothing trades from its first point on, as in the game."""
        result = self.run(fleet, prices, rivals)
        cleared = result.cleared
        start = result.start
        mwh = self.hours / 1e6
        down = np.flatnonzero(cleared.blackout)
        end = int(down[0]) if len(down) else len(self.demand)
        total = 0.0
        om = 0.0
        for offer, sold in zip(result.own, cleared.sold[start:]):
            margin = (cleared.price - fuel_cost(offer.owner, self.fuel_prices, taxed=self.taxed)) * sold * mwh
            total += margin[:end].sum()
            produced = offer.power if offer.must_run else sold
            if offer.must_run:
                total -= (DUMP_COST * (offer.power - sold) * mwh)[:end].sum()
            count = fleet[offer.owner]
            om += season_om(offer.owner, count, float(produced.mean()) / (spec(offer.owner).base_power_generation * count))
        if result.discharge.any():
            total += float(((result.discharge - result.charge) * cleared.price)[:end].sum()) * mwh
            for facility, count in fleet.items():
                if count > 0 and is_storage(facility):
                    om += season_om(facility, count, 0.2)
        return total * WEEKS_PER_SEASON - om

    def burn(self, fleet: Mapping[str, int], prices: Mapping[str, float]) -> dict[str, float]:
        """The fuel the bot's plants would burn over the season, in kg."""
        result = self.run(fleet, prices)
        burned: dict[str, float] = {}
        for offer, sold in zip(result.own, result.cleared.sold[result.start :]):
            item = spec(offer.owner)
            if item.fuel_type is not None:
                kg = FUEL_USE[FacilityId(offer.owner)] * sold.sum() * self.hours / 1e6 * WEEKS_PER_SEASON
                burned[item.fuel_type.value] = burned.get(item.fuel_type.value, 0.0) + kg
        return burned


@dataclass
class Outlook:
    """The forecast of a whole Round: its four seasons. ``blackout_cost`` is what a blackout would cost the bot: a
    blackout ends the Round and resets everyone's cash to the starting budget."""

    seasons: list[SeasonOutlook] = field(default_factory=list)
    blackout_cost: float = 0.0

    def profit(
        self, fleet: Mapping[str, int], prices: Mapping[str, float], rivals: Mapping[str, float] | None = None
    ) -> float:
        """Operating profit over the Round, after O&M, less the cost of a blackout if the forecast shows one. The
        plants ``rivals`` build in answer count for the profit, but not against blackouts: no one counts on them."""
        total = 0.0
        worst = 0.0
        for season in self.seasons:
            total += season.profit(fleet, prices, rivals)
            # Measured against demand 5% above the forecast: the bot knows its forecast can be wrong.
            short = season.demand * (1 + RESERVE) - season.run(fleet, prices).cleared.supply
            worst = max(worst, float(short.max()) / float(season.demand.max()))
            if season.run(fleet, prices).cleared.blackout.any():
                # The Round ends at a blackout: the seasons after it earn nothing, and cash is reset.
                total -= self.blackout_cost
                break
        if worst > 0:
            # Supply too close to demand is a risk, and the closer, the likelier a blackout. Each MW the bot adds
            # lowers it.
            total -= self.blackout_cost * min(1.0, worst / 0.1) / 2
        return total

    def mean_price(self, fleet: Mapping[str, int], prices: Mapping[str, float]) -> float:
        return statistics.fmean(float(season.run(fleet, prices).cleared.price.mean()) for season in self.seasons)


# --- reading the public record -------------------------------------------------------------------------------------


def amplitude_seen(views: Iterable) -> float | None:
    """The demand amplitude the record's must-serve demand implies, averaged over the periods that held."""
    seen = []
    for view in views:
        if view.blackout or not view.must_serve:
            continue
        shape = demand_shape(view.season, view.clearings_per_day)
        if len(shape) == len(view.must_serve):
            seen.append(float(np.mean(view.must_serve)) / float(shape.mean()))
    return statistics.fmean(seen) if seen else None


def renewable_power(view, me: int, own_fleet: Mapping[str, int], year: int) -> dict[tuple[int, str], float]:
    """Each other player's installed power of each renewable type, in W, estimated from their output in ``view``.

    All players' plants of a kind share the weather, so where the bot owns that kind, its own output gives the
    season's real share of power. Otherwise it assumes a typical season, and the estimate is off by as much as the
    season's weather was unusual.
    """
    real_share: dict[str, float] = {}
    for facility, count in own_fleet.items():
        kind = weather_kind(facility)
        if kind is None or count <= 0 or kind in real_share:
            continue
        output = view.series(me, facility)
        if output is not None and len(output):
            real_share[kind] = float(np.mean(output)) / (spec(facility).base_power_generation * count)
    estimates = {}
    for (player, facility), output in view.generation_series().items():
        kind = weather_kind(facility)
        if player == me or kind is None:
            continue
        share = real_share.get(kind)
        if not share:
            share = float(typical_shares(view.season, view.clearings_per_day, year)[kind].mean())
        if share > 0:
            estimates[(player, facility)] = float(np.mean(output)) / share
    return estimates
