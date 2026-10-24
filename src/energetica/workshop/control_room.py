"""The control room (#1289): the figures the projector dashboard shows the whole room.

The dashboard gathers on one screen what can help players decide, styled like a grid operator's control room. Anyone
in the Run can open it, and it names no player. Pure: the session gathers what it needs, and the functions here work
out each panel.

- **Alarms**, newest first: the events that fired, each blackout and the rationing it left, each unlock, and the
  carbon tax vote. Every event shows with its exact effect as soon as it fires: a Round event when the Investment
  phase opens, and a seasonal event when its Trading period opens, so the room knows it while it sets its prices.
- **Capacity against demand** (#1287): what the facilities working this Round can produce, those players have
  selected to buy included, against the must-serve peak: the Round's, or in a Trading period, its season's. Either
  way, with how likely a blackout is.
- **Carbon**: the CO₂ the room emitted in each Round, building and running its facilities.
- **Each settled season**: its average market price with the spread of its clearing prices, and the room's
  generation by power source.
- **The room's prices** for each power source, as a box per Trading period: the lowest, the quartiles, the median
  and the highest price players set, pooled across tiers and players.
- **The price-duration curve** of the last settled season: its clearing prices, highest first.
- **Fuel prices**: each fuel's price this season and its last few prices, worked out again from the Run's seed, so
  none are kept. Those from before the session are made up.

Every chart over seasons shows at most the last :data:`HISTORY_SEASONS`, so a long session stays readable.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
import math
from enum import StrEnum
from typing import Annotated, Literal, NamedTuple

import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, ConfigDict, Field

from energetica.workshop.blackout import Blackout
from energetica.workshop.events import EVENTS, EventCategory, FiredEvent, effect_line
from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, Fuel
from energetica.workshop.fleet import Purchase
from energetica.workshop.prices import MarketPrices
from energetica.workshop.recap import emissions
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.trading import RATIONING, TradingResult
from energetica.workshop.unlocks import Unlock
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome

#: How many seasons each chart over seasons shows at most.
HISTORY_SEASONS = 8
#: How many prices each fuel's chart shows, those from before the session included.
FUEL_HISTORY_POINTS = 9
#: How many prices the price-duration curve keeps, spread evenly from the highest to the lowest.
DURATION_POINTS = 200


class PowerSource(StrEnum):
    """What the dashboard groups facilities by: the fuel or the weather they run on. A base tier and its upgrade
    share one, and so do coal and gas plants of every tier.
    """

    COAL = "coal"
    GAS = "gas"
    NUCLEAR = "nuclear"
    HYDRO = "hydro"
    WIND = "wind"
    SOLAR = "solar"
    STORAGE = "storage"


_SOURCES: dict[FacilityCategory, PowerSource] = {
    FacilityCategory.WIND: PowerSource.WIND,
    FacilityCategory.HYDRO: PowerSource.HYDRO,
    FacilityCategory.NUCLEAR: PowerSource.NUCLEAR,
    FacilityCategory.PV: PowerSource.SOLAR,
    FacilityCategory.CSP: PowerSource.SOLAR,
    FacilityCategory.BATTERIES: PowerSource.STORAGE,
    FacilityCategory.HYDROGEN_STORAGE: PowerSource.STORAGE,
    FacilityCategory.PUMPED_HYDRO: PowerSource.STORAGE,
}


def power_source(facility: FacilityId) -> PowerSource:
    """The power source ``facility`` counts towards."""
    entry = CATALOG[facility]
    if entry.category == FacilityCategory.CONVENTIONAL:
        return PowerSource.COAL if entry.fuel_type == Fuel.COAL else PowerSource.GAS
    return _SOURCES[entry.category]


# --- the room's prices ----------------------------------------------------------------------------

PriceGroup = Literal["coal", "gas", "nuclear", "hydro", "wind", "solar", "storage_sell", "storage_buy"]

_PRICE_GROUPS: dict[PowerSource, PriceGroup] = {
    PowerSource.COAL: "coal",
    PowerSource.GAS: "gas",
    PowerSource.NUCLEAR: "nuclear",
    PowerSource.HYDRO: "hydro",
    PowerSource.WIND: "wind",
    PowerSource.SOLAR: "solar",
    PowerSource.STORAGE: "storage_sell",
}


class PriceBox(BaseModel):
    """The spread of the prices players set, per MWh, as a box plot draws it."""

    model_config = ConfigDict(frozen=True)

    low: float
    q1: float
    median: float
    q3: float
    high: float


def price_box(prices: Sequence[float]) -> PriceBox | None:
    """The box of ``prices``, or None if there are none."""
    if not prices:
        return None
    low, q1, median, q3, high = np.percentile(np.asarray(prices, dtype=np.float64), [0, 25, 50, 75, 100])
    return PriceBox(low=float(low), q1=float(q1), median=float(median), q3=float(q3), high=float(high))


class RoomPrices(BaseModel):
    """The room's prices in one Trading period, by power source, with no names."""

    model_config = ConfigDict(frozen=True)

    round: int
    season: Season
    live: bool = Field(description="Whether the price-setting window is open, so the prices can still change")
    boxes: dict[PriceGroup, PriceBox] = Field(
        description="The box of each power source someone has a price for. Storage has one for the price it sells at "
        "and one for the price it buys at"
    )


