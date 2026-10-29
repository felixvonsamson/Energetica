"""Workshop's events (#1012, #992 §3–§4): the vignettes the facilitator picks, and what they do once they fire.

Each event is a named vignette from a fixed catalog (#978) in one of three categories: climate, price shock or
geopolitics, and demand shift. The facilitator picks a vignette and one of its severities, and plans it for a Round
(:mod:`~energetica.workshop.round_plan`, #1190). At its boundary, the start of the Round or of one of its Trading
periods, it fires, and the session keeps a :class:`FiredEvent` so the Recap can tell its headline (#1013).

Each category can hold one pick per boundary (:func:`slot`). Climate events fire when a Trading period
opens, and each only in the seasons its weather can happen in (:attr:`WorkshopEvent.seasons`). Demand shifts fire when a Round's Investment phase opens. A price shock on facilities fires with the Round,
since facilities are bought only in the Investment phase, and a price shock on fuel fires with the Trading period,
since fuel is bought every season.

What a fired event does depends on its effect kind:

- ``demand_amplitude_shift`` multiplies the demand block's amplitude. A climate event (a heatwave or a cold snap)
  does so for its Trading period only, since weather passes. A demand shift does so from its Round to the end of
  the session, on top of any earlier shift.
- ``revenue_tax`` takes a share of every player's sale revenue in its Trading period, the same share for everyone.
- ``hydro_output_multiplier`` multiplies what every dam produces in its Trading period: a drought leaves less water.
- ``facility_capex_multiplier`` multiplies the price of every tier of its target categories, for its Round only.
- ``fuel_price_multiplier`` is a fuel price shock (:mod:`~energetica.workshop.fuel`). It lands in full for its
  Trading period and then eases back.

A magnitude is always the factor the target gets multiplied by: a 3% tax is ``0.97``, not ``0.03``. The
facilitator never sees an event's headline before it fires, so the Recap surprises them too, but the console shows
them each event's effect in plain numbers (:func:`effect_summary`, #1253). Every magnitude is a
placeholder until the game-balance pass (#1145).

The Recap before a Round tells players what the Round holds (#1188). A round-wide event is told with its exact effect.
A seasonal event, one that fires with a Trading period, is told only as a vague forecast that never gives a figure.
Its wording grows more certain with severity: "could" for minor, "likely" for moderate, "almost certainly" for major,
and a call to prepare for catastrophic. The facilitator never sees a forecast before the Recap either. A seasonal
event's headline is told only once it has happened, so it is written in the past tense, and a round-wide event's,
told before its Round, in the present.

Every text is read by players who may not speak English as their first language, so it keeps to common words and
short sentences, in a newspaper's voice.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from energetica.workshop.facilities import CATALOG, FacilityCategory, FacilityId, Fuel
from energetica.workshop.game_error import WorkshopError, WorkshopErrorCode
from energetica.workshop.seasons import Season

EventCategory = Literal["climate", "price_shock_geopolitical", "demand_shift", "tech_unlock", "vote"]
"""The categories of the locked event shape. Technology unlocks (#1011) and votes (#1014) are announced like events
but are not picked from this catalog."""

BoundaryType = Literal["round", "trading_period"]

EffectKind = Literal[
    "demand_amplitude_shift",
    "revenue_tax",
    "hydro_output_multiplier",
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
        "only one target, and for a fuel shock whose fuel the facilitator picks",
    )


class WorkshopEvent(BaseModel):
    """One vignette of the catalog, in the locked event shape (#992 §4)."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(description="A stable slug: <category>.<short_name>")
    category: EventCategory
    boundary_type: BoundaryType
    direction: Direction
    name: str = Field(description="The facilitator's label for it. Never the headline")
    effect: EventEffect
    severities: tuple[Severity, ...]
    magnitude: dict[Severity, float] = Field(description="The factor the target is multiplied by, per severity")
    headlines: dict[Severity, str] = Field(description="The headline the Recap tells, per severity")
    seasons: tuple[Season, ...] | None = Field(
        default=None,
        description="The seasons it can be planned for, for a climate event. None for any other event, which any "
        "boundary of its kind can hold",
    )
    forecasts: dict[Severity, str] | None = Field(
        default=None,
        description="For a seasonal event, the vague forecast the Recap before its Round tells, per severity. It "
        "takes the season as {season} and, if the facilitator picks the fuel, the fuel as {fuel}. None for a "
        "round-wide event, which the Recap tells with its exact effect",
    )

    @model_validator(mode="after")
    def _forecasts_match_the_boundary(self) -> Self:
        if self.boundary_type == "trading_period":
            if self.forecasts is None or set(self.forecasts) != set(self.severities):
                raise ValueError(f"{self.id} needs a forecast for each of its severities")
        elif self.forecasts is not None:
            raise ValueError(f"{self.id} fires with the Round, so the Recap tells its exact effect, not a forecast")
        if (self.category == "climate") != (self.seasons is not None):
            raise ValueError(f"{self.id} needs seasons if and only if it is a climate event")
        return self

    def happens_in(self, season: Season) -> bool:
        """Whether it can be planned for ``season``'s Trading period."""
        return self.seasons is None or season in self.seasons

    def forecast(self, severity: Severity, *, season: Season, fuel: Fuel | None = None) -> str:
        """The forecast for ``severity``, naming ``season`` and, for an event whose fuel is picked, ``fuel``."""
        if self.forecasts is None:
            raise ValueError(f"{self.id} fires with the Round and has no forecast")
        return self.forecasts[severity].format(season=season, fuel=fuel)

    @property
    def fuel_chosen(self) -> bool:
        """Whether the facilitator picks the fuel it moves."""
        return self.effect.kind == "fuel_price_multiplier" and not self.effect.target


class EventPick(BaseModel):
    """A vignette and severity the facilitator picked: what is planned for a Round (#1190)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    event: str = Field(description="The event's id")
    severity: Severity
    fuel: Fuel | None = Field(
        default=None, description="The fuel it moves, for an event whose fuel the facilitator picks"
    )


class FiredEvent(BaseModel):
    """An event that fired, for its effects and for the Recap to tell."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    event: str = Field(description="The event's id")
    severity: Severity
    fuel: Fuel | None = Field(description="The fuel the facilitator picked for it, if it took one")
    round: int = Field(description="The Round it fired in")
    season: Season | None = Field(
        description="The Trading period it fired at, or null for an event that fired at the start of the Round"
    )
    # The effect it applied, kept so that a later change to the catalog leaves an event that already fired as it was.
    kind: EffectKind
    target: tuple[FacilityCategory | Fuel, ...] = Field(
        description="What it moved: the event's target, or the fuel the facilitator picked"
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


class InvalidPickError(WorkshopError):
    """Raised for a pick naming no event, a severity the event does not have, or a wrong fuel."""

    code = WorkshopErrorCode.WORKSHOP_INVALID_PICK


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
    seasons: tuple[Season, ...] | None = None,
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
        seasons=seasons,
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


def _climate(
    event_id: str,
    name: str,
    *,
    direction: Direction,
    kind: EffectKind,
    seasons: tuple[Season, ...],
    severities: dict[Severity, tuple[float, str, str]],
) -> WorkshopEvent:
    magnitudes_and_headlines, forecasts = _seasonal(severities)
    return _event(
        event_id,
        name,
        category="climate",
        boundary_type="trading_period",
        direction=direction,
        kind=kind,
        severities=magnitudes_and_headlines,
        seasons=seasons,
        forecasts=forecasts,
    )


def _temperature(
    event_id: str,
    name: str,
    direction: Direction,
    seasons: tuple[Season, ...],
    severities: dict[Severity, tuple[float, str, str]],
) -> WorkshopEvent:
    return _climate(
        event_id,
        name,
        direction=direction,
        kind="demand_amplitude_shift",
        seasons=seasons,
        severities=severities,
    )


def _disaster(
    event_id: str, name: str, seasons: tuple[Season, ...], severities: dict[Severity, tuple[float, str, str]]
) -> WorkshopEvent:
    return _climate(event_id, name, direction="negative", kind="revenue_tax", seasons=seasons, severities=severities)


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

#: Every event the facilitator can pick, by id, in the order the console lists them. The content of #978's catalog.
EVENTS: dict[str, WorkshopEvent] = {
    event.id: event
    for event in [
        # Climate: temperature
        _temperature(
            "climate.heatwave",
            "Heatwave",
            "negative",
            ("spring", "summer"),
            {
                "minor": (
                    1.03,
                    "A few unusually hot days pushed up the use of air conditioning, and electricity demand rose a "
                    "little.",
                    "Weather experts say this {season} could be hotter than usual. Air conditioners could run a "
                    "little more, and electricity demand could rise slightly.",
                ),
                "moderate": (
                    1.08,
                    "A heatwave hit the region. Air conditioning use reached its highest level in five years, and "
                    "electricity demand rose with it.",
                    "Weather experts expect a hotter {season} than usual. Air conditioners are likely to run more, "
                    "and electricity demand is likely to rise.",
                ),
                "major": (
                    1.16,
                    "A record heatwave lasted for weeks. Air conditioners ran day and night, and electricity demand "
                    "reached an all-time high.",
                    "Weather experts warn of a strong heatwave this {season}. Air conditioners will almost certainly "
                    "run day and night and push electricity demand to new highs.",
                ),
            },
        ),
        _temperature(
            "climate.cold_snap",
            "Cold snap",
            "negative",
            ("winter",),
            {
                "minor": (
                    1.04,
                    "Cold weather arrived early. People turned up the heating for a few days, and electricity demand "
                    "rose a little.",
                    "Weather experts say cold weather could arrive early this {season}. Heating could push "
                    "electricity demand up for a few days.",
                ),
                "moderate": (
                    1.10,
                    "A period of very cold weather hit the region. Heat pumps worked hard to keep homes warm, and "
                    "electricity demand rose.",
                    "Weather experts expect a very cold period this {season}. Heat pumps are likely to work hard, "
                    "and electricity demand is likely to rise.",
                ),
                "major": (
                    1.20,
                    "Freezing arctic air reached the region. Temperatures fell far below normal, and heating pushed "
                    "electricity demand to record levels.",
                    "Weather experts warn of freezing arctic air this {season}. Heating will almost certainly push "
                    "electricity demand to record levels.",
                ),
            },
        ),
        _temperature(
            "climate.mild_summer",
            "Mild summer",
            "positive",
            ("summer",),
            {
                "base": (
                    0.95,
                    "The summer stayed pleasant and cool. Few people needed air conditioning, and households used "
                    "less electricity than usual.",
                    "Weather experts expect a cool and pleasant {season}. People may need less air conditioning "
                    "than usual.",
                ),
            },
        ),
        _temperature(
            "climate.mild_winter",
            "Mild winter",
            "positive",
            ("winter",),
            {
                "base": (
                    0.95,
                    "The winter was unusually warm. Homes needed less heating, and households used less electricity "
                    "than usual.",
                    "Weather experts expect a warm {season}. Homes may need less heating than usual.",
                ),
            },
        ),
        # Climate: drought
        _climate(
            "climate.drought",
            "Drought",
            direction="negative",
            kind="hydro_output_multiplier",
            seasons=("spring", "summer"),
            severities={
                "moderate": (
                    0.80,
                    "A drought left the rivers low. Dams had less water to use, and they produced less electricity "
                    "than usual.",
                    "The lakes behind the dams are lower than usual before {season}. Rivers are likely to run low, "
                    "and dams are likely to produce less electricity.",
                ),
                "major": (
                    0.50,
                    "The worst drought in decades hit the region. The lakes behind the dams were almost empty, and "
                    "the dams produced far less electricity than usual.",
                    "Experts warn that the lakes behind the dams are almost empty before {season}. A severe drought "
                    "will almost certainly leave the dams without enough water.",
                ),
            },
        ),
        # Climate: disasters
        _disaster(
            "climate.wildfire",
            "Wildfire season",
            ("summer", "autumn"),
            {
                "moderate": (
                    0.92,
                    "Wildfires burned the forests around several towns. Thousands of people had to leave their "
                    "homes, roads were closed and shops stayed shut while firefighters fought the fires. With daily "
                    "life on hold, energy companies lost part of their sales.",
                    "Firefighters report very dry forests before {season}. Wildfires are likely to force people "
                    "from their homes and disrupt daily life in towns across the region.",
                ),
                "major": (
                    0.82,
                    "A severe wildfire season forced people to leave town after town. Schools, shops and factories "
                    "closed for weeks, and the region's economy slowed down. Energy companies lost much of their "
                    "sales.",
                    "Firefighters warn of a severe wildfire season this {season}. Fires will almost certainly force "
                    "people from their homes and close businesses across the region.",
                ),
                "catastrophic": (
                    0.65,
                    "The worst wildfire season on record hit the region. Whole towns were emptied, thousands of "
                    "homes burned and much of the economy came to a stop. Energy companies lost a large share of "
                    "their sales, and rebuilding will take years.",
                    "Firefighters urge everyone to prepare now: conditions this {season} are the most dangerous on "
                    "record. Wildfires will almost certainly empty whole towns and stop much of the economy.",
                ),
            },
        ),
        _disaster(
            "climate.hurricane",
            "Hurricane",
            ("summer", "autumn"),
            {
                "major": (
                    0.80,
                    "A hurricane hit the coast. People in coastal towns had to leave their homes, houses and "
                    "businesses were damaged, and recovery took weeks. Energy companies lost much of their sales "
                    "while the region rebuilt.",
                    "Weather experts are following a powerful storm expected this {season}. A hurricane will almost "
                    "certainly hit the coast and force people in coastal towns to leave their homes.",
                ),
                "catastrophic": (
                    0.60,
                    "The strongest kind of hurricane hit the coast. Coastal towns were destroyed, tens of thousands "
                    "of people lost their homes and the region's economy came to a stop. Energy companies lost a "
                    "large share of their sales, and recovery will take years.",
                    "Officials urge people on the coast to prepare: an extremely powerful hurricane is expected this "
                    "{season}. It will almost certainly destroy coastal towns and stop their economy.",
                ),
            },
        ),
        _disaster(
            "climate.flood",
            "Flood",
            ("spring", "autumn", "winter"),
            {
                "moderate": (
                    0.92,
                    "Sudden floods hit several towns overnight. Basements filled with water, roads were closed and "
                    "many businesses stayed shut until the water went down. With daily life on hold, energy "
                    "companies lost part of their sales.",
                    "Heavy rain is expected this {season}, and the rivers are already high. Floods are likely to hit "
                    "towns and disrupt local businesses.",
                ),
                "major": (
                    0.82,
                    "The worst floods in living memory covered towns across the region. Thousands of people had to "
                    "leave their homes, and shops and factories stayed closed for weeks. Energy companies lost much "
                    "of their sales.",
                    "Experts warn of record river levels this {season}. Large floods will almost certainly force "
                    "people from their homes and close businesses across the region.",
                ),
                "catastrophic": (
                    0.65,
                    "Floods broke through the region's flood walls. Whole neighborhoods were under water, tens of "
                    "thousands of people lost their homes and the economy came to a stop. Energy companies lost a "
                    "large share of their sales, and recovery will take years.",
                    "Officials urge people in low areas to prepare: the flood walls may not hold this {season}. "
                    "Floods will almost certainly force tens of thousands from their homes and stop the region's "
                    "economy.",
                ),
            },
        ),
        # Price shocks on facilities. A third or a sixth moves a price of 6M to exactly 8M or 5M.
        _facility_shock(
            "geo.wind_supply_war",
            "War disrupts the wind-turbine supply chain",
            (_WIND,),
            1.25,
            "A civil war has started in the country that makes most wind-turbine parts. Turbine makers cannot get "
            "enough parts, and their prices are rising.",
        ),
        _facility_shock(
            "geo.polysilicon_unrest",
            "Unrest in the polysilicon-refining region",
            (_PV,),
            4 / 3,
            "Unrest has stopped exports from the region that produces most of the world's polysilicon, the main "
            "material in solar panels. Solar panel prices are rising.",
        ),
        _facility_shock(
            "geo.shipping_blockade",
            "Shipping-lane blockade",
            (_BATTERIES, _PV),
            4 / 3,
            "A blockade has closed one of the world's busiest shipping routes. Batteries and solar panels arrive "
            "late, and both cost more.",
        ),
        _facility_shock(
            "geo.lithium_export_tax",
            "Lithium export tax",
            (_BATTERIES,),
            4 / 3,
            "The country with the world's largest lithium reserves has put a new tax on lithium exports. Batteries, "
            "which need lithium, are getting more expensive.",
        ),
        _facility_shock(
            "geo.pv_megafactory",
            "New PV megafactory comes online",
            (_PV,),
            0.80,
            "A huge new factory has started making solar panels. It fills the market with cheap panels, and prices "
            "are falling.",
        ),
        _facility_shock(
            "geo.turbine_devaluation",
            "Turbine exporter's currency devalues",
            (_WIND,),
            5 / 6,
            "The currency of a major wind-turbine exporter has lost much of its value. For buyers abroad, its "
            "turbines are suddenly cheaper.",
        ),
        # Price shocks on fuel
        _fuel_shock(
            "geo.uranium_sanctions",
            "Sanctions on a uranium-enriching nation",
            (Fuel.URANIUM,),
            1.60,
            "New sanctions hit the country that prepares much of the world's nuclear fuel. Uranium became much "
            "harder to buy, and its price jumped.",
            "Governments are discussing sanctions against a major supplier of nuclear fuel. Uranium prices could "
            "rise this {season}.",
        ),
        _fuel_shock(
            "geo.gas_pipeline_disruption",
            "Gas pipeline disruption",
            (Fuel.GAS,),
            2.00,
            "A major gas pipeline was shut down during a dispute between the countries it crosses. Gas prices "
            "jumped as buyers looked for other suppliers.",
            "Tension is growing between the countries along a major gas pipeline. Less gas could reach the "
            "market this {season}.",
        ),
        _fuel_shock(
            "geo.coal_nationalization",
            "Coal industry nationalized",
            (Fuel.COAL,),
            1.60,
            "The government took control of the country's coal industry. Coal deliveries were disrupted, and prices "
            "rose.",
            "More and more politicians want the government to take control of the coal industry. Coal deliveries "
            "could be disrupted this {season}.",
        ),
        _fuel_shock(
            "geo.gas_discovery",
            "New domestic gas reserves discovered",
            (Fuel.GAS,),
            0.65,
            "A large new gas field in the country started production earlier than planned. More gas reached the "
            "market, and prices fell.",
            "Drilling teams report good results at a new gas field in the country. More gas could reach the "
            "market this {season}.",
        ),
        _fuel_shock(
            "geo.coal_discovery",
            "New domestic coal reserves discovered",
            (Fuel.COAL,),
            0.65,
            "A large new coal mine opened near the country's power plants earlier than planned. More coal reached "
            "the market, and prices fell.",
            "Geologists have found a large coal deposit near the country's power plants. More coal could reach the "
            "market this {season}.",
        ),
        _fuel_shock(
            "geo.conflict_resolution",
            "Diplomatic resolution ends a regional conflict",
            (),
            0.70,
            "A ceasefire ended months of fighting in a region that exports fuel. Shipments started again, and "
            "prices fell.",
            "Peace talks are making progress in a region that exports {fuel}. If they succeed, {fuel} shipments "
            "could start again this {season} and prices could fall.",
        ),
        # Demand shifts. The Recap tells each together with the natural growth of demand (:mod:`.recap`), so its
        # headline tells only the cause, never which way demand goes.
        _demand_shift(
            "demand.heat_pump_wave",
            "Heat-pump adoption wave",
            1.08,
            "A national subsidy program has started a wave of heat-pump installations. More and more homes now heat "
            "with electricity.",
        ),
        _demand_shift(
            "demand.ev_tipping_point",
            "Electric-vehicle tipping point",
            1.12,
            "Electric cars now make up more than half of new car sales in the region, and charging them takes a lot "
            "of electricity.",
        ),
        _demand_shift(
            "demand.data_center_boom",
            "Data-center boom",
            1.18,
            "Several large data centers are being built in the region, attracted by cheap land. They will use large "
            "amounts of electricity day and night.",
        ),
        _demand_shift(
            "demand.recession",
            "Economic recession",
            0.90,
            "The economy has entered a recession. Factories produce less, and people spend less.",
        ),
        _demand_shift(
            "demand.pandemic_lockdown",
            "Pandemic lockdown",
            0.82,
            "A new pandemic has closed offices and factories across the country.",
        ),
        _demand_shift(
            "demand.efficiency_mandate",
            "Energy-efficiency mandate",
            0.94,
            "A large national insulation program is starting to show results. Homes and offices need much less "
            "energy for heating and cooling.",
        ),
    ]
}

#: The CO₂ per player, in kg, from which a climate event's suggested severity is at least each graded severity.
#: Emissions count both building facilities and running them. Scaled with demand by the first recalibration (#1227)
#: and still open to the game-balance pass (#1145): one coal burner running half the time for a Round emits about
#: 440,000,000 kg.
CLIMATE_SEVERITY_THRESHOLDS: dict[Severity, float] = {
    "minor": 0.0,
    "moderate": 300_000_000.0,
    "major": 900_000_000.0,
    "catastrophic": 1_800_000_000.0,
}


def slot(event: WorkshopEvent) -> tuple[EventCategory, BoundaryType]:
    """The slot ``event`` takes in a Round's plan: its category and the kind of boundary it fires at."""
    return event.category, event.boundary_type


def validate_pick(pick: EventPick) -> WorkshopEvent:
    """The event ``pick`` names, or :class:`InvalidPickError` if the pick is not one the facilitator can make."""
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


#: What the effect lines call each facility category, as the subject of a sentence.
_CATEGORY_NAMES: dict[FacilityCategory, str] = {
    FacilityCategory.WIND: "wind turbines",
    FacilityCategory.CONVENTIONAL: "coal and gas plants",
    FacilityCategory.HYDRO: "water dams",
    FacilityCategory.NUCLEAR: "nuclear reactors",
    FacilityCategory.PV: "solar panels",
    FacilityCategory.CSP: "concentrated solar plants",
    FacilityCategory.BATTERIES: "batteries",
    FacilityCategory.HYDROGEN_STORAGE: "hydrogen storage",
    FacilityCategory.PUMPED_HYDRO: "pumped hydro",
}


def _percent(magnitude: float) -> str:
    """How far ``magnitude`` moves its target, in whole percent with no sign."""
    return f"{round(abs(magnitude - 1) * 100)}%"


def _signed_percent(magnitude: float) -> str:
    return ("+" if magnitude >= 1 else "−") + _percent(magnitude)


def _more_or_less(magnitude: float) -> str:
    return "more" if magnitude >= 1 else "less"


def _higher_or_lower(magnitude: float) -> str:
    return "higher" if magnitude >= 1 else "lower"


def _rose_or_fell(magnitude: float) -> str:
    return "rose" if magnitude >= 1 else "fell"


def _names(targets: Iterable[FacilityCategory | Fuel]) -> str:
    names = [target.value if isinstance(target, Fuel) else _CATEGORY_NAMES[target] for target in targets]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def _line(
    event_id: str,
    kind: EffectKind,
    target: tuple[FacilityCategory | Fuel, ...],
    magnitude: float,
    *,
    seasonal: bool,
    round_number: int | None,
    season: Season | None,
    past: bool = False,
) -> str:
    """What an effect does, in one short line of plain numbers. It names ``round_number`` and ``season``, or says
    "this Round" and "this season" where either is None. If ``past``, it tells what the effect did.
    """
    for_season = f"for the {season}" if season else "this season"
    in_season = f"in {season}" if season else "this season"
    in_round = f"in Round {round_number}" if round_number else "this Round"
    from_round = f"from Round {round_number} on" if round_number else "from this Round on"
    sales_lost = f"{season} sales lost" if season else "sales lost this season"
    match kind:
        case "demand_amplitude_shift" if seasonal and past:
            line = f"demand was {_percent(magnitude)} {_higher_or_lower(magnitude)} {in_season}"
        case "demand_amplitude_shift" if past:
            line = f"demand {_rose_or_fell(magnitude)} {_percent(magnitude)} {from_round}"
        case "revenue_tax" if past:
            sales = f"{season} sales" if season else "sales this season"
            line = f"every player lost {_percent(magnitude)} of their {sales}"
        case "hydro_output_multiplier" if past:
            line = f"dams produced {_percent(magnitude)} {_more_or_less(magnitude)} {in_season}"
        case "fuel_price_multiplier" if past:
            fuel = _names(target) if target else "the chosen fuel"
            line = (
                f"{fuel} cost {_percent(magnitude)} {_more_or_less(magnitude)} {in_season}, then started to ease back"
            )
        case "demand_amplitude_shift" if seasonal:
            line = f"demand {_signed_percent(magnitude)} {for_season}"
        case "demand_amplitude_shift":
            line = f"demand {_signed_percent(magnitude)} {from_round}"
        case "revenue_tax":
            line = f"{_percent(magnitude)} of every player's {sales_lost}"
        case "hydro_output_multiplier":
            line = f"dams produce {_percent(magnitude)} {_more_or_less(magnitude)} {in_season}"
        case "facility_capex_multiplier":
            line = f"{_names(target)} cost {_percent(magnitude)} {_more_or_less(magnitude)} {in_round}"
        case "fuel_price_multiplier":
            fuel = _names(target) if target else "the chosen fuel"
            line = f"{fuel} costs {_percent(magnitude)} {_more_or_less(magnitude)} {in_season}, then eases back"
        case _:
            raise ValueError(f"{event_id} has no effect line for {kind}")
    return line[0].upper() + line[1:]


def effect_summary(event: WorkshopEvent, severity: Severity) -> str:
    """What ``event`` does at ``severity``, in one short line of plain numbers, for the console to show next to it
    while the facilitator picks (#1253). It speaks of the Round and season the event is planned for as "this Round"
    and "this season".

    For example "Demand +18% this season" or "Wind turbines cost 35% more this Round".
    """
    return _line(
        event.id,
        event.effect.kind,
        event.effect.target,
        event.magnitude[severity],
        seasonal=event.boundary_type == "trading_period",
        round_number=None,
        season=None,
    )


def effect_line(event: FiredEvent, *, past: bool = False) -> str:
    """What ``event`` does, in one short line of plain numbers, for the Recap to print under its headline (#1013).
    If ``past``, it tells what the event did, for the Year in Review.

    For example "Demand +18% for the summer", "Wind turbines cost 35% more in Round 3" or, in the past, "Demand was
    18% higher in summer".
    """
    return _line(
        event.event,
        event.kind,
        event.target,
        event.magnitude,
        seasonal=event.season is not None,
        round_number=event.round,
        season=event.season,
        past=past,
    )


def _product(factors: Iterable[float]) -> float:
    product = 1.0
    for factor in factors:
        product *= factor
    return product


def round_demand_factor(fired: Iterable[FiredEvent], round_number: int) -> float:
    """What the Round events in ``fired`` multiply the demand block's amplitude by in Round ``round_number``: a Round's
    shift lasts to the end of the session.
    """
    return _product(
        event.magnitude
        for event in fired
        if event.kind == "demand_amplitude_shift" and event.season is None and event.round <= round_number
    )


def demand_factor(fired: Iterable[FiredEvent], round_number: int, season: Season) -> float:
    """What the events in ``fired`` multiply the demand block's amplitude by in Round ``round_number``'s ``season``.

    A Round's shift lasts to the end of the session (:func:`round_demand_factor`), and a Trading period's lasts only
    that period.
    """
    fired = list(fired)
    return round_demand_factor(fired, round_number) * _product(
        event.magnitude
        for event in fired
        if event.kind == "demand_amplitude_shift" and (event.round, event.season) == (round_number, season)
    )


def revenue_tax_rate(fired: Iterable[FiredEvent], round_number: int, season: Season) -> float:
    """The share of sale revenue the events in ``fired`` take in Round ``round_number``'s ``season``, from 0 to 1."""
    return 1 - _product(
        event.magnitude
        for event in fired
        if event.kind == "revenue_tax" and (event.round, event.season) == (round_number, season)
    )


def hydro_output_factor(fired: Iterable[FiredEvent], round_number: int, season: Season) -> float:
    """What the events in ``fired`` multiply every dam's output by in Round ``round_number``'s ``season``."""
    return _product(
        event.magnitude
        for event in fired
        if event.kind == "hydro_output_multiplier" and (event.round, event.season) == (round_number, season)
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
