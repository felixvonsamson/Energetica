"""Response models for Workshop's routes."""

from __future__ import annotations

import math
import warnings
from collections.abc import Iterable
from typing import Annotated, Literal

import numpy as np
from pydantic import BaseModel, Field

from energetica.workshop.blackout import Blackout
from energetica.workshop.events import (
    BoundaryType,
    Direction,
    EffectKind,
    EventCategory,
    Severity,
    WorkshopEvent,
    effect_summary,
)
from energetica.workshop.facilities import FacilityId, Fuel, WorkshopFacility
from energetica.workshop.fleet import OwnedFacility, lifetime_left
from energetica.workshop.fuel import FuelProcurement
from energetica.workshop.period_record import MeritOrder, TradingPeriodRecord
from energetica.workshop.prices import PRICE_CEILING, PRICE_FLOOR, PriceSheet
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.round_plan import EventStatus, RoundLevers
from energetica.workshop.seasons import Season
from energetica.workshop.session import Checkpoint, SettlementProgress
from energetica.workshop.unlocks import Unlock
from energetica.workshop.votes import Ballot


class WorkshopPlayerOut(BaseModel):
    """The calling account's own player in the Run."""

    account_id: int
    username: str
    team: str | None = Field(description="The player's team, or null in a Run without teams")
    money: float


class WorkshopEntryOut(BaseModel):
    """The result of entering the Run."""

    role: Literal["player", "facilitator"]
    player: WorkshopPlayerOut | None = Field(
        description="The account's player, or null for a facilitator, who runs the session and does not play"
    )


class WorkshopMemberOut(BaseModel):
    """A player in the Run, as everyone in it sees them."""

    account_id: int
    username: str
    team: str | None = Field(description="The player's team, or null in a Run without teams")


class WorkshopTeamOut(BaseModel):
    """One of the Run's teams, as its config lists it (#1384)."""

    name: str
    members: list[str] = Field(description="The usernames on the team, including any who have not entered")


class WorkshopPhaseTimerOut(BaseModel):
    """The running phase's countdown."""

    remaining_seconds: float = Field(
        description="Time left when the server answered. Zero once the phase has closed, though the session "
        "stays at its checkpoint until the facilitator advances it"
    )


class WorkshopPhaseExtendIn(BaseModel):
    """The facilitator's "+N minutes" on the running phase."""

    minutes: int = Field(ge=1, le=60, description="How many minutes to add")


class WorkshopBonusMultipliersIn(BaseModel):
    """The bonus multiplier of each team named, by team name, which multiplies the team's score."""

    multipliers: dict[str, Annotated[float, Field(gt=0, le=2, allow_inf_nan=False)]] = Field(
        description="Each team's bonus multiplier, by team name. A team left out keeps its multiplier"
    )


class WorkshopSettlementOut(BaseModel):
    """How far the simulation of the current Trading period has got (#1004)."""

    days_done: int = Field(description="Days cleared so far")
    days_total: int = Field(
        description="Days the simulation clears: 14 for a representative week, which is cleared twice for its "
        "cyclic start, and 91 for a full season"
    )

    @classmethod
    def from_progress(cls, progress: SettlementProgress) -> WorkshopSettlementOut:
        return cls(days_done=progress.days_done, days_total=progress.days_total)


class WorkshopSessionOut(BaseModel):
    """Where the session is."""

    checkpoint: Checkpoint
    next_checkpoint: Checkpoint | None = Field(
        description="Where the facilitator's next advance moves the session, or null once it is finished"
    )
    round_count: int = Field(description="How many Rounds the session runs")
    phase_timer: WorkshopPhaseTimerOut | None = Field(
        description="The countdown on the Investment phase or a Trading period's price-setting window, or null "
        "at a checkpoint that has none"
    )
    players: list[WorkshopMemberOut] = Field(description="Everyone placed into the Run, in the order they entered")
    teams: list[WorkshopTeamOut] | None = Field(
        description="The Run's teams, in the order its config lists them, or null in a Run without teams"
    )
    round_format: RoundFormat = Field(
        description="The current Round's format. Before Round 1 starts, the format it will start with"
    )
    settlement: WorkshopSettlementOut | None = Field(
        description="How far the simulation of the Trading period has got while it runs, or null when none is "
        "running. The session cannot advance while one is"
    )
    blackouts: list[Blackout] = Field(
        description="Every blackout, in order, with the Trading period it happened in. The grid came back a day "
        "later, with demand rationed for the rest of the Round"
    )
    carbon_tax_since: int | None = Field(
        description="The Round whose vote put the carbon tax in force, for the rest of the session, or null if no "
        "vote has passed"
    )