def room_prices(market: MarketPrices) -> RoomPrices:
    """Every player's prices in ``market``, pooled by power source."""
    pooled: dict[PriceGroup, list[float]] = {}
    for player in market.players:
        for facility, quote in player.sell.items():
            pooled.setdefault(_PRICE_GROUPS[power_source(facility)], []).append(quote.price)
        for quote in player.buy.values():
            pooled.setdefault("storage_buy", []).append(quote.price)
    boxes: dict[PriceGroup, PriceBox] = {
        group: box for group, prices in pooled.items() if (box := price_box(prices)) is not None
    }
    return RoomPrices(round=market.round, season=market.season, live=market.live, boxes=boxes)


# --- what each season did -------------------------------------------------------------------------


def room_generation(results: Iterable[TradingResult]) -> dict[PowerSource, float]:
    """The energy every player generated over ``results`` by power source, in Wh. Storage counts what it
    discharged.
    """
    energy: dict[PowerSource, float] = {}
    for result in results:
        for facility, performance in result.facilities.items():
            source = power_source(facility)
            energy[source] = energy.get(source, 0.0) + performance.generation
    return energy


class PriceSummary(NamedTuple):
    """What a settled Trading period's clearing prices looked like."""

    low: float
    """The 10th percentile of the clearing prices, per MWh."""
    high: float
    """The 90th percentile."""
    duration_curve: list[float]
    """The clearing prices from the highest to the lowest, thinned out evenly."""


def price_summary(prices: npt.NDArray[np.float64], *, points: int = DURATION_POINTS) -> PriceSummary | None:
    """The summary of a period's clearing ``prices``, one per settlement point, or None if none settled. A point at
    a blackout, or while the grid was down after one, settled nothing, so it is left out.
    """
    settled = prices[np.isfinite(prices)]
    if settled.size == 0:
        return None
    low, high = np.percentile(settled, [10, 90])
    descending = np.sort(settled)[::-1]
    if descending.size > points:
        descending = descending[np.linspace(0, descending.size - 1, points).round().astype(int)]
    return PriceSummary(low=float(low), high=float(high), duration_curve=descending.tolist())


class SeasonFigures(BaseModel):
    """What a settled Trading period did across the whole room."""

    round: int
    season: Season
    average_price: float | None = Field(
        description="What generators earned per MWh sold, as in the Recap. Null if nothing sold"
    )
    price_low: float | None = Field(
        description="The 10th percentile of the clearing prices, per MWh. Null if the period has no record"
    )
    price_high: float | None = Field(description="The 90th percentile of the clearing prices, per MWh")
    generation: dict[PowerSource, float] = Field(description="The energy the room generated by power source, in Wh")


