"""The Trading-period engine (#1003, #1004).

When a Trading period's price-setting window closes, the market clears through the days of its season.
The Round's format (:mod:`~energetica.workshop.round_format`) says which days:

- in representative-day mode, the middle day of the season stands for all of it, and its result is
  scaled ×91 to become the period's real total (#992 §2);
- in full-season mode, all 91 days of the season are cleared one after the other and added up, with no
  scaling. Storage carries its charge from one day to the next.

A Workshop year is 364 days, so each season is exactly 13 weeks. Each clearing of a day:

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
per Run. Only the market settlement is scaled. O&M is already one Trading period's share, and stored
energy is what the storage really holds at the end of the period.

A clearing where the must-serve demand tier goes unserved is a blackout: the grid goes down, and the
simulation stops there (#1005). That clearing and every one after it, to the end of the simulated days,
produce, sell and buy nothing, and storage keeps the energy it held. In representative-day mode the part
of the day before the blackout is still scaled ×91. What a blackout does to the session is the session's
job; here it is only reported.

Besides each player's result, the engine keeps a :class:`~energetica.workshop.period_record.TradingPeriodRecord`
of every settlement point it cleared, for the period's review.

A clearing where supply exactly meets must-serve demand is no blackout, but it clears at the must-serve
bid, ``math.inf``, so it settles at :data:`SCARCITY_PRICE` instead.
"""

from __future__ import annotations

