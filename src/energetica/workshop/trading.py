"""The Trading-period engine (#1003, #1004, #1198).

When a Trading period's price-setting window closes, the market clears through the days of its season.
The Round's format (:mod:`~energetica.workshop.round_format`) says which days:

- in representative-week mode, the middle week of the season stands for all of it, and its result is
  scaled ×13 to become the period's real total (ADR-0008). Wind and solar borrow their weather from elsewhere
  in the season (:mod:`~energetica.workshop.weather`), and every clearing's demand is scaled by the season's
  average demand over the week's, so the week keeps its shape and its average matches the season's;
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
ramping limits for now (#1151). The engine counts the fuel each facility type burns, but the session pays for
fuel when it settles the period (#1009).

A player's fuel stock caps what their facilities burning it can offer (#1010), through
:func:`~energetica.sim.dispatch.fuel_power_limit`, so a player who bought too little fuel simply generates less.
The stock drains as it is burned, at the grain the period is simulated at: a representative week gets its
season's stock divided by the same ×13 its result is scaled by, and a full season burns it day by day. Facility
types burning the same fuel share the stock much as in the persistent world: at each clearing, each in turn
reserves the fuel its offer could burn, and the next ones offer only what is left. Here the cheapest offer goes
first, so fuel held for an offer that does not sell is never fuel a cheaper one could have sold. A bidder with no
fuel limit, as under automatic procurement, never runs short. A facility type has run out of fuel if, at some
clearing, its offer was cut short while the market cleared at or above its price, so it could have sold more.

Storage in representative-week mode uses a cyclic start: the week is cleared once from empty, then again from the
charge the first pass ended with, and only the second pass counts. Nothing carries over from the period before,
and the jump in charge between periods is not priced. Only the market settlement is scaled. O&M is already one
Trading period's share, and stored energy is what the storage really holds at the end of the period.

A clearing where the must-serve demand tier goes unserved is a blackout: the grid goes down for a day (#1286). That
clearing and the ones after it for the next 24 hours, or to the end of the simulated days if they come first, produce,
sell and buy nothing, and storage keeps the energy it held. The grid then restarts with electricity rationed: every
demand tier is cut by :data:`RATIONING` for the rest of the period. Each blackout cuts it again, and a period starts
from the rationing of the blackouts earlier in its Round. In representative-week mode the outage is scaled ×13 with
the rest of the week, so it stands for 13 days of the season. What a blackout costs the players is the session's job;
here it is only reported.

Besides each player's result, the engine keeps a :class:`~energetica.workshop.period_record.TradingPeriodRecord`
of every settlement point it cleared, for the period's review.

A clearing where supply exactly meets must-serve demand is no blackout, but it clears at the must-serve
bid, ``math.inf``, so it settles at :data:`~energetica.workshop.prices.SCARCITY_PRICE` instead.
"""

from __future__ import annotations

import dataclasses
import math
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from energetica.sim.dispatch import fuel_power_limit, max_output, storage_power_limit
from energetica.sim.fuel_and_pollution import emissions_produced, fuel_burned
from energetica.sim.market import (
    MarketClearing,
    MarketEntry,
    clear_market,
    init_market,
    place_bid,
    place_headroom_ask,
    place_must_run_ask,
)
from energetica.sim.settlement import MIN_SETTLED_QUANTITY, SaleSettlement, settle_clearing
from energetica.workshop.demand_block import (
    DEMAND_TIERS,
    DemandCurve,
    SettlementPeriod,
    build_demand_block,
    nominal_demand,
)
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, Fuel
from energetica.workshop.fleet import OwnedFacility, capacity_factor, is_operating, om_owed
from energetica.workshop.fuel import FUEL_USE, FuelPurchase
from energetica.workshop.period_record import BidLine, Side, TradingPeriodRecord
from energetica.workshop.prices import DUMP_COST, SCARCITY_PRICE, PriceSheet, is_storage
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import SEASON_DAYS, SEASONS, Season, representative_week, season_days
from energetica.workshop.weather import Shares, Weather

SECONDS_PER_HOUR = 3_600
SECONDS_PER_DAY = 86_400

#: The categories whose output follows the weather and is offered as must-run power.
RENEWABLE_CATEGORIES = frozenset(
    {FacilityCategory.WIND, FacilityCategory.PV, FacilityCategory.CSP, FacilityCategory.HYDRO}
)