class DurationCurve(BaseModel):
    """The last settled season's clearing prices, from the highest to the lowest."""

    round: int
    season: Season
    prices: list[float] = Field(description="Prices per MWh, evenly spread over the period's settlement points")


# --- carbon ---------------------------------------------------------------------------------------


class RoundEmissions(BaseModel):
    """The CO₂ the room emitted in one Round, building its facilities and running them."""

    model_config = ConfigDict(frozen=True)

    round: int
    emissions: float = Field(description="In kg")
    complete: bool = Field(description="Whether the Round is over: its Recap has opened")


def round_emissions(
    purchases: Sequence[Purchase], results: Sequence[TradingResult], *, rounds: int, completed: int
) -> list[RoundEmissions]:
    """The emissions of Rounds 1 to ``rounds``, of which the first ``completed`` are over."""
    return [
        RoundEmissions(
            round=round_number,
            emissions=emissions(
                [purchase for purchase in purchases if purchase.round == round_number],
                [result for result in results if result.round == round_number],
            ),
            complete=round_number <= completed,
        )
        for round_number in range(1, rounds + 1)
    ]


class CarbonTaxStatus(BaseModel):
    """Whether the carbon tax is in force, or being voted on."""

    rate: float = Field(description="What the tax charges, or would charge, per kg of CO₂")
    since: int | None = Field(description="The Round whose vote put it in force, or null if none passed")
    vote_open: bool = Field(description="Whether players are voting on it now")


# --- capacity against demand (#1287) -------------------------------------------------------------

#: The share of its power a dam always produces: the lowest the river table gives. It counts as controllable.
HYDRO_GUARANTEED_SHARE = 0.23
#: How many hours storage must be able to keep up its power to count at full power. An arbitrary constant.
STORAGE_HOURS = 16


class BlackoutRisk(StrEnum):
    """How likely the room's capacity is to leave must-serve demand unserved at the Round's peak."""

    GUARANTEED = "guaranteed"
    LIKELY = "likely"
    UNLIKELY = "unlikely"
    VERY_UNLIKELY = "very_unlikely"


class RoomCapacity(BaseModel):
    """What the room's facilities can produce in a Round, in W, and what its storage holds."""

    model_config = ConfigDict(frozen=True)

    controllable: float = Field(
        description="Power that can be produced on demand: fossil plants, nuclear and hydro's guaranteed share, in W"
    )
    total: float = Field(description="Controllable power plus the rest of hydro, wind and solar, in W")
    weighted: float = Field(
        description="Weather-dependent power weighted by how much of it each type produces on average: hydro above "
        "its guaranteed share, wind and solar, in W"
    )
    storage_power: float = Field(description="In W")
    storage_energy: float = Field(description="In Wh")


def room_capacity(facilities: Iterable[FacilityId], capacity_factors: Mapping[FacilityId, float]) -> RoomCapacity:
    """The capacity of ``facilities``, one entry per facility. ``capacity_factors`` gives each weather-dependent
    type's average output as a share of its power.
    """
    controllable = total = weighted = storage_power = storage_energy = 0.0
    for facility in facilities:
        entry = CATALOG[facility]
        power = entry.base_power_generation
        match power_source(facility):
            case PowerSource.STORAGE:
                storage_power += power
                storage_energy += entry.base_storage_capacity or 0.0
            case PowerSource.COAL | PowerSource.GAS | PowerSource.NUCLEAR:
                controllable += power
                total += power
            case PowerSource.HYDRO:
                controllable += power * HYDRO_GUARANTEED_SHARE
                total += power
                weighted += power * (capacity_factors[facility] - HYDRO_GUARANTEED_SHARE)
            case PowerSource.WIND | PowerSource.SOLAR:
                total += power
                weighted += power * capacity_factors[facility]
    return RoomCapacity(
        controllable=controllable,
        total=total,
        weighted=weighted,
        storage_power=storage_power,
        storage_energy=storage_energy,
    )


