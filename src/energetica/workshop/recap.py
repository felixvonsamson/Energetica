"""The Recap between two Rounds (#1013): a newspaper that tells the room what happened, and what is coming.

The Recap that closes Round N has two sections, kept strictly apart:

- **The Year in Review** tells what happened in Round N: every event that fired in it, with its headline and a
  line of plain numbers (:func:`~energetica.workshop.events.effect_line`), the season the grid went down in if it
  did, and the room's figures for the Round.
- **The Year Ahead** tells what Round N+1 holds. Its plan locks when Recap N opens (#1190), so what the Recap tells
  holds. Round events are told with their headline and exact effect, and seasonal events only as a forecast with
  no figures (#1189). The facilities that unlock for Round N+1 are announced here, the first place players learn
  of them (#1011). The last Round has no Year Ahead.

Everyone in the Run reads the same Recap, the facilitator included, and only once it has opened: a headline is
never told before. Vote outcomes are not told here, since they are announced live (#1014). Pure: the session
gathers what a Recap needs, and :func:`recap` builds it.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

from pydantic import BaseModel, Field

from energetica.sim.national_demand import national_demand_curve
from energetica.workshop.events import (
    EVENTS,
    Direction,
    EventCategory,
    FiredEvent,
    Severity,
    effect_line,
    round_demand_factor,
)
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import Purchase
from energetica.workshop.prices import is_storage
from energetica.workshop.round_plan import RoundPlan
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.trading import RENEWABLE_CATEGORIES, TradingResult
from energetica.workshop.unlocks import UPGRADES, Unlock, UnlockTrigger


class RecapStory(BaseModel):
    """An event, told as a newspaper article."""

    event: str = Field(description="The event's id")
    name: str = Field(description="The event's name, the article's title")
    category: EventCategory
    direction: Direction
    severity: Severity
    season: Season | None = Field(description="The Trading period it fires at, or null for one that lasts the Round")
    headline: str
    effect: str = Field(description="What it does, in one short line of plain numbers")


class RecapForecast(BaseModel):
    """A seasonal event of the coming Round, told only as a vague forecast: nothing says which event it is, how severe,
    or by how much.
    """

    season: Season
    text: str


class RecapUnlock(BaseModel):
    """A facility players can buy from the coming Round on."""

    facility: FacilityId
    name: str
    trigger: UnlockTrigger
    base: FacilityId | None = Field(description="The base tier whose spend unlocked it, for an upgrade")
    base_name: str | None


class RoomFigures(BaseModel):
    """The whole room's figures for one Round."""

    emissions_round: float = Field(description="CO₂ every player emitted in the Round, building and running, in kg")
    emissions_total: float = Field(description="CO₂ every player emitted from Round 1 to the end of this one, in kg")
    capacity_built: float = Field(description="Power of every facility bought in the Round, in W")
    energy_sold: float = Field(
        description="Energy every player's generators sold in the Round, in Wh. Storage is left out, since it resells "
        "energy generated elsewhere"
    )
    average_price: float | None = Field(description="Sale revenue per MWh sold, or null if nothing sold")
    renewable_share: float | None = Field(
        description="Share of the energy sold that came from renewables, from 0 to 1. Null if nothing sold"
    )


class DemandOutlook(BaseModel):
    """How peak demand moves from this Round to the next, through the Round events that last."""

    peak_this_round: float = Field(description="In W")
    peak_next_round: float = Field(description="In W")


class YearAhead(BaseModel):
    """What the coming Round holds."""

    round: int
    unlocks: list[RecapUnlock]
    stories: list[RecapStory] = Field(description="The Round events planned for it, which fire when it opens")
    forecasts: list[RecapForecast] = Field(description="Its seasonal events, in season order")
    demand: DemandOutlook | None = Field(description="Null before any Trading period has set the demand")


class WorkshopRecap(BaseModel):
    """The Recap that closes a Round."""

    round: int
    round_count: int
    blackout: Season | None = Field(description="The season the grid went down in this Round, if it did")
    stories: list[RecapStory] = Field(
        description="Every event that fired in the Round: the Round's own first, then each season's in order"
    )
    figures: RoomFigures
    year_ahead: YearAhead | None = Field(description="Null after the last Round")


def peak_demand(amplitude: float) -> float:
    """The highest demand the demand curve reaches with ``amplitude``, in W."""
    curve = national_demand_curve()
    return amplitude * max(curve.intraday) * max(curve.seasonal)


def _season_order(season: Season | None) -> int:
    return -1 if season is None else SEASONS.index(season)


def _story(fired: FiredEvent) -> RecapStory | None:
    event = EVENTS.get(fired.event)
    if event is None or fired.severity not in event.headlines:
        return None
    return RecapStory(
        event=fired.event,
        name=event.name,
        category=event.category,
        direction=event.direction,
        severity=fired.severity,
        season=fired.season,
        headline=event.headlines[fired.severity],
        effect=effect_line(fired),
    )


