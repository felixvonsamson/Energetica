"""Response models for Workshop's routes."""

from __future__ import annotations

import math
from collections.abc import Iterable
from typing import Literal

from pydantic import BaseModel, Field

from energetica.workshop.facilities import FacilityId, Fuel, WorkshopFacility
from energetica.workshop.fleet import OwnedFacility, lifetime_left
from energetica.workshop.fuel import FuelProcurement
from energetica.workshop.period_record import MeritOrder, TradingPeriodRecord
from energetica.workshop.prices import PRICE_FLOOR, PriceSheet
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import Season
from energetica.workshop.session import Checkpoint, SettlementProgress, TradingPeriod


class WorkshopPlayerOut(BaseModel):
    """The calling account's own player in the Run."""

    account_id: int
    username: str
    money: float


class WorkshopEntryOut(BaseModel):
    """The result of entering the Run."""

    role: Literal["player", "facilitator"]
    player: WorkshopPlayerOut | None = Field(
        description="The account's player, or null for a facilitator, who moderates and does not play"
    )


class WorkshopMemberOut(BaseModel):
    """A player in the Run, as everyone in it sees them."""

    account_id: int
    username: str


class WorkshopPhaseTimerOut(BaseModel):
    """The running phase's countdown."""

    remaining_seconds: float = Field(
        description="Time left when the server answered. Zero once the phase has closed, though the session "
        "stays at its checkpoint until the facilitator advances it"
    )


class WorkshopPhaseExtendIn(BaseModel):
    """The facilitator's "+N minutes" on the running phase."""

    minutes: int = Field(ge=1, le=60, description="How many minutes to add")


class WorkshopSettlementOut(BaseModel):
    """How far the simulation of the current Trading period has got (#1004)."""

    days_done: int = Field(description="Days of the season simulated so far")
    days_total: int = Field(description="Days the simulation covers: 1 for a representative day, 91 for a full season")

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
    round_format: RoundFormat = Field(
        description="The current Round's format. Before Round 1 starts, the format it will start with"
    )
    settlement: WorkshopSettlementOut | None = Field(
        description="How far the simulation of the Trading period has got while it runs, or null when none is "
        "running. The session cannot advance while one is"
    )
    blackouts: list[TradingPeriod] = Field(
        description="Every Trading period the grid went down in, in order. Each one ended its Round, so the "
        "Round's later Trading periods were skipped"
    )


class WorkshopFacilityOut(WorkshopFacility):
    """A facility the calling player can buy, or already owns."""

    for_sale: bool = Field(
        description="Whether players can buy it in the current Round. A facility the player owns but can no "
        "longer buy, such as storage the Round's storage lever leaves out, is still listed, so that it can be shown"
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
        "type is selected. A type with nothing at risk is left out"
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
        allow_inf_nan=False, description=f"The price per MWh. It has no ceiling, but cannot go below {PRICE_FLOOR}"
    )


class WorkshopPricesOut(PriceSheet):
    """The calling player's prices, per MWh (#1002). Every facility type has one, owned or not."""

    price_floor: float = Field(description="The lowest price a player can set, per MWh")


class WorkshopFuelLineOut(BaseModel):
    """One fuel the calling player's operating facilities burn, in the current Trading period (#1009). Quantities
    are in kg.
    """

    fuel: Fuel
    name: str
    price: float = Field(description="The season's price per kg")
    change: float | None = Field(
        description="The change since last season, as a share of last season's price, such as 0.15 for +15%. Null "
        "in the first season"
    )
    shocked: bool = Field(description="Whether a price shock landed this season")
    stock: float = Field(description="What the player holds")
    season_need: float = Field(
        description="What the player's facilities burning it burn running at full output for the whole season"
    )
    stockpile_limit: float = Field(description="The most the player's stock may hold, counting what they order")
    order: float | None = Field(
        description="What the player buys when the price-setting window closes. Null under automatic procurement"
    )