def blackout_risk(peak: float, capacity: RoomCapacity) -> BlackoutRisk:
    """How likely a blackout is at must-serve ``peak``, in W, given the room's ``capacity``.

    Below the peak with everything running, a blackout is guaranteed. With enough controllable power, it is very
    unlikely, though a player can still run out of fuel. In between, storage decides: it is enough when the geometric
    mean of the weighted weather-dependent power and the storage power covers the gap. Storage counts only the power
    it can keep up for :data:`STORAGE_HOURS`.
    """
    if capacity.total < peak:
        return BlackoutRisk.GUARANTEED
    if capacity.controllable >= peak:
        return BlackoutRisk.VERY_UNLIKELY
    storage = min(capacity.storage_power, capacity.storage_energy / STORAGE_HOURS)
    if math.sqrt(capacity.weighted * storage) > peak - capacity.controllable:
        return BlackoutRisk.UNLIKELY
    return BlackoutRisk.LIKELY


class CapacityOutlook(BaseModel):
    """The room's capacity in a Round against its must-serve peak, for the control room's capacity panel: the peak of
    the season whose Trading period the session is in, or else of the whole Round.
    """

    round: int
    season: Season | None = Field(
        description="The season the peak is for, in its Trading period, or null when it is the whole Round's"
    )
    must_serve_peak: float = Field(
        description="The highest must-serve demand of the season or the Round, in W, with its events, planned ones "
        "included, and before any rationing"
    )
    all_tiers_peak: float = Field(description="The highest demand counting every demand tier, in W")
    round_all_tiers_peak: float = Field(
        description="The Round's highest demand counting every demand tier, in W, so a season's peaks can be drawn "
        "on the Round's scale. The same as ``all_tiers_peak`` outside a Trading period"
    )
    room: RoomCapacity = Field(
        description="What the facilities working in the Round can produce: those owned and those selected to buy"
    )
    risk: BlackoutRisk


# --- alarms ---------------------------------------------------------------------------------------


class EventAlarm(BaseModel):
    """An event that fired."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["event"] = "event"
    round: int
    season: Season | None = Field(
        description="The Trading period it fired at, or null for one that fired with the Round"
    )
    category: EventCategory
    name: str
    effect: str = Field(description="What it does, in one short line of plain numbers, as the Recap prints it")


class BlackoutAlarm(BaseModel):
    """The grid going down."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["blackout"] = "blackout"
    round: int
    season: Season
    day: int = Field(description="The day of the year it happened on, from 0")
    minute: int = Field(description="The minute of the day it happened at, from 0")


class RationingAlarm(BaseModel):
    """Demand cut once more after a blackout, until the end of the Round."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["rationing"] = "rationing"
    round: int
    season: Season
    rationing: float = Field(description="What demand is cut to for the rest of the Round, 0.81 for 81%")


class UnlockAlarm(BaseModel):
    """A facility players can buy from a Round on."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["unlock"] = "unlock"
    round: int = Field(description="The first Round it can be bought in")
    season: None = None
    facility: FacilityId
    name: str


class VoteAlarm(BaseModel):
    """A carbon tax vote: open, or with its result."""

    model_config = ConfigDict(frozen=True)

    kind: Literal["vote"] = "vote"
    round: int
    season: Season | None = Field(
        description="Spring for a result, which is announced as the Round's first Trading period opens. Null while "
        "the vote is open in the Investment phase"
    )
    passed: bool | None = Field(description="Whether the tax passed, or null while the vote is open")
    tax_rate: float = Field(description="What the tax charges, or would charge, per kg of CO₂")


Alarm = Annotated[
    EventAlarm | BlackoutAlarm | RationingAlarm | UnlockAlarm | VoteAlarm,
    Field(discriminator="kind"),
]


def _when(round_number: int, season: Season | None, within: float) -> tuple[int, int, float]:
    """Where an alarm falls in the session: its Round, its step in the Round (the Investment phase, then each season),
    and ``within``, its order in that step. Within a step, an unlock (-2, announced at the Recap before) comes first,
    then what fires as the step opens (-1: an event, or a vote's result), then an open vote (0), then each blackout
    by its place in the list, with its rationing just after it.
    """
    return round_number, 0 if season is None else 1 + SEASONS.index(season), within