class WorkshopFacilityOut(WorkshopFacility):
    """A facility the calling player can buy, or already owns."""

    base_price: float = Field(
        description="What it costs before any price shock: its price for the session's length (#1306), which is "
        "lower than the catalog price for a long-lived facility in a short session"
    )
    for_sale: bool = Field(
        description="Whether players can buy it in the current Round. A facility the player owns but can no "
        "longer buy, such as storage the Round's storage lever leaves out, is still listed, so that it can be shown"
    )
    price: float = Field(
        description="What it costs in the current Round: its price for the session's length, moved by any price shock"
    )
    fuel_use: float | None = Field(
        description="The fuel it burns per MWh it generates, in kg, or null for a facility that burns no fuel"
    )
    capacity_factor: float | None = Field(
        description="Its average output over a year of the Run's weather, as a share of its power from 0 to 1, or "
        "null for a facility that does not follow the weather"
    )
    om_fixed_per_season: float = Field(description="The part of its O&M charged every season whatever its use")
    om_variable_per_mwh: float = Field(description="The part of its O&M charged per MWh it generates")
    full_output_per_season: float = Field(description="The energy it generates in a season at full output, in Wh")
    expected_generation: dict[Season, float] | None = Field(
        description="The energy it generates in each season on average over many Runs' weather, in Wh, or null for "
        "a facility that does not follow the weather"
    )


class WorkshopSelectionIn(BaseModel):
    """One facility to add to the calling player's selection."""

    facility: FacilityId


class WorkshopSelectionOut(BaseModel):
    """The facilities the calling player has picked in the open Investment phase (#999)."""

    facilities: list[FacilityId] = Field(
        description="One entry per copy, in the order they were picked. All are bought when the Investment "
        "phase's time runs out"
    )
    total_cost: float = Field(description="What buying the whole selection costs")
    money: float = Field(description="The player's cash. The selection can never cost more")
    stored_energy_at_risk: dict[FacilityId, float] = Field(
        description="For each storage type, the stored energy in Wh that neither the player's facilities of that "
        "type nor the selection can hold. It is lost when the Investment phase closes, unless more of that "
        "type is selected. A type with nothing at risk is left out. Always empty unless the previous Round was played "
        "in full-season mode"
    )


class WorkshopOwnedFacilityOut(BaseModel):
    """One facility the calling player owns."""

    facility: FacilityId
    built_round: int = Field(description="The Round it was bought in")
    rounds_left: int = Field(description="Rounds it still works for, counting the current one")
    under_construction: bool = Field(
        description="True while its construction lag runs. It then keeps its whole lifetime"
    )

    @classmethod
    def from_owned(cls, owned: OwnedFacility, *, current_round: int) -> WorkshopOwnedFacilityOut:
        """``owned`` as it stands in ``current_round``."""
        left = lifetime_left(owned, current_round=current_round)
        return cls(
            facility=owned.facility,
            built_round=owned.built_round,
            rounds_left=left.rounds,
            under_construction=left.under_construction,
        )


class WorkshopPriceIn(BaseModel):
    """A new price for one facility type, per MWh."""

    price: float = Field(
        allow_inf_nan=False,
        description=f"The price per MWh, from {PRICE_FLOOR} to {PRICE_CEILING}, both included",
    )


class WorkshopPriceRangeOut(BaseModel):
    """The prices a player can set, per MWh, both bounds included."""

    floor: float = Field(description="The lowest price a player can set, per MWh")
    ceiling: float = Field(description="The highest price a player can set, per MWh")


class WorkshopPricesOut(PriceSheet):
    """The calling player's prices, per MWh (#1002). Every facility type has one, owned or not."""

    price_range: WorkshopPriceRangeOut


class WorkshopFuelNeedOut(BaseModel):
    """What the operating copies of one facility type burn of a fuel in a season at full output (#1400)."""

    facility: FacilityId
    name: str
    count: int
    need: float = Field(description="In kg")