class WorkshopFuelOut(BaseModel):
    """The fuel the calling player buys this season (#1009)."""

    procurement: FuelProcurement | None = Field(
        description="How players get fuel in the current Trading period, or null before the first one: billed for "
        "what they burned, or buying it themselves in the price-setting window"
    )
    fuels: list[WorkshopFuelLineOut] = Field(
        description="Each fuel the player's operating facilities burn, in a fixed order. Empty before the first "
        "Trading period"
    )


class WorkshopFuelOrderIn(BaseModel):
    """How much of one fuel to buy, in kg."""

    quantity: float = Field(ge=0, allow_inf_nan=False, description="In kg. Cut down to fit the stockpile limit")


def _finite_or_none(values: Iterable[float]) -> list[float | None]:
    """``values`` as JSON can carry them: an unbounded or missing value becomes null."""
    return [value if math.isfinite(value) else None for value in values]


class WorkshopPeriodOut(BaseModel):
    """What a settled Trading period's review needs before it loads any day (#1007)."""

    round: int
    season: Season
    clearings_per_day: int = Field(description="Settlement points in each simulated day")
    days: list[int] = Field(
        description="The day of the year of each simulated day, in order: one for a representative day, 91 for a "
        "full season. Days are asked for by their position in this list"
    )
    blackout_at: int | None = Field(
        description="The settlement point the grid went down at, counted from the period's first, or null if it "
        "held. Points after it never cleared"
    )

    @classmethod
    def from_record(cls, record: TradingPeriodRecord) -> WorkshopPeriodOut:
        return cls(
            round=record.round,
            season=record.season,
            clearings_per_day=record.clearings_per_day,
            days=list(record.days),
            blackout_at=record.blackout_at,
        )


class WorkshopPoolSeriesOut(BaseModel):
    """One player's facilities of one type over a simulated day, in W at each settlement point."""

    player_id: int
    facility: FacilityId
    generation: list[float] = Field(description="What it produced: sold plus dumped. For storage, discharged")
    dumped: list[float] = Field(description="Renewable output that did not sell")
    charged: list[float] = Field(description="What storage bought to charge")


class WorkshopTierSeriesOut(BaseModel):
    """One demand tier over a simulated day."""

    tier: str = Field(description="The tier's label, such as must_serve")
    served: list[float] = Field(description="What it bought at each settlement point, in W")


class WorkshopPeriodDayOut(BaseModel):
    """One simulated day of a settled Trading period, at every settlement point (#1007).

    What a player sold is ``generation - dumped``. A player's consumption is what it sold, charged and
    dumped. The market's consumption is what the demand tiers were served, plus all charging and dumping.
    """

    day: int = Field(description="The day's position in the period's days")
    first_point: int = Field(description="The period's settlement point the day starts at")
    price: list[float | None] = Field(
        description="The price each point settled at, per MWh. Null where the grid was down: unbounded at the "
        "blackout itself, and missing after it"
    )
    quantity: list[float | None] = Field(description="The power each point cleared, in W. Null after a blackout")
    pools: list[WorkshopPoolSeriesOut] = Field(description="Every player's facility types that were operating")
    tiers: list[WorkshopTierSeriesOut]

    @classmethod
    def from_record(cls, record: TradingPeriodRecord, day: int) -> WorkshopPeriodDayOut:
        start = day * record.clearings_per_day
        points = slice(start, start + record.clearings_per_day)
        return cls(
            day=day,
            first_point=start,
            price=_finite_or_none(record.price[points].tolist()),
            quantity=_finite_or_none(record.quantity[points].tolist()),
            pools=[
                WorkshopPoolSeriesOut(
                    player_id=player_id,
                    facility=FacilityId(facility),
                    generation=record.generation[row, points].tolist(),
                    dumped=record.dumped[row, points].tolist(),
                    charged=record.charged[row, points].tolist(),
                )
                for row, (player_id, facility) in enumerate(record.pools)
            ],
            tiers=[
                WorkshopTierSeriesOut(tier=tier, served=record.served[row, points].tolist())
                for row, tier in enumerate(record.tiers)
            ],
        )


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
