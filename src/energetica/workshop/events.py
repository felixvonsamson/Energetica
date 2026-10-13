"""Workshop's events (#1012, #992 §3–§4): the vignettes the moderator picks, and what they do once they fire.

Each event is a named vignette from a fixed catalog (#978) in one of three categories: climate, price shock or
geopolitics, and demand shift. The moderator picks a vignette and one of its severities. The pick waits until the
next boundary of its kind, the start of a Trading period or of a Round, and can be changed or dropped until then.
At the boundary it fires, and the session keeps a :class:`FiredEvent` so the Recap can tell its headline (#1013).

Each category can hold one pick per boundary at a time (:func:`slot`). Climate events fire when a Trading period
opens. Demand shifts fire when a Round's Investment phase opens. A price shock on facilities fires with the Round,
since facilities are bought only in the Investment phase, and a price shock on fuel fires with the Trading period,
since fuel is bought every season.

What a fired event does depends on its effect kind:

- ``demand_amplitude_shift`` multiplies the demand block's amplitude. A climate event (a heatwave or a cold snap)
  does so for its Trading period only, since weather passes. A demand shift does so from its Round to the end of
  the session, on top of any earlier shift.
- ``revenue_tax`` takes a share of every player's sale revenue in its Trading period, the same share for everyone.
- ``facility_capex_multiplier`` multiplies the price of every tier of its target categories, for its Round only.
- ``fuel_price_multiplier`` is a fuel price shock (:mod:`~energetica.workshop.fuel`). It lands in full for its
  Trading period and then eases back.

A magnitude is always the factor the target gets multiplied by: a 3% tax is ``0.97``, not ``0.03``. The
moderator never sees an event's headline before it fires, so the Recap surprises them too. Every magnitude is a
placeholder until the game-balance pass (#1145).

The Recap before a Round tells players what the Round holds (#1188). A round-wide event is told with its exact effect.
A seasonal event, one that fires with a Trading period, is told only as a vague forecast that never gives a figure.
Its wording grows more certain with severity: "could" for minor, "likely" for moderate, "almost certainly" for major,
and a call to prepare for catastrophic. The moderator never sees a forecast before the Recap either.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, Fuel
from energetica.workshop.seasons import Season

EventCategory = Literal["climate", "price_shock_geopolitical", "demand_shift", "tech_unlock", "vote"]
"""The categories of the locked event shape. Technology unlocks (#1011) and votes (#1014) are announced like events
but are not picked from this catalog."""

BoundaryType = Literal["round", "trading_period"]

EffectKind = Literal[
    "demand_amplitude_shift",
    "revenue_tax",
    "facility_capex_multiplier",
    "fuel_price_multiplier",
    "tech_unlock_trigger",
    "vote_outcome",
]

Severity = Literal["base", "minor", "moderate", "major", "catastrophic"]
"""``base`` is the only severity of a single-shot vignette. The others are graded, mildest first."""

Direction = Literal["negative", "positive"]


class EventEffect(BaseModel):
    """What an event changes."""

    model_config = ConfigDict(frozen=True)

    kind: EffectKind
    target: tuple[FacilityCategory | Fuel, ...] = Field(
        default=(),
        description="The facility categories or fuel it moves. Empty for an effect on demand or revenue, which has "
        "only one target, and for a fuel shock whose fuel the moderator picks",
    )


class WorkshopEvent(BaseModel):
    """One vignette of the catalog, in the locked event shape (#992 §4)."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(description="A stable slug: <category>.<short_name>")
    category: EventCategory
    boundary_type: BoundaryType
    direction: Direction
    name: str = Field(description="The moderator's label for it. Never the headline")
    effect: EventEffect
    severities: tuple[Severity, ...]
    magnitude: dict[Severity, float] = Field(description="The factor the target is multiplied by, per severity")
    headlines: dict[Severity, str] = Field(description="The headline the Recap tells, per severity")
    forecasts: dict[Severity, str] | None = Field(
        default=None,
        description="For a seasonal event, the vague forecast the Recap before its Round tells, per severity. It "
        "takes the season as {season} and, if the moderator picks the fuel, the fuel as {fuel}. None for a "
        "round-wide event, which the Recap tells with its exact effect",
    )

    @model_validator(mode="after")
    def _forecasts_match_the_boundary(self) -> Self:
        if self.boundary_type == "trading_period":
            if self.forecasts is None or set(self.forecasts) != set(self.severities):
                raise ValueError(f"{self.id} needs a forecast for each of its severities")
        elif self.forecasts is not None:
            raise ValueError(f"{self.id} fires with the Round, so the Recap tells its exact effect, not a forecast")
        return self

    def forecast(self, severity: Severity, *, season: Season, fuel: Fuel | None = None) -> str:
        """The forecast for ``severity``, naming ``season`` and, for an event whose fuel is picked, ``fuel``."""
        if self.forecasts is None:
            raise ValueError(f"{self.id} fires with the Round and has no forecast")
        return self.forecasts[severity].format(season=season, fuel=fuel)

    @property
    def fuel_chosen(self) -> bool:
        """Whether the moderator picks the fuel it moves."""
        return self.effect.kind == "fuel_price_multiplier" and not self.effect.target


class EventPick(BaseModel):
    """A vignette the moderator picked, waiting for the next boundary of its kind."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    event: str = Field(description="The event's id")
    severity: Severity
    fuel: Fuel | None = Field(
        default=None, description="The fuel it moves, for an event whose fuel the moderator picks"
    )


class FiredEvent(BaseModel):
    """An event that fired, for its effects and for the Recap to tell."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    event: str = Field(description="The event's id")
    severity: Severity
    fuel: Fuel | None = Field(description="The fuel the moderator picked for it, if it took one")
    round: int = Field(description="The Round it fired in")
    season: Season | None = Field(
        description="The Trading period it fired at, or null for an event that fired at the start of the Round"
    )
    # The effect it applied, kept so that a later change to the catalog leaves an event that already fired as it was.
    kind: EffectKind
    target: tuple[FacilityCategory | Fuel, ...] = Field(
        description="What it moved: the event's target, or the fuel the moderator picked"
    )
    magnitude: float = Field(description="The factor it applied")

    @classmethod
    def of(cls, pick: EventPick, *, round_number: int, season: Season | None) -> FiredEvent:
        """``pick`` firing in Round ``round_number``, at ``season``'s Trading period or with the Round if None."""
        event = EVENTS[pick.event]
        return cls(
            event=pick.event,
            severity=pick.severity,
            fuel=pick.fuel,
            round=round_number,
            season=season,
            kind=event.effect.kind,
            target=(pick.fuel,) if pick.fuel is not None else event.effect.target,
            magnitude=event.magnitude[pick.severity],
        )


class InvalidPickError(Exception):
    """Raised for a pick naming no event, a severity the event does not have, or a wrong fuel."""


def _event(
    event_id: str,
    name: str,
    *,
    category: EventCategory,
    boundary_type: BoundaryType,
    direction: Direction,
    kind: EffectKind,
    target: tuple[FacilityCategory | Fuel, ...] = (),
    severities: dict[Severity, tuple[float, str]],
    forecasts: dict[Severity, str] | None = None,
) -> WorkshopEvent:
    return WorkshopEvent(
        id=event_id,
        category=category,
        boundary_type=boundary_type,
        direction=direction,
        name=name,
        effect=EventEffect(kind=kind, target=target),
        severities=tuple(severities),
        magnitude={severity: magnitude for severity, (magnitude, _) in severities.items()},
        headlines={severity: headline for severity, (_, headline) in severities.items()},
        forecasts=forecasts,
    )


def _seasonal(
    severities: dict[Severity, tuple[float, str, str]],
) -> tuple[dict[Severity, tuple[float, str]], dict[Severity, str]]:
    """Split each severity's (magnitude, headline, forecast) into what :func:`_event` takes."""
    return (
        {severity: (magnitude, headline) for severity, (magnitude, headline, _) in severities.items()},
        {severity: forecast for severity, (_, _, forecast) in severities.items()},
    )


def _temperature(
    event_id: str, name: str, direction: Direction, severities: dict[Severity, tuple[float, str, str]]
) -> WorkshopEvent:
    magnitudes_and_headlines, forecasts = _seasonal(severities)
    return _event(
        event_id,
        name,
        category="climate",
        boundary_type="trading_period",
        direction=direction,
        kind="demand_amplitude_shift",
        severities=magnitudes_and_headlines,
        forecasts=forecasts,
    )


def _disaster(event_id: str, name: str, severities: dict[Severity, tuple[float, str, str]]) -> WorkshopEvent:
    magnitudes_and_headlines, forecasts = _seasonal(severities)
    return _event(
        event_id,
        name,
        category="climate",
        boundary_type="trading_period",
        direction="negative",
        kind="revenue_tax",
        severities=magnitudes_and_headlines,
        forecasts=forecasts,
    )


def _facility_shock(
    event_id: str, name: str, target: tuple[FacilityCategory, ...], magnitude: float, headline: str
) -> WorkshopEvent:
    return _event(
        event_id,
        name,
        category="price_shock_geopolitical",
        boundary_type="round",
        direction="negative" if magnitude > 1 else "positive",
        kind="facility_capex_multiplier",
        target=target,
        severities={"base": (magnitude, headline)},
    )


def _fuel_shock(
    event_id: str, name: str, target: tuple[Fuel, ...], magnitude: float, headline: str, forecast: str
) -> WorkshopEvent:
    return _event(
        event_id,
        name,
        category="price_shock_geopolitical",
        boundary_type="trading_period",
        direction="negative" if magnitude > 1 else "positive",
        kind="fuel_price_multiplier",
        target=target,
        severities={"base": (magnitude, headline)},
        forecasts={"base": forecast},
    )


def _demand_shift(event_id: str, name: str, magnitude: float, headline: str) -> WorkshopEvent:
    return _event(
        event_id,
        name,
        category="demand_shift",
        boundary_type="round",
        direction="positive" if magnitude > 1 else "negative",
        kind="demand_amplitude_shift",
        severities={"base": (magnitude, headline)},
    )


_WIND, _PV, _BATTERIES = FacilityCategory.WIND, FacilityCategory.PV, FacilityCategory.BATTERIES

#: Every event the moderator can pick, by id, in the order the console lists them. The content of #978's catalog.
EVENTS: dict[str, WorkshopEvent] = {
    event.id: event
    for event in [
        # Climate: temperature
        _temperature(
            "climate.heatwave",
            "Heatwave",
            "negative",
            {
                "minor": (
                    1.03,
                    "A brief spell of warm weather nudges cooling demand up across the region.",
                    "Forecasters see a chance of a warm spell this {season}. Air conditioners could run a little "
                    "harder than usual and nudge power consumption up.",
                ),
                "moderate": (
                    1.08,
                    "A regional heatwave pushes cooling demand to a five-year high — expect tighter margins this "
                    "quarter.",
                    "Climate scientists expect an unusually warm {season}. Air conditioners are likely to run harder "
                    "than usual and push power consumption up.",
                ),
                "major": (
                    1.18,
                    "A record-breaking heatwave grips the region for weeks. Air conditioners run nonstop as cooling "
                    "demand hits an all-time high.",
                    "Climate scientists warn of a severe heatwave this {season}. Air conditioners will almost "
                    "certainly run nonstop and drive power consumption to new highs.",
                ),
            },
        ),
        _temperature(
            "climate.cold_snap",
            "Cold snap",
            "negative",
            {
                "minor": (
                    1.04,
                    "An early cold front sends heating demand up for a few chilly days.",
                    "Forecasters see a chance of an early cold front this {season}. Heating demand could tick up "
                    "for a few chilly days.",
                ),
                "moderate": (
                    1.10,
                    "A sharp cold snap sends heating demand climbing — heat pumps work overtime to keep up.",
                    "Meteorologists expect a sharp cold spell this {season}. Heat pumps are likely to work overtime "
                    "and push power consumption up.",
                ),
                "major": (
                    1.22,
                    "An arctic cold snap sends heating demand soaring — heat pumps strain to keep up as outdoor "
                    "temperatures plunge.",
                    "Meteorologists warn of an arctic blast this {season}. Heating demand will almost certainly "
                    "soar as temperatures plunge.",
                ),
            },
        ),
        _temperature(
            "climate.mild_season",
            "Mild season",
            "positive",
            {
                "base": (
                    0.97,
                    "An unusually mild season keeps both heating and cooling demand low — a quiet quarter for grid "
                    "operators.",
                    "Long-range forecasts point to gentle weather this {season}. Heating and cooling demand may stay "
                    "lower than usual.",
                ),
            },
        ),
        # Climate: disasters
        _disaster(
            "climate.drought",
            "Drought",
            {
                "moderate": (
                    0.97,
                    "A regional drought tightens water availability. Utilities and industry alike feel the pinch.",
                    "Hydrologists report falling reservoir levels ahead of {season}. Water is likely to grow scarce, "
                    "and utilities and industry alike are likely to feel the pinch.",
                ),
                "major": (
                    0.93,
                    "A record drought grips the region. Reservoirs sit at historic lows, and every water-dependent "
                    "business — power generation included — feels the squeeze.",
                    "Hydrologists warn that reservoirs are running dry ahead of {season}. A severe drought will almost "
                    "certainly squeeze every water-dependent business, power generation included.",
                ),
            },
        ),
        _disaster(
            "climate.wildfire",
            "Wildfire season",
            {
                "moderate": (
                    0.97,
                    "Wildfires force the evacuation of a substation — grid operators reroute power across the region "
                    "while crews fight the blaze.",
                    "Fire services report bone-dry forests heading into {season}. Wildfires are likely to threaten "
                    "substations and power lines across the region.",
                ),
                "major": (
                    0.94,
                    "A severe wildfire season forces rolling substation evacuations across the region — grid "
                    "operators scramble to reroute power as crews battle blazes on multiple fronts.",
                    "Fire services warn of a severe wildfire season this {season}. Blazes will almost certainly force "
                    "substations offline as crews fight fires on several fronts.",
                ),
                "catastrophic": (
                    0.88,
                    "A catastrophic wildfire season overwhelms the region — dozens of substations destroyed and "
                    "entire communities evacuated. Full grid restoration will take months.",
                    "Fire services urge communities to prepare now: conditions this {season} are the most dangerous on "
                    "record. Wildfires will almost certainly destroy grid infrastructure across the region.",
                ),
            },
        ),
        _disaster(
            "climate.hurricane",
            "Hurricane",
            {
                "major": (
                    0.93,
                    "A hurricane makes landfall, downing transmission lines along the coast — restoration crews are "
                    "mobilizing and expect a multi-week recovery.",
                    "Forecasters are tracking a powerful storm system expected this {season}. A hurricane will "
                    "almost certainly make landfall and bring down transmission lines along the coast.",
                ),
                "catastrophic": (
                    0.82,
                    "A catastrophic category-5 hurricane makes landfall. Transmission infrastructure is devastated "
                    "across the coast — full restoration will take months.",
                    "Emergency officials urge coastal residents to prepare: an exceptionally powerful hurricane is "
                    "forecast for {season}. It will almost certainly devastate transmission lines along the coast.",
                ),
            },
        ),
        _disaster(
            "climate.flood",
            "Flood",
            {
                "moderate": (
                    0.97,
                    "Flash flooding knocks out two substations overnight — expect scattered outages while crews "
                    "assess the damage.",
                    "Heavy rain is forecast for {season}, and rivers are already running high. Flash floods are "
                    "likely to knock out some substations.",
                ),
                "major": (
                    0.93,
                    "Historic flooding submerges substations across the region. Widespread outages persist as crews "
                    "wait for waters to recede.",
                    "Hydrologists warn of record river levels this {season}. Widespread flooding will almost "
                    "certainly submerge substations across the region.",
                ),
                "catastrophic": (
                    0.85,
                    "Catastrophic, once-in-a-generation flooding overwhelms flood defenses across the region. Dozens "
                    "of substations are underwater, and full recovery will take months.",
                    "Authorities urge people in low-lying areas to prepare: flood defenses may not hold this {season}. "
                    "Flooding will almost certainly overwhelm substations across the region.",
                ),
            },
        ),
        # Price shocks on facilities
        _facility_shock(
            "geo.wind_supply_war",
            "War disrupts the wind-turbine supply chain",
            (_WIND,),
            1.35,
            "The country that is the main producer of wind-turbine parts is embroiled in a civil war. Costs are "
            "expected to rise 35% next quarter.",
        ),
        _facility_shock(
            "geo.polysilicon_unrest",
            "Unrest in the polysilicon-refining region",
            (_PV,),
            1.25,
            "Export controls from the region that refines most of the world's polysilicon send solar panel prices "
            "climbing.",
        ),
        _facility_shock(
            "geo.rare_earth_ban",
            "Rare-earth magnet export ban",
            (_WIND, _BATTERIES),
            1.20,
            "A leading rare-earth exporter halts magnet shipments overnight — wind turbine and battery "
            "manufacturers scramble for alternatives.",
        ),
        _facility_shock(
            "geo.shipping_blockade",
            "Shipping-lane blockade",
            (_BATTERIES, _PV),
            1.08,
            "A blockade at a critical shipping chokepoint delays battery and solar-panel shipments worldwide — "
            "expect modest cost increases on both.",
        ),
        _facility_shock(
            "geo.lithium_export_tax",
            "Lithium export tax",
            (_BATTERIES,),
            1.30,
            "The country holding the world's largest lithium reserves imposes a new export tax — battery storage "
            "costs jump.",
        ),
        _facility_shock(
            "geo.pv_trade_agreement",
            "New free-trade agreement",
            (_PV,),
            0.85,
            "A new trade agreement drops tariffs on imported solar panels — installers pass the savings on.",
        ),
        _facility_shock(
            "geo.pv_megafactory",
            "New PV megafactory comes online",
            (_PV,),
            0.80,
            "A newly opened gigafactory floods the market with cheap solar panels, undercutting existing suppliers.",
        ),
        _facility_shock(
            "geo.turbine_devaluation",
            "Turbine exporter's currency devalues",
            (_WIND,),
            0.90,
            "A sharp currency devaluation in a major turbine-exporting country makes its products suddenly cheaper "
            "on the world market.",
        ),
        # Price shocks on fuel
        _fuel_shock(
            "geo.uranium_sanctions",
            "Sanctions on a uranium-enriching nation",
            (Fuel.URANIUM,),
            1.30,
            "New sanctions target the world's largest uranium enrichment facility. Utilities relying on its fuel "
            "brace for a price spike.",
            "Governments are weighing sanctions on a major uranium-enriching nation. Utilities that rely on "
            "its fuel could see prices climb this {season}.",
        ),
        _fuel_shock(
            "geo.gas_pipeline_disruption",
            "Gas pipeline disruption",
            (Fuel.GAS,),
            1.50,
            "A key gas pipeline is shut down amid a dispute between transit nations. Spot prices spike as buyers "
            "scramble for alternatives.",
            "Tensions are rising between the nations along a major gas pipeline route. Traders could see "
            "gas supplies tighten this {season}.",
        ),
        _fuel_shock(
            "geo.coal_nationalization",
            "Coal industry nationalized",
            (Fuel.COAL,),
            1.25,
            "A wave of nationalizations sweeps the country's coal industry. Analysts warn of supply disruptions and "
            "price hikes.",
            "Calls to nationalize the coal industry are growing louder in parliament. Analysts warn that coal "
            "supplies could be disrupted this {season}.",
        ),
        _fuel_shock(
            "geo.gas_discovery",
            "New domestic gas reserves discovered",
            (Fuel.GAS,),
            0.80,
            "A major new gas field comes online ahead of schedule, easing supply concerns and pushing prices down.",
            "Drilling crews report promising results at a new domestic gas field. Traders could see gas supplies "
            "ease this {season}.",
        ),
        _fuel_shock(
            "geo.conflict_resolution",
            "Diplomatic resolution ends a regional conflict",
            (),
            0.85,
            "A ceasefire agreement ends months of fighting in a key fuel-exporting region — prices ease as "
            "shipments resume.",
            "Peace talks are making progress in a key {fuel}-exporting region. If they succeed, {fuel} "
            "shipments could resume this {season} and ease prices.",
        ),
        # Demand shifts
        _demand_shift(
            "demand.heat_pump_wave",
            "Heat-pump adoption wave",
            1.08,
            "A national subsidy program triggers a wave of heat-pump installations — electricity demand for heating "
            "climbs.",
        ),
        _demand_shift(
            "demand.ac_adoption",
            "Widespread air-conditioning adoption",
            1.06,
            "Rising incomes and a run of hot summers drive a boom in home air-conditioning uptake.",
        ),
        _demand_shift(
            "demand.ev_tipping_point",
            "Electric-vehicle tipping point",
            1.12,
            "Electric vehicles cross the halfway mark of new car sales in the region — charging load becomes a real "
            "factor on the grid.",
        ),
        _demand_shift(
            "demand.data_center_boom",
            "Data-center boom",
            1.18,
            "A cluster of new data centers breaks ground in the region, drawn by cheap land and grid capacity — a "
            "major new source of steady load.",
        ),
        _demand_shift(
            "demand.industrial_reshoring",
            "Industrial reshoring",
            1.10,
            "A heavy-industry manufacturer relocates its main plant to the region, bringing a large new block of "
            "industrial demand with it.",
        ),
        _demand_shift(
            "demand.population_boom",
            "Population boom",
            1.05,
            "Strong inward migration pushes the region's population — and its electricity demand — to a new high.",
        ),
        _demand_shift(
            "demand.recession",
            "Economic recession",
            0.90,
            "A sharp economic downturn curbs industrial activity and consumer spending alike — electricity demand "
            "softens across the board.",
        ),
        _demand_shift(
            "demand.pandemic_lockdown",
            "Pandemic lockdown",
            0.82,
            "A new public-health emergency shutters offices and factories overnight — demand drops sharply and "
            "suddenly.",
        ),
        _demand_shift(
            "demand.efficiency_mandate",
            "Energy-efficiency mandate",
            0.94,
            "A sweeping building-insulation program starts paying off — homes and offices need noticeably less "
            "energy to heat and cool.",
        ),
        _demand_shift(
            "demand.plant_closure",
            "Major plant closure",
            0.91,
            "The region's largest industrial employer announces it's moving production overseas — a major block of "
            "demand disappears with it.",
        ),
        _demand_shift(
            "demand.population_decline",
            "Population decline",
            0.95,
            "A wave of outward migration leaves the region with fewer residents — and less demand — than the year "
            "before.",
        ),
    ]
}

#: The CO₂ per player, in kg, from which a climate event's suggested severity is at least each graded severity.
#: Emissions count both building facilities and running them. A placeholder until the game-balance pass (#1145):
#: one coal burner running half the time for a Round emits about 150,000,000 kg.
CLIMATE_SEVERITY_THRESHOLDS: dict[Severity, float] = {
    "minor": 0.0,
    "moderate": 100_000_000.0,
    "major": 300_000_000.0,
    "catastrophic": 600_000_000.0,
}


def slot(event: WorkshopEvent) -> tuple[EventCategory, BoundaryType]:
    """The pick ``event`` takes the place of: the one of its category waiting for the same kind of boundary."""
    return event.category, event.boundary_type


def validate_pick(pick: EventPick) -> WorkshopEvent:
    """The event ``pick`` names, or :class:`InvalidPickError` if the pick is not one the moderator can make."""
    event = EVENTS.get(pick.event)
    if event is None:
        raise InvalidPickError(f"there is no event {pick.event!r}")
    if pick.severity not in event.severities:
        raise InvalidPickError(f"{event.name} has no severity {pick.severity!r}")
    if event.fuel_chosen and pick.fuel is None:
        raise InvalidPickError(f"{event.name} needs a fuel")
    if not event.fuel_chosen and pick.fuel is not None:
        raise InvalidPickError(f"{event.name} does not take a fuel")
    return event


def suggested_severity(event: WorkshopEvent, *, emissions: float, players: int) -> Severity | None:
    """The severity the console suggests for ``event``, from the session's CO₂ so far, ``emissions`` in kg, shared
    among ``players`` players. Only climate events get a suggestion: the worst of the event's severities whose
    threshold the emissions per player reach, or its mildest if they reach none.
    """
    if event.category != "climate":
        return None
    per_player = emissions / players if players else 0.0
    reached: list[Severity] = [
        severity
        for severity in event.severities
        if severity == "base" or per_player >= CLIMATE_SEVERITY_THRESHOLDS[severity]
    ]
    return reached[-1] if reached else event.severities[0]


def _product(factors: Iterable[float]) -> float:
    product = 1.0
    for factor in factors:
        product *= factor
    return product


def demand_factor(fired: Iterable[FiredEvent], round_number: int, season: Season) -> float:
    """What the events in ``fired`` multiply the demand block's amplitude by in Round ``round_number``'s ``season``.

    A Round's shift lasts to the end of the session, and a Trading period's lasts only that period.
    """
    return _product(
        event.magnitude
        for event in fired
        if event.kind == "demand_amplitude_shift"
        and (
            (event.season is None and event.round <= round_number)
            or (event.round, event.season) == (round_number, season)
        )
    )


def revenue_tax_rate(fired: Iterable[FiredEvent], round_number: int, season: Season) -> float:
    """The share of sale revenue the events in ``fired`` take in Round ``round_number``'s ``season``, from 0 to 1."""
    return 1 - _product(
        event.magnitude
        for event in fired
        if event.kind == "revenue_tax" and (event.round, event.season) == (round_number, season)
    )


def facility_price_factor(fired: Iterable[FiredEvent], facility: FacilityId, round_number: int) -> float:
    """What the events in ``fired`` multiply ``facility``'s price by in Round ``round_number``."""
    category = CATALOG[facility].category
    return _product(
        event.magnitude
        for event in fired
        if event.kind == "facility_capex_multiplier" and event.round == round_number and category in event.target
    )


def fuel_shocks(fired: Iterable[FiredEvent], round_number: int, season: Season) -> dict[Fuel, float]:
    """The price shock each fuel gets from the events in ``fired`` that fired at Round ``round_number``'s
    ``season``, as a factor. A fuel no event moved is left out.
    """
    shocks: dict[Fuel, float] = {}
    for event in fired:
        if event.kind != "fuel_price_multiplier" or (event.round, event.season) != (round_number, season):
            continue
        for fuel in event.target:
            if isinstance(fuel, Fuel):
                shocks[fuel] = shocks.get(fuel, 1.0) * event.magnitude
    return shocks