class WorkshopFuelLineOut(BaseModel):
    """One fuel and the calling player's dealings in it, in the current Trading period (#1009). Every fuel is listed,
    so a player sees its price even before they build a facility that burns it (#1290). Quantities are in kg.
    """

    fuel: Fuel
    name: str
    burned: bool = Field(description="Whether the player's operating facilities burn it. Only then can they order it")
    price: float = Field(description="The season's price per kg, or the catalog price before the first season")
    change: float | None = Field(
        description="The change since last season, as a share of last season's price, such as 0.15 for +15%. Null "
        "in the first season and before it"
    )
    shocked: bool = Field(description="Whether a price shock landed this season")
    stock: float = Field(description="What the player holds")
    season_need: float = Field(
        description="What the player's facilities burning it burn running at full output for the whole season. 0 "
        "for a fuel they do not burn"
    )
    need_by_facility: list[WorkshopFuelNeedOut] = Field(
        description="The season need by facility type, in the order the types were first bought. Empty for a fuel "
        "they do not burn"
    )
    stockpile_limit: float = Field(description="The most the player's stock may hold, counting what they order")
    order: float | None = Field(
        description="What the player buys when the price-setting window closes. Null under automatic procurement "
        "and for a fuel they do not burn"
    )
    ran_out: bool = Field(
        description="Whether the fuel ran short in the player's last Trading period, holding back the output of "
        "their facilities burning it (#1010)"
    )


class WorkshopFuelOut(BaseModel):
    """The fuel the calling player buys this season (#1009)."""

    procurement: FuelProcurement = Field(
        description="How players get fuel in the current Round: billed for what they burned, or buying it themselves "
        "in the price-setting window"
    )
    fuels: list[WorkshopFuelLineOut] = Field(
        description="Every fuel, in a fixed order, whether the player burns it or not. Empty before the first "
        "Trading period"
    )


class WorkshopFuelOrderIn(BaseModel):
    """How much of one fuel to buy, in kg."""

    quantity: float = Field(ge=0, allow_inf_nan=False, description="In kg. Cut down to fit the stockpile limit")


class WorkshopBallotIn(BaseModel):
    """A player's ballot in the carbon tax vote (#1014)."""

    ballot: Ballot


class WorkshopLoanPaymentOut(BaseModel):
    """One payment that pays the loan back (#1225)."""

    round: int | None = Field(
        description="The Round whose start takes it, or null if it is taken when the session ends"
    )
    amount: float
    paid: bool


class WorkshopLoanOut(BaseModel):
    """The calling player's loan (#1225): its terms, and once taken, its payments."""

    amount: float = Field(description="What the loan adds to the player's cash")
    payment: float = Field(description="What each payment takes back")
    payment_count: int
    available: bool = Field(
        description="Whether the player can take the loan in this Round's Investment phase while it is open: they "
        "have not taken it, and this is not the last Round"
    )
    taken_round: int | None = Field(description="The Round the player took the loan in, or null if they have not")
    cancellable: bool = Field(
        description="Whether the player took the loan in this Investment phase, so they can cancel it while it is open"
    )
    payments: list[WorkshopLoanPaymentOut] = Field(description="Every payment, in order. Empty until the loan is taken")


class WorkshopVoteOut(BaseModel):
    """The current Round's carbon tax vote (#1014). Never says how anyone voted but the caller, nor how many did."""

    round: int
    held: bool = Field(description="Whether the Round holds a vote, cast while its Investment phase is open")
    tax_rate: float = Field(description="What the proposed tax charges per kg of CO₂ emitted")
    ballot: Ballot | None = Field(
        description="The caller's ballot while the vote is open, or null if they have not cast one. Always null "
        "for the facilitator"
    )
    passed: bool | None = Field(
        description="Whether the vote passed, once the Investment phase is over. Null until then, and in a Round "
        "that holds no vote"
    )


def _finite_or_none(values: Iterable[float]) -> list[float | None]:
    """``values`` as JSON can carry them: an unbounded or missing value becomes null."""
    return [value if math.isfinite(value) else None for value in values]


def _watts(values: np.ndarray) -> list[int]:
    """Power rounded to whole watts, which roughly halves its JSON. A watt is far below anything a chart shows."""
    return np.rint(values).astype(np.int64).tolist()


def _watts_or_none(values: np.ndarray) -> list[int | None]:
    """:func:`_watts`, with a missing value as null."""
    return [round(value) if math.isfinite(value) else None for value in values.tolist()]