def _stories(fired: Iterable[FiredEvent]) -> list[RecapStory]:
    ordered = sorted(fired, key=lambda event: _season_order(event.season))
    return [story for event in ordered if (story := _story(event)) is not None]


def emissions(purchases: Iterable[Purchase], results: Iterable[TradingResult]) -> float:
    """The CO₂ emitted building the facilities ``purchases`` bought and running them for ``results``, in kg."""
    built = sum(CATALOG[purchase.facility].base_construction_pollution for purchase in purchases)
    ran = sum(performance.emissions for result in results for performance in result.facilities.values())
    return built + ran


def _figures(round_number: int, *, purchases: Sequence[Purchase], results: Sequence[TradingResult]) -> RoomFigures:
    # Storage resells energy generated elsewhere, so only generators count towards what was sold.
    sold = [
        (facility, performance)
        for result in results
        if result.round == round_number
        for facility, performance in result.facilities.items()
        if not is_storage(facility)
    ]
    energy = sum(performance.sold for _, performance in sold)
    revenue = sum(performance.revenue for _, performance in sold)
    renewable = sum(
        performance.sold for facility, performance in sold if CATALOG[facility].category in RENEWABLE_CATEGORIES
    )
    return RoomFigures(
        emissions_round=emissions(
            [purchase for purchase in purchases if purchase.round == round_number],
            [result for result in results if result.round == round_number],
        ),
        emissions_total=emissions(
            [purchase for purchase in purchases if purchase.round <= round_number],
            [result for result in results if result.round <= round_number],
        ),
        capacity_built=sum(
            CATALOG[purchase.facility].base_power_generation for purchase in purchases if purchase.round == round_number
        ),
        energy_sold=energy,
        average_price=revenue / (energy / 1e6) if energy > 0 else None,
        renewable_share=renewable / energy if energy > 0 else None,
    )


def _unlock(unlock: Unlock) -> RecapUnlock:
    base = next((base for base, upgrade in UPGRADES.items() if upgrade == unlock.facility), None)
    if unlock.trigger != "investment_threshold":
        base = None
    return RecapUnlock(
        facility=unlock.facility,
        name=CATALOG[unlock.facility].name,
        trigger=unlock.trigger,
        base=base,
        base_name=CATALOG[base].name if base is not None else None,
    )


def _year_ahead(
    next_round: int, *, plan: RoundPlan, fired: Sequence[FiredEvent], unlocks: Sequence[Unlock], amplitude: float | None
) -> YearAhead:
    # The plan is locked, so its events fire as planned: told as if they had.
    planned_events = [planned for planned in plan.events if planned.event in EVENTS]
    coming = [FiredEvent.of(planned, round_number=next_round, season=planned.season) for planned in planned_events]
    forecasts = [
        RecapForecast(
            season=planned.season,
            text=EVENTS[planned.event].forecast(planned.severity, season=planned.season, fuel=planned.fuel),
        )
        for planned in sorted(planned_events, key=lambda planned: _season_order(planned.season))
        if planned.season is not None
    ]
    demand = None
    if amplitude is not None:
        peak = peak_demand(amplitude)
        demand = DemandOutlook(
            peak_this_round=peak * round_demand_factor(fired, next_round - 1),
            peak_next_round=peak * round_demand_factor([*fired, *coming], next_round),
        )
    return YearAhead(
        round=next_round,
        unlocks=[_unlock(unlock) for unlock in unlocks if unlock.round == next_round],
        stories=_stories(event for event in coming if event.season is None),
        forecasts=forecasts,
        demand=demand,
    )


def recap(
    round_number: int,
    *,
    round_count: int,
    plans: Sequence[RoundPlan],
    fired: Sequence[FiredEvent],
    blackouts: Iterable[tuple[int, Season]],
    unlocks: Sequence[Unlock],
    purchases: Sequence[Purchase],
    results: Sequence[TradingResult],
    demand_amplitude: float | None,
) -> WorkshopRecap:
    """The Recap that closes Round ``round_number`` of ``round_count``.

    ``plans`` holds every Round's plan, ``fired`` every event that fired, ``blackouts`` the Trading period of every
    blackout as (Round, season), and ``unlocks`` every unlock. ``purchases`` and ``results`` are every player's, and
    ``demand_amplitude`` the session's demand before any event, or None if no Trading period has set it.
    """
    blackout: Season | None = next(
        (season for blackout_round, season in blackouts if blackout_round == round_number), None
    )
    return WorkshopRecap(
        round=round_number,
        round_count=round_count,
        blackout=blackout,
        stories=_stories(event for event in fired if event.round == round_number),
        figures=_figures(round_number, purchases=purchases, results=results),
        year_ahead=None
        if round_number >= round_count
        else _year_ahead(
            round_number + 1,
            plan=plans[round_number],
            fired=[event for event in fired if event.round <= round_number],
            unlocks=unlocks,
            amplitude=demand_amplitude,
        ),
    )
