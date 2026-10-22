"""The Recap between two Rounds (#1013): a newspaper that tells the room what happened, and what is coming.

The Recap that closes Round N has two sections, kept strictly apart:

- **The Year in Review** tells what happened in Round N: every event that fired in it, with its headline and a
  line of plain numbers (:func:`~energetica.workshop.events.effect_line`), the season the grid went down in if it
  did, the room's figures for the Round, and each season's weather: how its wind and sunshine compared with a
  normal season (#1200). The weather only tells what happened, never what is coming.
- **The Year Ahead** tells what Round N+1 holds. Its plan locks when Recap N opens (#1190), so what the Recap tells
  holds. Round events are told with their headline and exact effect, and seasonal events only as a forecast with
  no figures (#1189). The facilities that unlock for Round N+1 are announced here, the first place players learn
  of them (#1011). So is how much demand grows into Round N+1 (#1226), as a percentage without the formula behind
  it. The last Round has no Year Ahead.

Everyone in the Run reads the same Recap, the facilitator included, and only once it has opened: a headline is
never told before. Vote outcomes are not told here, since they are announced live (#1014), but a carbon tax vote
planned for the coming Round is announced in The Year Ahead, with the tax it proposes. Pure: the session
gathers what a Recap needs, and :func:`recap` builds it.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

from pydantic import BaseModel, Field

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
from energetica.workshop.votes import CARBON_TAX_RATE, VoteOutcome, vote_held
from energetica.workshop.weather import NORMAL_OUTPUT, AverageOutput


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


class SeasonWeatherReport(BaseModel):
    """How a season's wind and sunshine compared with a normal season's (#1200). Hydro follows a fixed table, so it
    is left out.
    """

    season: Season
    wind: float = Field(
        description="The season's average wind output against a normal season's, as a change: 0.08 is 8% above normal"
    )
    solar: float = Field(
        description="The season's average solar output against a normal season's, as a change: -0.03 is 3% below normal"
    )


class DemandOutlook(BaseModel):
    """How peak must-serve demand moves from this Round to the next, through demand growth and the Round events that
    last.
    """

    peak_this_round: float = Field(
        description="The highest must-serve demand at one settlement point this Round, in W (#1291)"
    )
    peak_next_round: float = Field(
        description="This Round's peak grown by next Round's demand growth and moved by the demand shifts that start"
        " next Round, in W: a forecast"
    )


class RecapVote(BaseModel):
    """A carbon tax vote the coming Round holds in its Investment phase."""

    tax_rate: float = Field(description="What the proposed tax charges per kg of CO₂ emitted")


class YearAhead(BaseModel):
    """What the coming Round holds."""

    round: int
    unlocks: list[RecapUnlock]
    stories: list[RecapStory] = Field(description="The Round events planned for it, which fire when it opens")
    forecasts: list[RecapForecast] = Field(description="Its seasonal events, in season order")
    demand_growth: float = Field(
        description="The factor demand grows by from this Round to the next before any event, 1.35 for 35% (#1226)"
    )
    demand: DemandOutlook | None = Field(description="Null if no Trading period of this Round was simulated")
    carbon_tax_vote: RecapVote | None = Field(description="The vote the Round holds, or null if it holds none")
    manual_fuel_procurement_starts: bool = Field(
        description="Whether players start buying their own fuel in the Round, after a Round of automatic procurement"
    )


class WorkshopRecap(BaseModel):
    """The Recap that closes a Round."""

    round: int
    round_count: int
    blackout: Season | None = Field(description="The season the grid went down in this Round, if it did")
    stories: list[RecapStory] = Field(
        description="Every event that fired in the Round: the Round's own first, then each season's in order"
    )
    figures: RoomFigures
    weather: list[SeasonWeatherReport] = Field(description="Each season the Round played, in order")
    year_ahead: YearAhead | None = Field(description="Null after the last Round")


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


def _weather(weather: Mapping[Season, AverageOutput]) -> list[SeasonWeatherReport]:
    return [
        SeasonWeatherReport(
            season=season,
            wind=weather[season].wind / NORMAL_OUTPUT[season].wind - 1,
            solar=weather[season].solar / NORMAL_OUTPUT[season].solar - 1,
        )
        for season in SEASONS
        if season in weather
    ]


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
    next_round: int,
    *,
    previous_plan: RoundPlan,
    plan: RoundPlan,
    fired: Sequence[FiredEvent],
    unlocks: Sequence[Unlock],
    peak_demand: float | None,
    vote_outcomes: Sequence[VoteOutcome],
    demand_growth: float,
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
    if peak_demand is not None:
        # The peak measured this Round already holds every shift before it, so only next Round's new ones move it.
        shift = round_demand_factor([*fired, *coming], next_round) / round_demand_factor(fired, next_round - 1)
        demand = DemandOutlook(peak_this_round=peak_demand, peak_next_round=peak_demand * demand_growth * shift)
    return YearAhead(
        round=next_round,
        unlocks=[_unlock(unlock) for unlock in unlocks if unlock.round == next_round],
        stories=_stories(event for event in coming if event.season is None),
        forecasts=forecasts,
        demand_growth=demand_growth,
        demand=demand,
        carbon_tax_vote=RecapVote(tax_rate=CARBON_TAX_RATE)
        if vote_held(lever=plan.levers.carbon_tax_vote, round_number=next_round, outcomes=vote_outcomes)
        else None,
        manual_fuel_procurement_starts=previous_plan.levers.fuel_procurement == "automatic"
        and plan.levers.fuel_procurement == "manual",
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
    peak_demand: float | None,
    vote_outcomes: Sequence[VoteOutcome],
    weather: Mapping[Season, AverageOutput],
    demand_growth: float,
) -> WorkshopRecap:
    """The Recap that closes Round ``round_number`` of ``round_count``.

    ``plans`` holds every Round's plan, ``fired`` every event that fired, ``blackouts`` the Trading period of every
    blackout as (Round, season), and ``unlocks`` every unlock. ``purchases`` and ``results`` are every player's, and
    ``peak_demand`` the highest must-serve demand at one settlement point in the Round, or None if none was simulated.
    ``vote_outcomes`` holds every vote's outcome so far, and ``weather`` the real average wind and solar output of
    each season the Round played. ``demand_growth`` is the factor demand grows by into the next Round (#1226).
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
        weather=_weather(weather),
        year_ahead=None
        if round_number >= round_count
        else _year_ahead(
            round_number + 1,
            previous_plan=plans[round_number - 1],
            plan=plans[round_number],
            fired=[event for event in fired if event.round <= round_number],
            unlocks=unlocks,
            peak_demand=peak_demand,
            vote_outcomes=vote_outcomes,
            demand_growth=demand_growth,
        ),
    )