class WorkshopTechnologyProgressOut(BaseModel):
    """How far one base tier's upgrade is from unlocking (#1011). For the facilitator only."""

    base: FacilityId
    base_name: str
    upgrade: FacilityId
    upgrade_name: str
    invested: float = Field(description="Money every player has spent on the base tier so far")
    unlocked_round: int | None = Field(
        description="The first Round the upgrade can be bought in, or null while it is locked"
    )


class WorkshopUnlocksOut(BaseModel):
    """Every technology's progress toward unlocking, and what has unlocked so far (#1011). For the facilitator
    only: players learn of an unlock at the Recap, never how close one is.
    """

    threshold: float = Field(
        description="The spend on a base tier that unlocks its upgrade, the same for every technology. It grows "
        "with the number of players"
    )
    technologies: list[WorkshopTechnologyProgressOut] = Field(description="Each base tier, in catalog order")
    csp_unlock_round: int = Field(description="The first Round Concentrated solar power can be bought in")
    unlocks: list[Unlock] = Field(description="Every facility unlocked so far, in the order they unlocked")


class WorkshopEventOut(BaseModel):
    """An event the facilitator can pick (#1012). Never its headline, so the Recap surprises the facilitator too."""

    id: str
    name: str
    category: EventCategory
    boundary_type: BoundaryType = Field(
        description="round: it fires when the Investment phase of the Round it is planned for opens. "
        "trading_period: when the Trading period of the season it is planned for opens"
    )
    direction: Direction
    effect_kind: EffectKind
    severities: list[Severity]
    seasons: list[Season] | None = Field(
        description="The seasons a climate event can be planned for, since its weather happens only in them. Null "
        "for any other event"
    )
    suggested_severity: Severity | None = Field(
        description="For a climate event, the severity the session's CO₂ so far suggests. Null for any other"
    )
    fuel_chosen: bool = Field(description="Whether the facilitator picks the fuel it moves")
    summaries: dict[Severity, str] = Field(
        description="What it does at each of its severities, in one short line of plain numbers, such as "
        '"Demand +18% this season". It speaks of the Round and season it is planned for as "this Round" and "this '
        'season"'
    )

    @classmethod
    def from_event(cls, event: WorkshopEvent, suggested_severity: Severity | None) -> WorkshopEventOut:
        return cls(
            id=event.id,
            name=event.name,
            category=event.category,
            boundary_type=event.boundary_type,
            direction=event.direction,
            effect_kind=event.effect.kind,
            severities=list(event.severities),
            seasons=None if event.seasons is None else list(event.seasons),
            suggested_severity=suggested_severity,
            fuel_chosen=event.fuel_chosen,
            summaries={severity: effect_summary(event, severity) for severity in event.severities},
        )


class WorkshopFiredEventOut(BaseModel):
    """An event that fired (#1012)."""

    event: str = Field(description="The event's id")
    name: str
    severity: Severity
    fuel: Fuel | None = Field(description="The fuel the facilitator picked for it, if it took one")
    round: int
    season: Season | None = Field(description="The Trading period it fired at, or null if it fired with the Round")


class WorkshopEventsOut(BaseModel):
    """The events the facilitator can plan, and those that fired (#1012). For the facilitator only."""

    events: list[WorkshopEventOut] = Field(description="Every event, in catalog order")
    fired: list[WorkshopFiredEventOut] = Field(description="Every event that fired, in order")
    emissions: float = Field(description="The CO₂ every player has emitted so far, building and running, in kg")


class WorkshopPlannedEventOut(BaseModel):
    """An event planned for a Round (#1190)."""

    event: str = Field(description="The event's id")
    name: str
    severity: Severity
    fuel: Fuel | None = Field(description="The fuel the facilitator picked for it, if it takes one")
    season: Season | None = Field(description="The season it fires at, or null if it fires with the Round")
    summary: str | None = Field(
        description='What it does, in one short line of plain numbers, such as "Demand +18% for the summer". '
        "Null if the catalog no longer allows the pick"
    )
    status: EventStatus = Field(description="planned: still to come. fired: it fired")


class WorkshopRoundPlanOut(BaseModel):
    """One Round's plan (#1190)."""

    round: int
    locked: bool = Field(
        description="Whether the plan can no longer change: Round 1's from the start of the session, and each later "
        "Round's from the Recap before it"
    )
    levers: RoundLevers
    events: list[WorkshopPlannedEventOut] = Field(description="The events planned for the Round, in planning order")


