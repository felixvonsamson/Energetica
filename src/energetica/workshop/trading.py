"""The Trading-period engine in representative-day mode (#1003).

When a Trading period's price-setting window closes, one simulated day of that season is cleared, and its
result is scaled ×365/4 to become the period's real total (#992 §2). Each clearing of the day:

- every player offers each facility type they have operating at the price they set for it (#1002), and
  each storage type also bids to charge at its buy price;
- the demand block (:mod:`~energetica.workshop.demand_block`) bids for the country's consumers;
- the market clears with :func:`~energetica.sim.market.clear_market` and settles with
  :func:`~energetica.sim.settlement.settle_clearing`.

The rules come from ``sim``, so this module only gathers each player's offers and adds up what they
earned. A player's facilities of one type run as one pool, its power scaled by how many are operating.

Renewable facilities (wind, solar and hydro) produce whatever the weather gives them and offer it as
must-run power: what does not sell is dumped at :data:`~energetica.workshop.prices.DUMP_COST` per MWh
and still counts as generated. Controllable facilities produce only what they sell. There are no
ramping limits for now (#1151), and no fuel stock limits generation yet (#1010).

The weather is ``sim.renewables`` at one fixed position, since Workshop has no map, with a random seed
per Run. Only the day's settlement is scaled. O&M is already one Trading period's share, and stored
energy is what the storage really holds at the end of the day.

A clearing where the must-serve demand tier goes unserved is a blackout. Its clearing price is the
must-serve bid, ``math.inf``, so it cannot be settled: nothing trades or runs in it. What a blackout
does to the session is #1005's job; here it is only reported.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field

from pydantic import BaseModel, ConfigDict, Field

from energetica.sim.dispatch import fuel_power_limit, max_output, storage_power_limit
from energetica.sim.fuel_and_pollution import emissions_produced
from energetica.sim.market import (
    MarketClearing,
    clear_market,
    init_market,
    place_bid,
    place_headroom_ask,
    place_must_run_ask,
)
from energetica.sim.national_demand import DemandCurve
from energetica.sim.renewable_curves import RIVER_FLOW_SPEED_SEASONAL
from energetica.sim.renewables import (
    calculate_river_speed,
    calculate_solar_irradiance,
    calculate_wind_speed,
    hydro_power_fraction,
    solar_power_fraction,
    wind_power_fraction,
)
from energetica.sim.settlement import MIN_SETTLED_QUANTITY, SaleSettlement, settle_clearing
from energetica.workshop.demand_block import DAYS_PER_YEAR, DEMAND_TIERS, SettlementPeriod, build_demand_block
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId
from energetica.workshop.fleet import OwnedFacility, capacity_factor, is_operating, om_owed
from energetica.workshop.prices import DUMP_COST, PriceSheet, is_storage
from energetica.workshop.seasons import SEASONS, Season

SECONDS_PER_HOUR = 3_600
SECONDS_PER_DAY = 86_400

#: How many days one simulated day stands for: an average season, 365/4 (#992 §2).
SEASON_DAYS = DAYS_PER_YEAR / len(SEASONS)

#: The day of the year, counted from 0 on 1 January, that each season's Trading period simulates: the
#: middle of the season, in the same calendar as the demand curve.
REPRESENTATIVE_DAYS: dict[Season, int] = {"spring": 105, "summer": 196, "autumn": 288, "winter": 15}

#: Where every facility stands for the weather, since Workshop has no map.
WEATHER_POSITION = (0.0, 0.0)

#: The categories whose output follows the weather and is offered as must-run power.
RENEWABLE_CATEGORIES = frozenset(
    {FacilityCategory.WIND, FacilityCategory.PV, FacilityCategory.CSP, FacilityCategory.HYDRO}
)

_MUST_SERVE = next(tier for tier in DEMAND_TIERS if tier.label == "must_serve")

Weather = Callable[[FacilityId, float], float]
"""The share of its power a renewable facility produces at a time, in seconds from 1 January, from 0 to 1."""


def representative_weather(seed: int) -> Weather:
    """The weather of ``sim.renewables`` at :data:`WEATHER_POSITION`, for a Run whose random seed is ``seed``.

    The river table covers a year of its own length, so hydro reads it at the same share of the year.
    """
    river_year = len(RIVER_FLOW_SPEED_SEASONAL)

    def weather(facility: FacilityId, seconds: float) -> float:
        match CATALOG[facility].category:
            case FacilityCategory.WIND:
                share = wind_power_fraction(calculate_wind_speed(WEATHER_POSITION, seconds, seed, DAYS_PER_YEAR))
            case FacilityCategory.PV | FacilityCategory.CSP:
                irradiance = calculate_solar_irradiance(WEATHER_POSITION, seconds, seed, DAYS_PER_YEAR)[0]
                share = solar_power_fraction(irradiance)
            case FacilityCategory.HYDRO:
                share = hydro_power_fraction(calculate_river_speed(seconds * river_year / DAYS_PER_YEAR, river_year))
            case _:
                raise ValueError(f"{facility} does not follow the weather")
        # ``sim.renewables`` computes with numpy, so its results are numpy floats. Saved results need plain ones.
        return float(share)

    return weather


@dataclass(frozen=True, slots=True)
class Bidder:
    """What the engine needs to know about one player."""

    player_id: int
    owned_facilities: Sequence[OwnedFacility]
    prices: PriceSheet
    stored_energy: Mapping[FacilityId, float]


class FacilityPerformance(BaseModel):
    """How one facility type of a player did over a Trading period. Energy is in Wh, emissions in kg."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    generation: float = Field(description="Energy generated: what sold plus what was dumped. For storage, discharged")
    sold: float = Field(description="Energy sold on the market")
    dumped: float = Field(description="Renewable energy generated that did not sell")
    bought: float = Field(description="Energy storage bought to charge")
    revenue: float = Field(description="Money earned for the energy sold")
    dump_cost: float = Field(description="Money paid for the energy dumped")
    purchase_cost: float = Field(description="Money paid for the energy bought")
    om: float = Field(description="Operation and maintenance cost for the period")
    emissions: float = Field(description="CO₂ emitted generating")
    capacity_factor: float = Field(description="Average output as a share of maximum output, from 0 to 1")

    @property
    def net(self) -> float:
        """What the facility type added to the player's money."""
        return self.revenue - self.dump_cost - self.purchase_cost - self.om