#: What every demand tier is multiplied by each time the grid restarts after a blackout, for the rest of the Round:
#: electricity is rationed (#1286).
RATIONING = 0.9

_MUST_SERVE = next(tier for tier in DEMAND_TIERS if tier.label == "must_serve")
# How far below full power a fuel-limited offer may be, as a share, and still count as full: what is left of
# rounding once the stock is spread over the clearings.
_SHORT_TOLERANCE = 1e-9


@dataclass(frozen=True, slots=True)
class Bidder:
    """What the engine needs to know about one player."""

    player_id: int
    owned_facilities: Sequence[OwnedFacility]
    prices: PriceSheet
    stored_energy: Mapping[FacilityId, float]
    """What the player's storage holds when the period starts, in Wh. A representative week starts from its
    cyclic charge instead."""
    fuel: Mapping[Fuel, float] | None = None
    """The fuel the player can burn over the period, in kg, or None if fuel never runs short, as under automatic
    procurement. A fuel left out has none."""


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
    # Zero for a result saved before these were kept (#1008).
    count: int = Field(default=0, description="How many facilities of the type were operating")
    om_fixed: float = Field(default=0.0, description="The part of the O&M charged whatever the use")
    om_variable_full: float = Field(
        default=0.0,
        description="The part of the O&M that scales with use, at full use. What was charged is this times the "
        "capacity factor",
    )
    # Zero for a result saved before fuel was counted (#1009).
    fuel_burned: float = Field(default=0.0, description="Fuel burned generating, in kg. Zero if it burns none")
    # False for a result saved before fuel stock limited output (#1010).
    ran_out_of_fuel: bool = Field(
        default=False,
        description="Whether a short fuel stock cut its offer below full power at a clearing where it could have "
        "sold more",
    )

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
    # Empty for a result saved before fuel was paid for (#1009).
    fuel: list[FuelPurchase] = Field(
        default=[], description="The fuel the player paid for in the period, which the session adds when it settles it"
    )
    # Zero for a result saved before climate events existed (#1012).
    revenue_tax_rate: float = Field(
        default=0.0,
        ge=0,
        le=1,
        description="The share of sale revenue a climate event took in the period, the same for every player, "
        "which the session adds when it settles it",
    )
    # Zero for a result saved before the carbon tax existed (#1015), or for a period it was not in force.
    carbon_tax_rate: float = Field(
        default=0.0, ge=0, description="What the carbon tax charged per kg of CO₂ in the period, or zero if none"
    )
    construction_emissions: float = Field(
        default=0.0,
        ge=0,
        description="The CO₂ emitted building the facilities bought in the Round's Investment phase, in kg, which the "
        "carbon tax charges in the Round's first Trading period. Zero in any other period",
    )
    carbon_tax_share: float = Field(
        default=0.0, ge=0, description="The player's equal share of the carbon tax takings of the period"
    )

    @property
    def revenue(self) -> float:
        """Gross market proceeds: money earned for energy sold, before any cost."""
        return sum(performance.revenue for performance in self.facilities.values())

    @property
    def revenue_tax(self) -> float:
        """What a climate event took off the period's sale revenue (#1012)."""
        return self.revenue * self.revenue_tax_rate

    @property
    def fuel_cost(self) -> float:
        """What the fuel the player paid for in the period cost."""
        return sum(purchase.cost for purchase in self.fuel)

    @property
    def operating_profit(self) -> float:
        """What the period earned before the carbon tax: the facilities' income less their costs, the revenue tax
        and fuel. The player's money changes by this minus :attr:`carbon_tax`.
        """
        return sum(performance.net for performance in self.facilities.values()) - self.revenue_tax - self.fuel_cost

    @property
    def emissions(self) -> float:
        """The CO₂ the player's facilities emitted generating in the period, in kg."""
        return sum(performance.emissions for performance in self.facilities.values())

    @property
    def construction_carbon_tax(self) -> float:
        """What the carbon tax charged on :attr:`construction_emissions` (#1015)."""
        return self.construction_emissions * self.carbon_tax_rate

    @property
    def emitted_carbon_tax(self) -> float:
        """What the carbon tax charged on the CO₂ the player's facilities emitted in the period (#1015)."""
        return self.emissions * self.carbon_tax_rate

    @property
    def carbon_tax_paid(self) -> float:
        """What the player paid in carbon tax in the period, on construction and on generation (#1015)."""
        return self.construction_carbon_tax + self.emitted_carbon_tax

    @property
    def carbon_tax(self) -> float:
        """The carbon tax the player paid in the period minus the share they got back. Below zero for a player who
        got back more than they paid.
        """
        return self.carbon_tax_paid - self.carbon_tax_share

    @property
    def fuels_run_out(self) -> set[Fuel]:
        """The fuels that ran short, holding back the output of a facility type burning them (#1010)."""
        return {
            fuel
            for facility, performance in self.facilities.items()
            if performance.ran_out_of_fuel and (fuel := CATALOG[facility].fuel_type) is not None
        }