class WorkshopPlansOut(BaseModel):
    """Every Round's plan, in order (#1190). For the facilitator only."""

    rounds: list[WorkshopRoundPlanOut]


class WorkshopPeriodOut(BaseModel):
    """What a settled Trading period's review needs before it loads any days (#1007, #1198)."""

    round: int
    season: Season
    clearings_per_day: int = Field(description="Settlement points in each simulated day")
    days: list[int] = Field(
        description="The day of the year of each simulated day, in order: 7 for a representative week, 91 for a "
        "full season"
    )
    blackouts: list[int] = Field(
        description="The settlement point of each blackout, counted from the period's first, in order. Empty if the "
        "grid held. The grid stays down for a day after each, and those points never cleared"
    )

    @classmethod
    def from_record(cls, record: TradingPeriodRecord) -> WorkshopPeriodOut:
        return cls(
            round=record.round,
            season=record.season,
            clearings_per_day=record.clearings_per_day,
            days=list(record.days),
            blackouts=list(record.blackouts),
        )


class WorkshopPoolSeriesOut(BaseModel):
    """One player's facilities of one type over some simulated days, at each settlement point.

    Power is in whole W and stored energy in Wh.
    """

    player_id: int
    facility: FacilityId
    generation: list[int] = Field(description="What it produced: sold plus dumped. For storage, discharged")
    dumped: list[int] = Field(description="Renewable output that did not sell")
    charged: list[int] = Field(description="What storage bought to charge")
    stored: list[float] = Field(description="The energy storage held once each point was over, in Wh")
    power: float = Field(description="The most its facilities could generate together, in W")
    storage_capacity: float = Field(description="The most energy it could hold, in Wh. Zero if it is not storage")


class WorkshopTierSeriesOut(BaseModel):
    """One demand tier over some simulated days."""

    tier: str = Field(description="The tier's label, such as must_serve")
    served: list[int] = Field(description="What it bought at each settlement point, in whole W")


class WorkshopPeriodDaysOut(BaseModel):
    """Some consecutive simulated days of a settled Trading period, at every settlement point (#1007, #1198, #1399).

    What a player sold is ``generation - dumped``. A player's consumption is what it sold, charged and
    dumped. The market's consumption is what the demand tiers were served, plus all charging and dumping.
    """

    days: list[int] = Field(description="The day of the year of each day, in order")
    first_point: int = Field(description="The period's settlement point the first day starts at")
    price: list[float | None] = Field(
        description="The price each point settled at, per MWh. Null where the grid was down: unbounded at the "
        "blackout itself, and missing while it was down after it"
    )
    quantity: list[int | None] = Field(
        description="The power each point cleared, in whole W. Null while the grid was down after a blackout"
    )
    pools: list[WorkshopPoolSeriesOut] = Field(description="Every player's facility types that were operating")
    tiers: list[WorkshopTierSeriesOut]

    @classmethod
    def from_record(cls, record: TradingPeriodRecord, first_day: int, count: int) -> WorkshopPeriodDaysOut:
        """``count`` days from ``first_day``, the first day's position in the period."""
        start = first_day * record.clearings_per_day
        points = slice(start, start + count * record.clearings_per_day)
        return cls(
            days=list(record.days[first_day : first_day + count]),
            first_point=start,
            price=_finite_or_none(record.price[points].tolist()),
            quantity=_watts_or_none(record.quantity[points]),
            pools=[
                WorkshopPoolSeriesOut(
                    player_id=player_id,
                    facility=FacilityId(facility),
                    generation=_watts(record.generation[row, points]),
                    dumped=_watts(record.dumped[row, points]),
                    charged=_watts(record.charged[row, points]),
                    stored=record.stored[row, points].tolist(),
                    power=float(record.power[row]),
                    storage_capacity=float(record.storage_capacity[row]),
                )
                for row, (player_id, facility) in enumerate(record.pools)
            ],
            tiers=[
                WorkshopTierSeriesOut(tier=tier, served=_watts(record.served[row, points]))
                for row, tier in enumerate(record.tiers)
            ],
        )


OVERVIEW_POINTS_PER_DAY = 8
"""The overview's power has a point every 3 hours: enough to see each day's solar cycle."""


class WorkshopFacilitySeriesOut(BaseModel):
    """The whole market's facilities of one type over a Trading period."""

    facility: FacilityId
    values: list[float]