class TradingResult(BaseModel):
    """How a player did over one Trading period, per facility type they had operating."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    round: int = Field(ge=1)
    season: Season
    facilities: dict[FacilityId, FacilityPerformance]

    @property
    def revenue(self) -> float:
        """Gross market proceeds: money earned for energy sold, before any cost."""
        return sum(performance.revenue for performance in self.facilities.values())

    @property
    def net(self) -> float:
        """What the period added to the player's money."""
        return sum(performance.net for performance in self.facilities.values())


@dataclass(frozen=True, slots=True)
class TradingOutcome:
    """Everything one Trading period produced."""

    results: dict[int, TradingResult]
    """Each player's result, by player id. A player with nothing operating has none."""
    stored_energy: dict[int, dict[FacilityId, float]]
    """Each player's stored energy at the end of the period, by player id, in Wh. A type holding nothing is
    left out."""
    blackout: bool
    """Whether any clearing left must-serve demand unserved."""


@dataclass(slots=True)
class _Pool:
    """A player's operating facilities of one type, run as one."""

    player_id: int
    facility: FacilityId
    owned: list[OwnedFacility]
    sell_price: float
    buy_price: float | None
    stored_energy: float = 0.0
    # Output in W at each clearing: what sold, plus what was dumped.
    production: list[float] = field(default_factory=list)
    # Energy in Wh, money and emissions over the simulated day.
    sold: float = 0.0
    dumped: float = 0.0
    bought: float = 0.0
    revenue: float = 0.0
    dump_cost: float = 0.0
    purchase_cost: float = 0.0
    emissions: float = 0.0

    @property
    def power(self) -> float:
        return CATALOG[self.facility].base_power_generation * len(self.owned)

    @property
    def capacity(self) -> float:
        return (CATALOG[self.facility].base_storage_capacity or 0.0) * len(self.owned)

    @property
    def efficiency(self) -> float:
        return CATALOG[self.facility].base_efficiency or 1.0

    def place(self, market: dict, seconds: float, weather: Weather, seconds_per_tick: float) -> None:
        """Place this clearing's offer, and for storage its bid to charge."""
        name = self.facility.value
        if CATALOG[self.facility].category in RENEWABLE_CATEGORIES:
            place_must_run_ask(
                market, self.player_id, self.power * weather(self.facility, seconds), self.sell_price, name
            )
        elif self.buy_price is not None:
            discharge = storage_power_limit(self.stored_energy, self.efficiency, math.inf, seconds_per_tick)
            place_headroom_ask(market, self.player_id, 0.0, _unramped(discharge, self.power), self.sell_price, name)
            room = self.capacity - self.stored_energy
            charge = storage_power_limit(room, self.efficiency, math.inf, seconds_per_tick)
            place_bid(market, self.player_id, _unramped(charge, self.power), self.buy_price, name)
        else:
            # No fuel stock exists yet, so fuel does not limit output (#1010).
            fuel = fuel_power_limit(self.power, ())
            place_headroom_ask(market, self.player_id, 0.0, _unramped(fuel, self.power), self.sell_price, name)

    def record(self, sale: SaleSettlement | None, seconds_per_tick: float) -> None:
        """Record what this clearing sold of the pool's offer, or that it produced nothing if ``sale`` is None."""
        hours = seconds_per_tick / SECONDS_PER_HOUR
        produced = sale.power_produced if sale is not None else 0.0
        self.production.append(produced)
        if sale is not None:
            self.sold += sale.power_sold * hours
            self.dumped += sale.power_dumped * hours
            self.revenue += sale.revenue
            self.dump_cost += sale.dump_cost
        if self.buy_price is not None:
            self.stored_energy = max(0.0, self.stored_energy - produced * hours / self.efficiency**0.5)
        else:
            pollution = CATALOG[self.facility].base_pollution * self.power / 1_000_000 * hours
            self.emissions += emissions_produced(pollution, produced, self.power)

    def record_purchase(self, bought: float, cost: float, seconds_per_tick: float) -> None:
        """Record what this clearing bought of the pool's bid to charge."""
        hours = seconds_per_tick / SECONDS_PER_HOUR
        self.bought += bought * hours
        self.purchase_cost += cost
        self.stored_energy = min(self.capacity, self.stored_energy + bought * hours * self.efficiency**0.5)

    def performance(self, round_number: int, seconds_per_tick: float) -> FacilityPerformance:
        """The pool's performance over the Trading period: the day scaled to the season, plus its O&M."""
        per_facility = [output / len(self.owned) for output in self.production]
        return FacilityPerformance(
            generation=sum(self.production) * seconds_per_tick / SECONDS_PER_HOUR * SEASON_DAYS,
            sold=self.sold * SEASON_DAYS,
            dumped=self.dumped * SEASON_DAYS,
            bought=self.bought * SEASON_DAYS,
            revenue=self.revenue * SEASON_DAYS,
            dump_cost=self.dump_cost * SEASON_DAYS,
            purchase_cost=self.purchase_cost * SEASON_DAYS,
            om=sum(om_owed(owned, current_round=round_number, production=per_facility) for owned in self.owned),
            emissions=self.emissions * SEASON_DAYS,
            capacity_factor=capacity_factor(self.owned[0], per_facility),
        )