import dataclasses
import math
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from energetica.sim.dispatch import fuel_power_limit, max_output, storage_power_limit
from energetica.sim.fuel_and_pollution import emissions_produced
from energetica.sim.market import (
    MarketClearing,
    MarketEntry,
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
from energetica.workshop.period_record import BidLine, Side, TradingPeriodRecord
from energetica.workshop.prices import DUMP_COST, PriceSheet, is_storage
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import SEASONS, Season

SECONDS_PER_HOUR = 3_600
SECONDS_PER_DAY = 86_400

#: How many days a season has: 13 weeks, a quarter of Workshop's 364-day year.
SEASON_DAYS = DAYS_PER_YEAR // len(SEASONS)

#: The day of the year, counted from 0 on 1 January, that spring starts on: 1 March, in the same calendar
#: as the demand curve. The other seasons follow it.
SPRING_START = 59


def season_days(season: Season) -> list[int]:
    """The days of the year in ``season``, in order. Winter runs over the end of the year."""
    start = SPRING_START + SEASONS.index(season) * SEASON_DAYS
    return [(start + day) % DAYS_PER_YEAR for day in range(SEASON_DAYS)]


#: The day of the year that each season's Trading period simulates in representative-day mode: the middle
#: of the season.
REPRESENTATIVE_DAYS: dict[Season, int] = {season: season_days(season)[SEASON_DAYS // 2] for season in SEASONS}

#: Where every facility stands for the weather, since Workshop has no map.
WEATHER_POSITION = (0.0, 0.0)

#: The categories whose output follows the weather and is offered as must-run power.
RENEWABLE_CATEGORIES = frozenset(
    {FacilityCategory.WIND, FacilityCategory.PV, FacilityCategory.CSP, FacilityCategory.HYDRO}
)

#: The price per MWh a clearing settles at when supply exactly meets must-serve demand, which would
#: otherwise clear at the unbounded must-serve bid.
SCARCITY_PRICE = 1000.0

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
    """Whether a clearing left must-serve demand unserved, which stopped the simulation there."""
    record: TradingPeriodRecord
    """What the period did at each settlement point, for its review."""


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
    # At each clearing: W dumped, W bought to charge, and Wh stored once the clearing is over.
    dumped_power: list[float] = field(default_factory=list)
    charged_power: list[float] = field(default_factory=list)
    stored_series: list[float] = field(default_factory=list)
    # What the current clearing bought to charge, in W.
    charging: float = 0.0
    # Energy in Wh, money and emissions over the simulated days.
    sold: float = 0.0
    dumped: float = 0.0
    bought: float = 0.0
    revenue: float = 0.0
    dump_cost: float = 0.0
    purchase_cost: float = 0.0
    emissions: float = 0.0
    # Worked out once from the catalog, since the pool places an offer at every clearing.
    name: str = field(init=False)
    power: float = field(init=False)
    capacity: float = field(init=False)
    efficiency: float = field(init=False)
    renewable: bool = field(init=False)

    def __post_init__(self) -> None:
        facility = CATALOG[self.facility]
        self.name = self.facility.value
        self.power = facility.base_power_generation * len(self.owned)
        self.capacity = (facility.base_storage_capacity or 0.0) * len(self.owned)
        self.efficiency = facility.base_efficiency or 1.0
        self.renewable = facility.category in RENEWABLE_CATEGORIES

    def place(self, market: dict, weather_share: float, seconds_per_tick: float) -> None:
        """Place this clearing's offer, and for storage its bid to charge. ``weather_share`` is the share of
        its power a renewable pool produces at this clearing.
        """
        name = self.name
        if self.renewable:
            place_must_run_ask(market, self.player_id, self.power * weather_share, self.sell_price, name)
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
        self.dumped_power.append(sale.power_dumped if sale is not None else 0.0)
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
        self.charging += bought
        self.stored_energy = min(self.capacity, self.stored_energy + bought * hours * self.efficiency**0.5)

    def end_clearing(self) -> None:
        """Record what the clearing charged and what the pool holds after it, once it has sold and bought."""
        self.charged_power.append(self.charging)
        self.stored_series.append(self.stored_energy)
        self.charging = 0.0

    def performance(self, round_number: int, seconds_per_tick: float, scale: float) -> FacilityPerformance:
        """The pool's performance over the Trading period: the simulated days times ``scale``, plus its O&M."""
        per_facility = [output / len(self.owned) for output in self.production]
        return FacilityPerformance(
            generation=sum(self.production) * seconds_per_tick / SECONDS_PER_HOUR * scale,
            sold=self.sold * scale,
            dumped=self.dumped * scale,
            bought=self.bought * scale,
            revenue=self.revenue * scale,
            dump_cost=self.dump_cost * scale,
            purchase_cost=self.purchase_cost * scale,
            om=sum(om_owed(owned, current_round=round_number, production=per_facility) for owned in self.owned),
            emissions=self.emissions * scale,
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


def _record_nothing(pools: Iterable[_Pool], seconds_per_tick: float) -> None:
    """Record that a clearing the grid was down for produced nothing."""
    for pool in pools:
        pool.record(None, seconds_per_tick)
        pool.end_clearing()


def _bid_lines(pools: Iterable[_Pool]) -> list[BidLine]:
    """The bid lines the pools and the demand block place at each clearing, in the order they place them."""
    pools = list(pools)
    offers = [BidLine("offer", pool.player_id, pool.name, pool.sell_price, must_run=pool.renewable) for pool in pools]
    charging = [
        BidLine("demand", pool.player_id, pool.name, pool.buy_price) for pool in pools if pool.buy_price is not None
    ]
    tiers = [BidLine("demand", tier.player_id, tier.label, tier.willingness_to_pay) for tier in DEMAND_TIERS]
    return [*offers, *charging, *tiers]


def simulated_days(season: Season, round_format: RoundFormat) -> list[int]:
    """The days of the year a Trading period in ``season`` clears, in order, under ``round_format``."""
    if round_format.trading_format == "full_season":
        return season_days(season)
    return [REPRESENTATIVE_DAYS[season]]


def simulate_trading_period(
    bidders: Sequence[Bidder],
    *,
    round_number: int,
    season: Season,
    round_format: RoundFormat,
    amplitude: float,
    curve: DemandCurve,
    weather: Weather,
    on_day_done: Callable[[int], None] | None = None,
) -> TradingOutcome:
    """Clear the days of ``season`` that ``round_format`` simulates, and add them up into the Trading period.

    ``amplitude`` and ``curve`` shape the demand block, and ``weather`` gives the renewables' output.
    ``on_day_done``, if given, is called with how many days are done after each one.
    """
    clearings_per_day = round_format.clearings_per_day
    seconds_per_tick = SECONDS_PER_DAY / clearings_per_day
    days = simulated_days(season, round_format)
    # A representative day stands for the whole season. Full-season days are all literal.
    scale = SEASON_DAYS / len(days)
    pools = {(pool.player_id, pool.facility.value): pool for bidder in bidders for pool in _pools(bidder, round_number)}
    renewables = {pool.facility for pool in pools.values() if pool.renewable}
    blackout = False
    blackout_at: int | None = None

    lines = _bid_lines(pools.values())
    line_index: dict[tuple[Side, int, str], int] = {
        (line.side, line.player_id, line.facility): index for index, line in enumerate(lines)
    }
    point_count = len(days) * clearings_per_day
    prices = np.full(point_count, math.nan)
    quantities = np.full(point_count, math.nan)
    offered = np.zeros((len(lines), point_count))
    tier_index = {tier.player_id: index for index, tier in enumerate(DEMAND_TIERS)}
    served = np.zeros((len(DEMAND_TIERS), point_count))

    for days_done, day in enumerate(days, start=1):
        for clearing in range(clearings_per_day):
            point = (days_done - 1) * clearings_per_day + clearing
            if blackout:
                _record_nothing(pools.values(), seconds_per_tick)
                continue
            market = init_market()
            seconds = day * SECONDS_PER_DAY + clearing * seconds_per_tick
            # Every facility stands at the same position, so each type's weather is worked out once.
            shares = {facility: weather(facility, seconds) for facility in renewables}
            for pool in pools.values():
                pool.place(market, shares.get(pool.facility, 0.0), seconds_per_tick)
            demand_block = build_demand_block(amplitude, curve, SettlementPeriod(day, clearing, clearings_per_day))
            demands = market["demands"] + demand_block
            sides: tuple[tuple[Side, list[MarketEntry]], ...] = (("offer", market["capacities"]), ("demand", demands))
            for side, entries in sides:
                for entry in entries:
                    offered[line_index[(side, entry.player_id, entry.facility)], point] = entry.capacity
            result = clear_market(market["capacities"], demands)
            prices[point], quantities[point] = result.price, result.quantity
            if _is_blackout(result):
                blackout = True
                blackout_at = point
                _record_nothing(pools.values(), seconds_per_tick)
                continue
            if not math.isfinite(result.price):
                result = dataclasses.replace(result, price=SCARCITY_PRICE)
                prices[point] = SCARCITY_PRICE
            settlement = settle_clearing(result, seconds_per_tick, DUMP_COST)
            sales = {(sale.player_id, sale.facility): sale for sale in settlement.sales}
            for key, pool in pools.items():
                pool.record(sales.get(key), seconds_per_tick)
            for purchase in settlement.purchases:
                pool = pools.get((purchase.player_id, purchase.facility))
                if pool is not None:
                    pool.record_purchase(purchase.power_bought, purchase.cost, seconds_per_tick)
                elif purchase.player_id in tier_index:
                    served[tier_index[purchase.player_id], point] = purchase.power_bought
            for pool in pools.values():
                pool.end_clearing()
        if on_day_done is not None:
            on_day_done(days_done)

    performances: dict[int, dict[FacilityId, FacilityPerformance]] = {}
    for pool in pools.values():
        performances.setdefault(pool.player_id, {})[pool.facility] = pool.performance(
            round_number, seconds_per_tick, scale
        )
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

    def series(values: Callable[[_Pool], list[float]]) -> np.ndarray:
        return np.array([values(pool) for pool in pools.values()], dtype=np.float64).reshape(len(pools), point_count)

    record = TradingPeriodRecord(
        round=round_number,
        season=season,
        clearings_per_day=clearings_per_day,
        days=tuple(days),
        blackout_at=blackout_at,
        price=prices,
        quantity=quantities,
        pools=tuple(pools),
        generation=series(lambda pool: pool.production),
        dumped=series(lambda pool: pool.dumped_power),
        charged=series(lambda pool: pool.charged_power),
        stored=series(lambda pool: pool.stored_series),
        tiers=tuple(tier.label for tier in DEMAND_TIERS),
        served=served,
        lines=tuple(lines),
        offered=offered,
    )
    return TradingOutcome(results=results, stored_energy=stored_energy, blackout=blackout, record=record)