@dataclass(frozen=True, slots=True)
class TradingOutcome:
    """Everything one Trading period produced."""

    results: dict[int, TradingResult]
    """Each player's result, by player id. A player with nothing operating has none."""
    stored_energy: dict[int, dict[FacilityId, float]]
    """Each player's stored energy at the end of the period, by player id, in Wh. A type holding nothing is
    left out."""
    blackouts: tuple[int, ...]
    """The settlement point of each blackout, in order: each clearing that left must-serve demand unserved and took the
    grid down for a day."""
    record: TradingPeriodRecord
    """What the period did at each settlement point, for its review."""
    peak_demand: float | None = None
    """The highest must-serve demand at one settlement point, in W: the period's peak demand (#1013, #1291). It
    counts every point of the simulated days, whether or not the market cleared there. None if there were none."""


@dataclass(slots=True)
class _FuelTank:
    """The fuel one player's pools share over the simulated days, in kg."""

    left: dict[Fuel, float]
    # What the offers placed so far in the current clearing could burn, so a later one cannot offer it too.
    reserved: dict[Fuel, float] = field(default_factory=dict)

    def available(self, fuel: Fuel) -> float:
        """The ``fuel`` left that no offer of the current clearing has reserved."""
        return max(0.0, self.left.get(fuel, 0.0) - self.reserved.get(fuel, 0.0))

    def reserve(self, fuel: Fuel, amount: float) -> None:
        """Hold ``amount`` of ``fuel`` for an offer of the current clearing."""
        self.reserved[fuel] = self.reserved.get(fuel, 0.0) + amount

    def burn(self, fuel: Fuel, amount: float) -> None:
        """Take ``amount`` of ``fuel``, burned generating, out of what is left."""
        self.left[fuel] = max(0.0, self.left.get(fuel, 0.0) - amount)


@dataclass(slots=True)
class _Pool:
    """A player's operating facilities of one type, run as one."""

    player_id: int
    facility: FacilityId
    owned: list[OwnedFacility]
    sell_price: float
    buy_price: float | None
    stored_energy: float = 0.0
    # The player's fuel, or None if it never runs short.
    tank: _FuelTank | None = None
    # The most the current clearing's fuel lets the pool offer, in W, and whether that is below its power.
    fuel_limit: float = math.inf
    fuel_short: bool = False
    ran_out_of_fuel: bool = False
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
    fuel_burned: float = 0.0
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
            offered = _unramped(self.fuel_limit, self.power)
            place_headroom_ask(market, self.player_id, 0.0, offered, self.sell_price, name)

    @property
    def burns_limited_fuel(self) -> bool:
        """Whether the pool burns a fuel the player holds only so much of."""
        return self.tank is not None and CATALOG[self.facility].fuel_type is not None

    def reserve_fuel(self, seconds_per_tick: float) -> None:
        """Work out the most the fuel left lets the pool offer at this clearing, and reserve the fuel that would
        burn. Only for a pool that :attr:`burns_limited_fuel`.
        """
        fuel = CATALOG[self.facility].fuel_type
        assert self.tank is not None and fuel is not None
        burn = self._burn_at_full_power(seconds_per_tick)
        self.fuel_limit = fuel_power_limit(self.power, [(burn, self.tank.available(fuel))])
        self.tank.reserve(fuel, fuel_burned(burn, _unramped(self.fuel_limit, self.power), self.power))
        self.fuel_short = self.fuel_limit < self.power * (1 - _SHORT_TOLERANCE)

    def _burn_at_full_power(self, seconds_per_tick: float) -> float:
        """The fuel, in kg, the pool burns in one clearing at full power."""
        return FUEL_USE.get(self.facility, 0.0) * self.power / 1_000_000 * seconds_per_tick / SECONDS_PER_HOUR

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
            burned = fuel_burned(self._burn_at_full_power(seconds_per_tick), produced, self.power)
            self.fuel_burned += burned
            fuel = CATALOG[self.facility].fuel_type
            if self.tank is not None and fuel is not None:
                self.tank.burn(fuel, burned)

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
        facility = CATALOG[self.facility]
        om_at_full_use = facility.om_per_round / len(SEASONS) * len(self.owned)
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
            count=len(self.owned),
            om_fixed=om_at_full_use * facility.om_fixed_share,
            om_variable_full=om_at_full_use * (1 - facility.om_fixed_share),
            fuel_burned=self.fuel_burned * scale,
            ran_out_of_fuel=self.ran_out_of_fuel,
        )