def _unramped(resource_limit: float, power: float) -> float:
    """The most a facility can output in a tick, from nothing: ramping limits are off (#1151)."""
    return max_output(resource_limit, 0.0, math.inf, power)


def _pools(bidder: Bidder, round_number: int) -> list[_Pool]:
    """One pool per facility type ``bidder`` has operating in ``round_number``."""
    operating: dict[FacilityId, list[OwnedFacility]] = {}
    for owned in bidder.owned_facilities:
        if is_operating(owned, current_round=round_number):
            operating.setdefault(owned.facility, []).append(owned)
    return [
        _Pool(
            player_id=bidder.player_id,
            facility=facility,
            owned=owned,
            sell_price=bidder.prices.sell[facility],
            buy_price=bidder.prices.buy[facility] if is_storage(facility) else None,
            stored_energy=bidder.stored_energy.get(facility, 0.0),
        )
        for facility, owned in operating.items()
    ]


def _is_blackout(clearing: MarketClearing) -> bool:
    """Whether ``clearing`` left must-serve demand unserved."""
    return any(
        fill.entry.player_id == _MUST_SERVE.player_id and fill.unmet > MIN_SETTLED_QUANTITY for fill in clearing.demands
    )


def simulate_trading_period(
    bidders: Sequence[Bidder],
    *,
    round_number: int,
    season: Season,
    clearings_per_day: int,
    amplitude: float,
    curve: DemandCurve,
    weather: Weather,
) -> TradingOutcome:
    """Clear ``season``'s representative day ``clearings_per_day`` times, and scale it to the Trading period.

    ``amplitude`` and ``curve`` shape the demand block, and ``weather`` gives the renewables' output.
    """
    seconds_per_tick = SECONDS_PER_DAY / clearings_per_day
    day = REPRESENTATIVE_DAYS[season]
    pools = {(pool.player_id, pool.facility.value): pool for bidder in bidders for pool in _pools(bidder, round_number)}
    blackout = False

    for clearing in range(clearings_per_day):
        market = init_market()
        for pool in pools.values():
            pool.place(market, day * SECONDS_PER_DAY + clearing * seconds_per_tick, weather, seconds_per_tick)
        demand_block = build_demand_block(amplitude, curve, SettlementPeriod(day, clearing, clearings_per_day))
        result = clear_market(market["capacities"], market["demands"] + demand_block)
        if _is_blackout(result):
            blackout = True
            for pool in pools.values():
                pool.record(None, seconds_per_tick)
            continue

        settlement = settle_clearing(result, seconds_per_tick, DUMP_COST)
        sales = {(sale.player_id, sale.facility): sale for sale in settlement.sales}
        for key, pool in pools.items():
            pool.record(sales.get(key), seconds_per_tick)
        for purchase in settlement.purchases:
            pool = pools.get((purchase.player_id, purchase.facility))
            if pool is not None:
                pool.record_purchase(purchase.power_bought, purchase.cost, seconds_per_tick)

    performances: dict[int, dict[FacilityId, FacilityPerformance]] = {}
    for pool in pools.values():
        performances.setdefault(pool.player_id, {})[pool.facility] = pool.performance(round_number, seconds_per_tick)
    results = {
        player_id: TradingResult(round=round_number, season=season, facilities=facilities)
        for player_id, facilities in performances.items()
    }

    # A storage type with nothing operating keeps the energy it had. Pools that are not storage hold none.
    stored_energy = {}
    for bidder in bidders:
        ended = {pool.facility: pool.stored_energy for pool in pools.values() if pool.player_id == bidder.player_id}
        energy = {**bidder.stored_energy, **ended}
        stored_energy[bidder.player_id] = {facility: amount for facility, amount in energy.items() if amount > 0}

    return TradingOutcome(results=results, stored_energy=stored_energy, blackout=blackout)