def alarms(
    *,
    fired: Iterable[FiredEvent],
    blackouts: Iterable[Blackout],
    unlocks: Iterable[Unlock],
    vote_outcomes: Iterable[VoteOutcome],
    vote_open: int | None,
) -> list[Alarm]:
    """Every alarm raised so far, newest first. ``vote_open`` is the Round whose carbon tax vote is open now, if any."""
    raised: list[tuple[tuple[int, int, float], Alarm]] = []

    for unlock in unlocks:
        # Announced at the Recap before, so before anything else in its Round.
        raised.append(
            (
                _when(unlock.round, None, -2),
                UnlockAlarm(round=unlock.round, facility=unlock.facility, name=CATALOG[unlock.facility].name),
            )
        )
    for event in fired:
        catalog = EVENTS.get(event.event)
        if catalog is None:
            continue
        raised.append(
            (
                _when(event.round, event.season, -1),
                EventAlarm(
                    round=event.round,
                    season=event.season,
                    category=catalog.category,
                    name=catalog.name,
                    effect=effect_line(event),
                ),
            )
        )
    for outcome in vote_outcomes:
        raised.append(
            (
                _when(outcome.round, SEASONS[0], -1),
                VoteAlarm(round=outcome.round, season=SEASONS[0], passed=outcome.passed, tax_rate=CARBON_TAX_RATE),
            )
        )
    if vote_open is not None:
        raised.append(
            (_when(vote_open, None, 0), VoteAlarm(round=vote_open, season=None, passed=None, tax_rate=CARBON_TAX_RATE))
        )
    earlier_in_round: dict[int, int] = {}
    # Blackouts come in order. Winter runs over the end of the year, so the day of the year cannot order them.
    for at, blackout in enumerate(blackouts):
        count = earlier_in_round.get(blackout.round, 0) + 1
        earlier_in_round[blackout.round] = count
        raised.append(
            (
                _when(blackout.round, blackout.season, at),
                BlackoutAlarm(round=blackout.round, season=blackout.season, day=blackout.day, minute=blackout.minute),
            )
        )
        raised.append(
            (
                _when(blackout.round, blackout.season, at + 0.5),
                RationingAlarm(round=blackout.round, season=blackout.season, rationing=RATIONING**count),
            )
        )
    raised.sort(key=lambda pair: pair[0], reverse=True)
    return [alarm for _, alarm in raised]


# --- the whole dashboard --------------------------------------------------------------------------


class FuelQuote(BaseModel):
    """A fuel's price this season."""

    fuel: Fuel
    name: str
    price: float = Field(description="The price per kg")
    change: float | None = Field(
        description="The change since last season, as a share of last season's price, or null before the second season"
    )
    shocked: bool = Field(description="Whether a price shock landed this season")
    history: list[float] = Field(
        description="The last prices per kg, oldest first, ending with this season's. Those from before the session "
        "are made up"
    )


class ControlRoom(BaseModel):
    """Everything the control room shows, apart from where the session is, which the session's own answer gives."""

    alarms: list[Alarm] = Field(description="Every alarm raised so far, newest first")
    emissions: list[RoundEmissions] = Field(description="Each Round's emissions, from Round 1 to the current one")
    carbon_tax: CarbonTaxStatus
    capacity: CapacityOutlook
    seasons: list[SeasonFigures] = Field(description="The last settled seasons, oldest first")
    duration_curve: DurationCurve | None = Field(
        description="The last settled season's price-duration curve, or null if no season with a record has settled"
    )
    room_prices: list[RoomPrices] = Field(
        description="The room's prices in the last Trading periods, oldest first, the current one included"
    )
    fuels: list[FuelQuote] = Field(
        description="Every fuel's price this season, or its catalog price before the first season"
    )