def _unramped(resource_limit: float, power: float) -> float:
    """The most a facility can output in a tick, from nothing: ramping limits are off (#1151)."""
    return max_output(resource_limit, 0.0, math.inf, power)


def _pools(bidder: Bidder, round_number: int, scale: float, *, empty: bool = False) -> list[_Pool]:
    """One pool per facility type ``bidder`` has operating in ``round_number``, sharing the bidder's fuel. Each
    simulated day stands for ``scale`` days, so the days get the fuel divided by it. Storage starts with what the
    bidder's holds, or with nothing if ``empty``.
    """
    operating: dict[FacilityId, list[OwnedFacility]] = {}
    for owned in bidder.owned_facilities:
        if is_operating(owned, current_round=round_number):
            operating.setdefault(owned.facility, []).append(owned)
    tank = None
    if bidder.fuel is not None:
        tank = _FuelTank({fuel: amount / scale for fuel, amount in bidder.fuel.items()})
    return [
        _Pool(
            player_id=bidder.player_id,
            facility=facility,
            owned=owned,
            sell_price=bidder.prices.sell[facility],
            buy_price=bidder.prices.buy[facility] if is_storage(facility) else None,
            stored_energy=0.0 if empty else bidder.stored_energy.get(facility, 0.0),
            tank=tank,
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


def _note_fuel_run_out(pools: Iterable[_Pool], clearing: MarketClearing) -> None:
    """Mark each pool whose fuel cut its offer short at ``clearing`` as having run out of fuel, if the offer could
    have sold more: the market cleared at or above its price, or the grid went down.
    """
    blackout = _is_blackout(clearing)
    for pool in pools:
        if pool.fuel_short and (blackout or clearing.price >= pool.sell_price):
            pool.ran_out_of_fuel = True


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
    return representative_week(season)


def cleared_day_count(season: Season, round_format: RoundFormat) -> int:
    """How many days the engine clears for a Trading period in ``season`` under ``round_format``: a representative
    week is cleared twice, for its cyclic start.
    """
    days = len(simulated_days(season, round_format))
    return days if round_format.trading_format == "full_season" else 2 * days


def demand_scale(season: Season, round_format: RoundFormat, curve: DemandCurve) -> float:
    """What every clearing's demand is multiplied by in a Trading period in ``season``: the season's average demand
    divided by the representative week's, both at the Round's clearings per day. One in full-season mode.
    """
    if round_format.trading_format == "full_season":
        return 1.0

    def average(days: Sequence[int]) -> float:
        clearings = round_format.clearings_per_day
        demands = [
            nominal_demand(1.0, curve, SettlementPeriod(day, clearing, clearings))
            for day in days
            for clearing in range(clearings)
        ]
        return sum(demands) / len(demands)

    return average(season_days(season)) / average(simulated_days(season, round_format))


@dataclass(slots=True)
class _Clearings:
    """What the market did at each settlement point of the simulated days."""

    price: np.ndarray
    quantity: np.ndarray
    offered: np.ndarray
    served: np.ndarray
    blackouts: list[int] = field(default_factory=list)
    # The highest must-serve demand at one settlement point so far, overwritten whenever a point's is higher.
    peak_demand: float | None = None


def _clear_days(
    pools: Mapping[tuple[int, str], _Pool],
    lines: Sequence[BidLine],
    days: Sequence[int],
    *,
    clearings_per_day: int,
    amplitude: float,
    curve: DemandCurve,
    shares: Shares,
    on_day_cleared: Callable[[], None],
    rationing: float = 1.0,
    outages: bool = True,
) -> _Clearings:
    """Clear ``days`` one after the other, recording what each of ``pools`` does at each clearing. ``lines`` are
    the bid lines the pools and the demand block place, and ``on_day_cleared`` is called after each day. Demand starts
    at ``rationing`` times its nominal level.

    A blackout takes the grid down for a day, then demand is rationed further. If ``outages`` is False, a blackout
    clearing settles nothing, the next ones clear as usual, and none is listed.
    """
    seconds_per_tick = SECONDS_PER_DAY / clearings_per_day
    tanks = {id(pool.tank): pool.tank for pool in pools.values() if pool.tank is not None}.values()
    # The order pools reserve fuel in at each clearing: the cheapest offer first.
    fuel_pools = sorted((pool for pool in pools.values() if pool.burns_limited_fuel), key=lambda pool: pool.sell_price)
    renewables = {pool.facility for pool in pools.values() if pool.renewable}
    line_index: dict[tuple[Side, int, str], int] = {
        (line.side, line.player_id, line.facility): index for index, line in enumerate(lines)
    }
    point_count = len(days) * clearings_per_day
    cleared = _Clearings(
        price=np.full(point_count, math.nan),
        quantity=np.full(point_count, math.nan),
        offered=np.zeros((len(lines), point_count)),
        served=np.zeros((len(DEMAND_TIERS), point_count)),
    )
    tier_index = {tier.player_id: index for index, tier in enumerate(DEMAND_TIERS)}
    # The first point the grid is back up at, after a blackout.
    down_until = 0

    for day_number, day in enumerate(days):
        for clearing in range(clearings_per_day):
            point = day_number * clearings_per_day + clearing
            period = SettlementPeriod(day, clearing, clearings_per_day)
            # Must-serve demand does not depend on what clears, so the peak counts points the grid is down at too. It
            # leaves rationing out, since rationing ends with the Round.
            must_serve = nominal_demand(amplitude, curve, period) * _MUST_SERVE.share
            if cleared.peak_demand is None or must_serve > cleared.peak_demand:
                cleared.peak_demand = must_serve
            if point < down_until:
                _record_nothing(pools.values(), seconds_per_tick)
                continue
            market = init_market()
            seconds = day * SECONDS_PER_DAY + clearing * seconds_per_tick
            # Every facility stands at the same position, so each type's weather is worked out once.
            weather = {facility: shares(facility, seconds) for facility in renewables}
            for tank in tanks:
                tank.reserved.clear()
            for pool in fuel_pools:
                pool.reserve_fuel(seconds_per_tick)
            for pool in pools.values():
                pool.place(market, weather.get(pool.facility, 0.0), seconds_per_tick)
            demand_block = build_demand_block(amplitude * rationing, curve, period)
            demands = market["demands"] + demand_block
            sides: tuple[tuple[Side, list[MarketEntry]], ...] = (("offer", market["capacities"]), ("demand", demands))
            for side, entries in sides:
                for entry in entries:
                    cleared.offered[line_index[(side, entry.player_id, entry.facility)], point] = entry.capacity
            result = clear_market(market["capacities"], demands)
            cleared.price[point], cleared.quantity[point] = result.price, result.quantity
            _note_fuel_run_out(fuel_pools, result)
            if _is_blackout(result):
                if outages:
                    cleared.blackouts.append(point)
                    down_until = point + clearings_per_day
                    rationing *= RATIONING
                _record_nothing(pools.values(), seconds_per_tick)
                continue
            if not math.isfinite(result.price):
                result = dataclasses.replace(result, price=SCARCITY_PRICE)
                cleared.price[point] = SCARCITY_PRICE
            settlement = settle_clearing(result, seconds_per_tick, DUMP_COST)
            sales = {(sale.player_id, sale.facility): sale for sale in settlement.sales}
            for key, pool in pools.items():
                pool.record(sales.get(key), seconds_per_tick)
            for purchase in settlement.purchases:
                pool = pools.get((purchase.player_id, purchase.facility))
                if pool is not None:
                    pool.record_purchase(purchase.power_bought, purchase.cost, seconds_per_tick)
                elif purchase.player_id in tier_index:
                    cleared.served[tier_index[purchase.player_id], point] = purchase.power_bought
            for pool in pools.values():
                pool.end_clearing()
        on_day_cleared()
    return cleared


def simulate_trading_period(
    bidders: Sequence[Bidder],
    *,
    round_number: int,
    season: Season,
    round_format: RoundFormat,
    amplitude: float,
    curve: DemandCurve,
    weather: Weather,
    rationing: float = 1.0,
    on_day_done: Callable[[int], None] | None = None,
) -> TradingOutcome:
    """Clear the days of ``season`` that ``round_format`` simulates, and add them up into the Trading period.

    ``amplitude`` and ``curve`` shape the demand block, and ``weather`` gives the renewables' output. ``rationing`` is
    what demand starts the period at, after the blackouts earlier in the Round: :data:`RATIONING` to the power of how
    many there were.
    ``on_day_done``, if given, is called after each day cleared with how many are done, out of
    :func:`cleared_day_count`.
    """
    clearings_per_day = round_format.clearings_per_day
    seconds_per_tick = SECONDS_PER_DAY / clearings_per_day
    days = simulated_days(season, round_format)
    full_season = round_format.trading_format == "full_season"
    # A representative week stands for the whole season. Full-season days are all literal.
    scale = SEASON_DAYS / len(days)
    season_weather = weather.season(season)
    scaled_amplitude = amplitude * demand_scale(season, round_format, curve)
    days_done = 0

    def on_day_cleared() -> None:
        nonlocal days_done
        days_done += 1
        if on_day_done is not None:
            on_day_done(days_done)

    def clear(pools: dict[tuple[int, str], _Pool], *, outages: bool = True) -> _Clearings:
        return _clear_days(
            pools,
            lines,
            days,
            clearings_per_day=clearings_per_day,
            amplitude=scaled_amplitude,
            curve=curve,
            shares=season_weather.shares if full_season else season_weather.week,
            on_day_cleared=on_day_cleared,
            rationing=rationing,
            outages=outages,
        )

    def build_pools(*, empty: bool = False) -> dict[tuple[int, str], _Pool]:
        return {
            (pool.player_id, pool.facility.value): pool
            for bidder in bidders
            for pool in _pools(bidder, round_number, scale, empty=empty)
        }

    pools = build_pools(empty=not full_season)
    lines = _bid_lines(pools.values())
    if not full_season:
        # The cyclic start: clear the week once from empty, then again from the charge it ended with. A blackout in
        # the first pass, which starts with nothing stored, does not take the grid down, so it still finds that charge.
        clear(pools, outages=False)
        warmed = {key: pool.stored_energy for key, pool in pools.items()}
        pools = build_pools()
        for key, pool in pools.items():
            pool.stored_energy = warmed[key]
    cleared = clear(pools)

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

    point_count = len(days) * clearings_per_day

    def series(values: Callable[[_Pool], list[float]]) -> np.ndarray:
        return np.array([values(pool) for pool in pools.values()], dtype=np.float64).reshape(len(pools), point_count)

    record = TradingPeriodRecord(
        round=round_number,
        season=season,
        clearings_per_day=clearings_per_day,
        days=tuple(days),
        blackouts=tuple(cleared.blackouts),
        price=cleared.price,
        quantity=cleared.quantity,
        pools=tuple(pools),
        generation=series(lambda pool: pool.production),
        dumped=series(lambda pool: pool.dumped_power),
        charged=series(lambda pool: pool.charged_power),
        stored=series(lambda pool: pool.stored_series),
        storage_capacity=np.array([pool.capacity for pool in pools.values()], dtype=np.float64),
        tiers=tuple(tier.label for tier in DEMAND_TIERS),
        served=cleared.served,
        lines=tuple(lines),
        offered=cleared.offered,
        average_output=season_weather.average_output,
    )
    return TradingOutcome(
        results=results,
        stored_energy=stored_energy,
        blackouts=tuple(cleared.blackouts),
        record=record,
        peak_demand=cleared.peak_demand,
    )