class WorkshopSeasonOverviewOut(BaseModel):
    """A whole settled Trading period at a low resolution, to pick the days to look at closely (#1399)."""

    daily_energy: list[WorkshopFacilitySeriesOut] = Field(
        description="What every player's facilities of each type generated each day, in Wh"
    )
    points_per_day: int = Field(description=f"The points each day has in ``power``: {OVERVIEW_POINTS_PER_DAY}")
    power: list[WorkshopFacilitySeriesOut] = Field(
        description="The average power every player's facilities of each type generated over each part of each "
        "day, in W"
    )
    price_mean: list[float | None] = Field(description="Each day's average price, per MWh")
    price_min: list[float | None] = Field(description="Each day's lowest price, per MWh")
    price_max: list[float | None] = Field(description="Each day's highest price, per MWh")
    hourly_price: list[float | None] = Field(description="Each hour's average price, per MWh")

    @classmethod
    def from_record(cls, record: TradingPeriodRecord) -> WorkshopSeasonOverviewOut:
        cpd = record.clearings_per_day
        days = len(record.days)

        def by_type(values: np.ndarray) -> list[WorkshopFacilitySeriesOut]:
            """``values``' rows, one per pool, summed by facility type."""
            totals: dict[str, np.ndarray] = {}
            for row, (_, facility) in enumerate(record.pools):
                totals[facility] = totals.get(facility, 0) + values[row]
            return [
                WorkshopFacilitySeriesOut(facility=FacilityId(facility), values=total.tolist())
                for facility, total in totals.items()
            ]

        def runs(values: np.ndarray, count: int) -> np.ndarray:
            """``values`` (one row per pool) split into ``count`` runs of equal length along the last axis."""
            return values.reshape(*values.shape[:-1], count, values.shape[-1] // count)

        generation = record.generation.astype(float)
        mean, low, high = _price_runs(record.price, days)
        return cls(
            daily_energy=by_type(runs(generation, days).sum(axis=-1) * 24 / cpd),
            points_per_day=OVERVIEW_POINTS_PER_DAY,
            power=by_type(runs(generation, days * OVERVIEW_POINTS_PER_DAY).mean(axis=-1)),
            price_mean=_finite_or_none(mean.tolist()),
            price_min=_finite_or_none(low.tolist()),
            price_max=_finite_or_none(high.tolist()),
            hourly_price=_finite_or_none(_price_runs(record.price, days * 24)[0].tolist()),
        )


def _price_runs(price: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The average, lowest and highest price of ``count`` runs of equal length, ignoring blackouts."""
    runs = price.astype(float).reshape(count, -1)
    runs = np.where(np.isfinite(runs), runs, np.nan)
    with warnings.catch_warnings():
        # A run that was all blackout has no price.
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(runs, axis=1), np.nanmin(runs, axis=1), np.nanmax(runs, axis=1)


class WorkshopOrdersOut(BaseModel):
    """One side of the market at a settlement point, in merit order. The same shape as the persistent world's
    merit-order data, plus what cleared.
    """

    player_id: list[int] = Field(description="Each bid's player, or a demand tier's reserved negative id")
    capacity: list[float] = Field(description="Power each bid offered, in W")
    price: list[float | None] = Field(description="Each bid's price per MWh. Null for a bid at any price")
    facility: list[str] = Field(description="Each bid's facility type, or a demand tier's label")
    cumul_capacities: list[float] = Field(description="Power offered up to and including each bid, in W")
    cleared: list[float] = Field(description="Power each bid sold or bought, in W")

    @classmethod
    def from_columns(cls, columns: dict[str, list]) -> WorkshopOrdersOut:
        return cls(**{**columns, "price": _finite_or_none(columns["price"])})


class WorkshopMeritOrderOut(BaseModel):
    """The market at one settlement point of a settled Trading period (#1007). Every bid is listed, whether it
    sold or not.
    """

    point: int
    offers: WorkshopOrdersOut = Field(description="Supply, cheapest first")
    demands: WorkshopOrdersOut = Field(description="Demand, highest price first")
    price: float | None = Field(description="The price the point settled at, or null at a blackout")
    quantity: float

    @classmethod
    def from_merit_order(cls, order: MeritOrder) -> WorkshopMeritOrderOut:
        return cls(
            point=order.point,
            offers=WorkshopOrdersOut.from_columns(order.offers),
            demands=WorkshopOrdersOut.from_columns(order.demands),
            price=order.price if math.isfinite(order.price) else None,
            quantity=order.quantity,
        )
