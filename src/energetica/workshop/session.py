"""A Workshop Run's session: the moderator-paced state machine and the state it carries (#994).

A session runs a configured number of Rounds. Each Round has one Investment phase, then four Trading
periods (spring, summer, autumn, winter), then a Recap. Each of those is a **checkpoint**: the
session sits at one until the moderator advances it, however long that takes. There is no timeout
and no separate pause. The session also has a checkpoint before Round 1, while players
arrive, and one after the last Recap, when the session is over.

    NotStarted → [Investment → TradingPeriod ×4 → Recap] × round_count → Finished

The Investment phase and each Trading period's price-setting window also get a countdown, a
:class:`~energetica.workshop.phase_timer.PhaseTimer` (#996). It tells players how long they have, and
the moderator can extend it. Running out of time closes the window but does not advance the session.
Players change their prices only while a price-setting window is open (#1002). Once it closes, the
Trading period is settled (#1003): its prices are recorded, and the engine in
:mod:`~energetica.workshop.trading` clears the days the Round's format simulates and pays each player.

If the grid goes down in a Trading period (a blackout), the Round ends there (#1005). The session waits
on that period like any other, and advancing from it skips the Round's remaining Trading periods and goes
straight to its Recap. Each blackout is recorded with its Trading period.

A full season can take a minute to simulate, so settling happens in three steps (#1004).
:meth:`WorkshopSession.start_settlement` takes what the engine needs under the session's lock,
:meth:`WorkshopSession.run_settlement` runs the engine without holding it, reporting each day it has
done, and :meth:`WorkshopSession.finish_settlement` pays the players. The app runs the middle step in
the background. The session cannot advance while a period is being simulated. Paying the players also
charges them for fuel (#1009) and saves the period's :class:`~energetica.workshop.period_record.TradingPeriodRecord`, every settlement point
it cleared, to its own file in :attr:`WorkshopSession.records_dir`, for the period's review (#1007).

:class:`WorkshopSession` holds a Run's whole state: the current checkpoint, the Round count, the
round-configuration levers, the running phase's countdown, and the Run's single shared
Network. It is saved to a JSON file after
every change and reloaded from it on start, so a restart resumes the session where it was. This is
Workshop's own persistence. It shares nothing with the persistent world's model store or checkpoints
(#1049), and the file follows the shape of the session rather than of any persistent-world object.

Fuel is priced and bought once per Trading period (#1009, :mod:`~energetica.workshop.fuel`). When a Trading
period opens, every fuel gets its price for the season, the fuel procurement lever is fixed for the period,
and under manual procurement each player's fuel order starts from its default. Players change their orders
while the price-setting window is open, and settling the period charges for the fuel at the season's price.

The moderator picks events (#1012, :mod:`~energetica.workshop.events`) at any time. Each pick waits for the next
boundary of its kind and can be changed or dropped until then. A Trading-period pick fires when the next Trading
period opens, and a Round pick when the next Investment phase opens. The session keeps every event that fired, and
works out their effects from that list: the demand block's amplitude when a period is simulated, the revenue tax
when it is settled, the facility prices of the Round, and fuel shocks when a period opens.
"""

from __future__ import annotations

import math
import random
import threading
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Literal, NamedTuple

from pydantic import BaseModel, Field

from energetica.sim.national_demand import national_demand_curve
from energetica.workshop.atomic_file import write_atomically
from energetica.workshop.demand_block import PER_PLAYER_BASE_AMPLITUDE, round_one_amplitude
from energetica.workshop.events import (
    EVENTS,
    BoundaryType,
    EventPick,
    FiredEvent,
    InvalidPickError,
    demand_factor,
    facility_price_factor,
    fuel_shocks,
    revenue_tax_rate,
    slot,
    validate_pick,
)
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel, WorkshopFacility
from energetica.workshop.fuel import (
    CATALOG_FUEL_PRICES,
    FuelPrice,
    FuelProcurement,
    FuelPurchase,
    burned_fuels,
    capped_order,
    default_orders,
    next_fuel_price,
    season_need,
)
from energetica.workshop.fleet import OwnedFacility, Purchase, is_operating, lifetime_left
from energetica.workshop.network import WorkshopNetwork
from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.phase_timer import PhaseTimer
from energetica.workshop.prices import DEFAULT_PRICES, PRICE_FLOOR, LockedPrices, PriceSheet, PriceSide, is_storage
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.setup import open_workshop_run
from energetica.workshop.storage import keep_what_fits
from energetica.workshop.trading import (
    Bidder,
    TradingOutcome,
    TradingResult,
    representative_weather,
    simulate_trading_period,
    simulated_days,
)
from energetica.workshop.unlocks import (
    Unlock,
    available_facilities,
    format_lever_unlocks,
    invested,
    round_end_unlocks,
    unlock_threshold,
)

if TYPE_CHECKING:
    from energetica.identity.accounts import Account
    from energetica.identity.instance_config import InstanceConfig
    from energetica.workshop.player import WorkshopPlayer

# How many Rounds a session runs unless the moderator chooses otherwise (#992). A placeholder, like
# every other Workshop magnitude.
DEFAULT_ROUND_COUNT = 3

# How many different weather seeds there are. The noise behind ``sim.renewables`` repeats after 256.
WEATHER_SEEDS = 256

# What is left of a fuel stock burned to the end, as a share of what was held, below which it counts as empty:
# spreading the stock over the clearings leaves a rounding error (#1010).
_EMPTY_STOCK = 1e-9

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    """The current time in UTC: the clock a session times its phases with, unless a test gives another."""
    return datetime.now(timezone.utc)


class NotStarted(BaseModel):
    """Before Round 1: players are arriving and nothing is open yet."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["not_started"] = "not_started"


class Investment(BaseModel):
    """A Round's Investment phase, where players build facilities and buy fuel."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["investment"] = "investment"
    round: int = Field(ge=1)


class TradingPeriod(BaseModel):
    """One of a Round's four Trading periods, one per season."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["trading_period"] = "trading_period"
    round: int = Field(ge=1)
    season: Season


class Recap(BaseModel):
    """The close of a Round, telling the story of what happened in it."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["recap"] = "recap"
    round: int = Field(ge=1)


class Finished(BaseModel):
    """After the last Round's Recap. The session cannot advance any further."""

    model_config = {"frozen": True, "extra": "forbid"}
    kind: Literal["finished"] = "finished"


Checkpoint = Annotated[NotStarted | Investment | TradingPeriod | Recap | Finished, Field(discriminator="kind")]


class SessionFinishedError(Exception):
    """Raised when advancing a session that is already :class:`Finished`."""


class InvestmentClosedError(Exception):
    """Raised when changing a selection while no Investment phase is open (#999)."""


class FacilityNotOfferedError(Exception):
    """Raised when selecting a facility the session does not offer yet (#999)."""


class NotEnoughMoneyError(Exception):
    """Raised when a selection would cost more than the player has (#999)."""


class NotSelectedError(Exception):
    """Raised when removing a facility that is not in the player's selection (#999)."""


class NoPhaseRunningError(Exception):
    """Raised when extending a phase while none is open: the checkpoint is not timed, or its time is up."""


class PriceSettingClosedError(Exception):
    """Raised when changing a price while no price-setting window is open (#1002)."""


class PriceBelowFloorError(Exception):
    """Raised when a price is below Workshop's price floor, or is not a finite number (#1002)."""


class NotStorageError(Exception):
    """Raised when setting a buy price for a facility that is not storage (#1002)."""


class FuelNotManualError(Exception):
    """Raised when ordering fuel while fuel procurement is automatic (#1009)."""


class FuelNotBurnedError(Exception):
    """Raised when ordering a fuel none of the player's operating facilities burn (#1009)."""


class InvalidFuelQuantityError(Exception):
    """Raised when a fuel order is negative or not a finite number (#1009)."""


class StorageLeverLockedError(Exception):
    """Raised when switching the storage lever away from every type after a Recap announced that full-season storage
    unlocks next Round (#1011).
    """


class NoBoundaryLeftError(Exception):
    """Raised when picking an event whose boundary will not come again before the session ends (#1012)."""


class SettlementRunningError(Exception):
    """Raised when advancing while the Trading period is being simulated (#1004)."""


class SettlementCancelledError(Exception):
    """Raised by :meth:`WorkshopSession.run_settlement` when its job is cancelled, such as when the app stops."""


def next_checkpoint(checkpoint: Checkpoint, *, round_count: int, blackout: bool = False) -> Checkpoint:
    """The checkpoint that follows ``checkpoint`` in a session of ``round_count`` Rounds.

    ``blackout`` says the grid went down in the Trading period ``checkpoint``, which ends its Round.
    """
    match checkpoint:
        case NotStarted():
            return Investment(round=1)
        case Investment(round=round_number):
            return TradingPeriod(round=round_number, season=SEASONS[0])
        case TradingPeriod(round=round_number, season=season) if season != SEASONS[-1] and not blackout:
            return TradingPeriod(round=round_number, season=SEASONS[SEASONS.index(season) + 1])
        case TradingPeriod(round=round_number):
            return Recap(round=round_number)
        case Recap(round=round_number) if round_number < round_count:
            return Investment(round=round_number + 1)
        case Recap():
            return Finished()
        case Finished():
            raise SessionFinishedError("the session is over")


def _still_valid(pick: EventPick) -> bool:
    """Whether ``pick``, saved earlier, is still one the moderator could make."""
    try:
        validate_pick(pick)
    except InvalidPickError:
        return False
    return True


class RoundLevers(BaseModel):
    """The round-configuration levers the moderator changes during a session.

    Each lever is added by the ticket that builds it (#996, #1012, #1018). They belong to the
    session, saved with it, and not to ``WorkshopRun`` in ``instance.json``, which the sysadmin
    writes when the Run is provisioned. Every lever has a default, so a session saved before a lever
    existed still loads.
    """

    model_config = {"extra": "forbid"}

    # How long each timed phase is open when it starts (#986). The round-config page will make them
    # editable (#1018).
    investment_minutes: int = Field(default=8, ge=1)
    price_setting_minutes: int = Field(default=5, ge=1)
    # The format the next Round starts with (#1004).
    round_format: RoundFormat = Field(default_factory=RoundFormat)
    # How players get fuel from the next Trading period on (#1009).
    fuel_procurement: FuelProcurement = "automatic"


def phase_duration(checkpoint: Checkpoint, levers: RoundLevers) -> timedelta | None:
    """How long the phase opened at ``checkpoint`` runs, or ``None`` if that checkpoint is not timed.

    A Trading period's timer is its price-setting window.
    """
    match checkpoint:
        case Investment():
            return timedelta(minutes=levers.investment_minutes)
        case TradingPeriod():
            return timedelta(minutes=levers.price_setting_minutes)
        case _:
            return None


@dataclass(frozen=True, slots=True)
class SettlementProgress:
    """How far the simulation of a Trading period has got (#1004)."""

    period: TradingPeriod
    days_done: int
    days_total: int


@dataclass(frozen=True, slots=True)
class SettlementJob:
    """What the engine needs to simulate one Trading period, taken from the session when it starts."""

    period: TradingPeriod
    bidders: list[Bidder]
    round_format: RoundFormat
    demand_amplitude: float
    """The amplitude the period is simulated with, after the events that move it."""
    base_demand_amplitude: float
    """The session's amplitude before any event, kept once the period is settled."""
    weather_seed: int
    # Set to stop the simulation after the day it is on.
    cancelled: threading.Event = field(default_factory=threading.Event)


class EventsView(NamedTuple):
    """The events waiting and fired, and what the climate suggestion goes on, for the facilitator (#1012)."""

    picks: list[EventPick]
    fired: list[FiredEvent]
    emissions: float
    """The CO₂ every player has emitted so far, in kg."""
    players: int


class UnlockProgress(NamedTuple):
    """How far each technology is from unlocking its upgrade, for the facilitator (#1011)."""

    threshold: float
    """The spend on a base tier that unlocks its upgrade, with the players the session has now."""
    invested: dict[FacilityId, float]
    """The money every player has spent on each base tier so far."""
    unlocks: list[Unlock]
    """Every facility unlocked so far, in order."""


#: How many Trading-period records the session keeps in memory once read.
LOADED_RECORDS = 3


class _SavedPlayer(BaseModel):
    account_id: int
    username: str
    money: float
    owned_facilities: list[OwnedFacility]
    # Defaults to empty for a file saved before purchases were kept.
    purchases: list[Purchase] = []
    # Defaults to empty for a file saved before selections existed.
    selection: list[FacilityId] = []
    # Defaults to empty for a file saved before stored energy existed.
    stored_energy: dict[FacilityId, float] = {}
    # Default to the starting prices and no history for a file saved before prices existed.
    prices: PriceSheet = DEFAULT_PRICES
    locked_prices: list[LockedPrices] = []
    # Defaults to none for a file saved before Trading periods were settled.
    trading_results: list[TradingResult] = []
    # Default to none for a file saved before fuel was bought.
    fuel_stock: dict[Fuel, float] = {}
    fuel_order: dict[Fuel, float] = {}


class _SavedSession(BaseModel):
    """The JSON file a session is saved to."""

    model_config = {"extra": "forbid"}

    checkpoint: Checkpoint
    round_count: int = Field(ge=1)
    levers: RoundLevers
    # Defaults to none for a file saved before phase timers existed.
    phase_timer: PhaseTimer | None = None
    players: list[_SavedPlayer]
    # Default to a new seed, no demand yet and nothing settled for a file saved before Trading periods
    # were settled.
    weather_seed: int = Field(default_factory=lambda: random.randrange(WEATHER_SEEDS))
    demand_amplitude: float | None = None
    settled_period: TradingPeriod | None = None
    # None before Round 1 starts.
    round_format: RoundFormat | None = None
    # Empty for a file saved before blackouts were recorded.
    blackouts: list[TradingPeriod] = []
    # Empty for a file saved before Trading periods were recorded.
    recorded_periods: list[TradingPeriod] = []
    # Default to no prices, no lever fixed and no shock for a file saved before fuel was bought.
    fuel_procurement: FuelProcurement | None = None
    fuel_prices: dict[Fuel, FuelPrice] = {}
    # Read and ignored: fuel shocks waited here before they became events (#1012), and none was ever set.
    pending_fuel_shocks: dict[Fuel, float] = {}
    # Empty for a file saved before facilities unlocked.
    unlocks: list[Unlock] = []
    # Empty for a file saved before events existed.
    event_picks: list[EventPick] = []
    fired_events: list[FiredEvent] = []


class WorkshopSession:
    """A Workshop Run's whole state, saved to ``path`` after every change.

    Open one per Run with :meth:`open` and keep it for the life of the process. Opening it twice
    against the same file gives two objects that each overwrite the other's saves.
    """

    def __init__(
        self,
        *,
        network: WorkshopNetwork,
        path: Path,
        checkpoint: Checkpoint,
        round_count: int,
        levers: RoundLevers,
        phase_timer: PhaseTimer | None = None,
        weather_seed: int | None = None,
        demand_amplitude: float | None = None,
        settled_period: TradingPeriod | None = None,
        round_format: RoundFormat | None = None,
        blackouts: list[TradingPeriod] | None = None,
        recorded_periods: list[TradingPeriod] | None = None,
        fuel_procurement: FuelProcurement | None = None,
        fuel_prices: dict[Fuel, FuelPrice] | None = None,
        unlocks: list[Unlock] | None = None,
        event_picks: list[EventPick] | None = None,
        fired_events: list[FiredEvent] | None = None,
        clock: Clock = utc_now,
    ) -> None:
        if round_count < 1:
            raise ValueError(f"a session needs at least one Round, not {round_count}")
        self.network = network
        self.path = path
        self.checkpoint: Checkpoint = checkpoint
        self.round_count = round_count
        self.levers = levers
        self.phase_timer = phase_timer
        # The random seed of the Run's weather, which the renewables' output follows (#1003).
        self.weather_seed = random.randrange(WEATHER_SEEDS) if weather_seed is None else weather_seed
        # The demand block's amplitude before any event, in W. Set from the headcount when the first Trading
        # period settles, and kept for the rest of the session. Events move it from there (#1012).
        self.demand_amplitude = demand_amplitude
        # The last Trading period settled, so that none is settled twice.
        self.settled_period = settled_period
        # The current Round's format, fixed from the levers when its Investment phase opens.
        self.round_format = round_format
        # Every Trading period the grid went down in, in order (#1005).
        self.blackouts = [] if blackouts is None else blackouts
        # Every settled Trading period whose record is saved, in order (#1007). A file in the records folder
        # that is not listed here, such as one left by an earlier Run, is never read.
        self.recorded_periods = [] if recorded_periods is None else recorded_periods
        # How players get fuel in the current Trading period, fixed from the levers when it opens (#1009). None
        # before the first one.
        self.fuel_procurement: FuelProcurement | None = fuel_procurement
        # Each fuel's price in the current Trading period, set when it opens (#1009). Empty before the first one.
        self.fuel_prices = {} if fuel_prices is None else fuel_prices
        # Every facility unlocked so far, in order (#1011). Kept rather than worked out again from the purchases,
        # since the threshold moves with the headcount, and an unlock that has been announced must stay.
        self.unlocks = [] if unlocks is None else unlocks
        # The events the moderator picked, each waiting for the next boundary of its kind, in the order picked
        # (#1012). At most one per category and kind of boundary.
        # A pick the catalog no longer allows, such as one of an event or severity since removed, is dropped, so it
        # never blocks an advance.
        self.event_picks = [pick for pick in event_picks or [] if _still_valid(pick)]
        # Every event that fired, in order (#1012). Their effects are worked out from this list.
        self.fired_events = [] if fired_events is None else fired_events
        # The records read most recently, newest last. A full season's record takes about half a second to
        # read and a hundred megabytes to hold, so a few are kept for the pages reviewing them.
        self._loaded_records: dict[TradingPeriod, TradingPeriodRecord] = {}
        # Requests read records on worker threads. Apart from the session's lock, so reading a record
        # never holds up a change to the session.
        self._records_lock = threading.Lock()
        # How far the Trading period being simulated has got, or None if none is. Not saved: a period
        # whose simulation a restart cut short is simulated again from the start.
        self.settlement: SettlementProgress | None = None
        self.clock = clock
        # Makes each change and the save that follows it one step, so two requests can neither
        # advance from the same checkpoint nor save over each other's change.
        self._lock = threading.Lock()

    @classmethod
    def open(
        cls,
        config: InstanceConfig,
        path: Path,
        *,
        round_count: int = DEFAULT_ROUND_COUNT,
        clock: Clock = utc_now,
    ) -> WorkshopSession:
        """Reload the session saved at ``path``, or start a new one there if there is none.

        ``round_count`` applies only to a new session; a reloaded one keeps the count it was saved
        with. A file that exists but cannot be read raises ``ValueError`` rather than starting over,
        since starting over would discard a running session. Like :func:`open_workshop_run`, this
        raises :class:`~energetica.workshop.setup.NotAWorkshopRunError` unless ``config`` is a
        Workshop Run. ``clock`` gives the current time that phase timers count from.
        """
        network = open_workshop_run(config)
        if not path.exists():
            session = cls(
                network=network,
                path=path,
                checkpoint=NotStarted(),
                round_count=round_count,
                levers=RoundLevers(),
                clock=clock,
            )
            session._save(session.checkpoint, session.phase_timer)
            return session
        saved = _SavedSession.model_validate_json(path.read_text(encoding="utf-8"))
        for player in saved.players:
            network.restore(
                account_id=player.account_id,
                username=player.username,
                money=player.money,
                owned_facilities=player.owned_facilities,
                purchases=player.purchases,
                selection=player.selection,
                stored_energy=player.stored_energy,
                prices=player.prices,
                locked_prices=player.locked_prices,
                trading_results=player.trading_results,
                fuel_stock=player.fuel_stock,
                fuel_order=player.fuel_order,
            )
        return cls(
            network=network,
            path=path,
            checkpoint=saved.checkpoint,
            round_count=saved.round_count,
            levers=saved.levers,
            phase_timer=saved.phase_timer,
            weather_seed=saved.weather_seed,
            demand_amplitude=saved.demand_amplitude,
            settled_period=saved.settled_period,
            round_format=saved.round_format,
            blackouts=saved.blackouts,
            recorded_periods=saved.recorded_periods,
            fuel_procurement=saved.fuel_procurement,
            fuel_prices=saved.fuel_prices,
            unlocks=saved.unlocks,
            event_picks=saved.event_picks,
            fired_events=saved.fired_events,
            clock=clock,
        )

    @property
    def records_dir(self) -> Path:
        """The folder each settled Trading period's record is saved in, beside the session file."""
        return self.path.parent / f"{self.path.stem}_periods"

    def record_path(self, period: TradingPeriod) -> Path:
        """Where ``period``'s record is saved."""
        return self.records_dir / f"round-{period.round}-{period.season}.npz"

    def period_record(self, period: TradingPeriod) -> TradingPeriodRecord | None:
        """What ``period`` did at each settlement point, or None if it has no record: it has not been settled,
        or was settled before records were kept.
        """
        if period not in self.recorded_periods:
            return None
        with self._records_lock:
            loaded = self._loaded_records
            record = loaded.pop(period, None)
            if record is None:
                record = TradingPeriodRecord.load(self.record_path(period))
                while len(loaded) >= LOADED_RECORDS:
                    del loaded[next(iter(loaded))]
            loaded[period] = record
            return record

    def player(self, account_id: int) -> WorkshopPlayer | None:
        """The account's player, or ``None`` if it has not entered the Run or is a facilitator."""
        return self.network.members.get(account_id)

    def current_round(self) -> int:
        """The Round the session is in. Round 1 before it starts, and the last Round once it is finished."""
        match self.checkpoint:
            case NotStarted():
                return 1
            case Finished():
                return self.round_count
            case _:
                return self.checkpoint.round

    def current_format(self) -> RoundFormat:
        """The current Round's format. Before Round 1 starts, the format it will start with."""
        if self.round_format is None or isinstance(self.checkpoint, NotStarted):
            return self.levers.round_format
        return self.round_format

    def offered_facilities(self) -> list[WorkshopFacility]:
        """The facilities players can buy in the current Round."""
        unlocked = {unlock.facility for unlock in self.unlocks if unlock.round <= self.current_round()}
        return available_facilities(self.current_format().storage, unlocked)

    def facility_price(self, facility: FacilityId, round_number: int | None = None) -> float:
        """What ``facility`` costs in Round ``round_number``, by default the current one: its catalog price, moved by
        any price shock (#1012).
        """
        if round_number is None:
            round_number = self.current_round()
        return CATALOG[facility].base_price * facility_price_factor(self.fired_events, facility, round_number)

    def facility_prices(self, round_number: int | None = None) -> dict[FacilityId, float]:
        """What each facility costs in Round ``round_number``, by default the current one."""
        return {facility: self.facility_price(facility, round_number) for facility in CATALOG}

    def emissions(self) -> float:
        """The CO₂ every player has emitted so far, in kg: building their facilities and running them."""
        return sum(
            sum(CATALOG[purchase.facility].base_construction_pollution for purchase in player.purchases)
            + sum(
                performance.emissions for result in player.trading_results for performance in result.facilities.values()
            )
            for player in self.network.players()
        )

    def unlock_progress(self) -> UnlockProgress:
        """How far each technology is from unlocking, read in one step so its parts agree (#1011)."""
        with self._lock:
            return UnlockProgress(self._unlock_threshold(), self._invested(), list(self.unlocks))

    def _invested(self) -> dict[FacilityId, float]:
        """The money every player has spent on each base tier so far. The caller holds the lock."""
        return invested(purchase for player in self.network.players() for purchase in player.purchases)

    def _unlock_threshold(self) -> float:
        """The spend on a base tier that unlocks its upgrade, with the players the session has now. The caller
        holds the lock.
        """
        return unlock_threshold(len(self.network.players()))

    def investment_open(self) -> bool:
        """Whether players can change their selection: the session is in an Investment phase and its time
        has not run out.
        """
        return (
            isinstance(self.checkpoint, Investment)
            and self.phase_timer is not None
            and self.phase_timer.is_active(self.clock())
        )

    def price_setting_open(self) -> bool:
        """Whether players can change their prices: the session is in a Trading period and its
        price-setting window has not run out.
        """
        return (
            isinstance(self.checkpoint, TradingPeriod)
            and self.phase_timer is not None
            and self.phase_timer.is_active(self.clock())
        )

    def upcoming_checkpoint(self) -> Checkpoint | None:
        """The checkpoint :meth:`advance` would move to, or ``None`` once the session is finished."""
        if isinstance(self.checkpoint, Finished):
            return None
        return self._next_checkpoint()

    def _next_checkpoint(self) -> Checkpoint:
        """The checkpoint after the current one, skipping to the Recap after a blackout."""
        return next_checkpoint(
            self.checkpoint, round_count=self.round_count, blackout=self.checkpoint in self.blackouts
        )

    def advance(self) -> Checkpoint:
        """Move to the next checkpoint and return it. The only way the session changes phase.

        While the Investment phase or a price-setting window is open, advancing closes it instead, and
        the session stays where it is. The app then buys the selections or simulates the Trading period,
        as when the time runs out (#1004). A Trading period can only be left once it is settled: until
        then, advancing does nothing more.

        A timed checkpoint starts its phase's countdown now. Leaving an Investment phase also buys any
        selection still waiting, so none is lost if the moderator advances before the purchase at the
        phase's end has happened. Starting a new Round's Investment phase fixes the Round's format from
        the levers and retires every facility whose lifetime has ended. Opening a Trading period sets the
        season's fuel prices and each player's default fuel order (#1009). Opening either fires the events
        picked for it (#1012). Raises
        :class:`SettlementRunningError` while the Trading period is being simulated, and
        :class:`SessionFinishedError` once the session is :class:`Finished`.
        """
        with self._lock:
            if self.settlement is not None:
                raise SettlementRunningError("the Trading period is being simulated")
            if self.phase_timer is not None and self.phase_timer.is_active(self.clock()):
                phase_timer = self.phase_timer.closed_at(self.clock())
                self._save(self.checkpoint, phase_timer)
                self.phase_timer = phase_timer
                return self.checkpoint
            if isinstance(self.checkpoint, TradingPeriod) and self.settled_period != self.checkpoint:
                return self.checkpoint
            checkpoint = self._next_checkpoint()
            duration = phase_duration(checkpoint, self.levers)
            phase_timer = None if duration is None else PhaseTimer(started_at=self.clock(), duration=duration)
            # Saved before it is applied, so a failed write leaves the session where the file says. A
            # purchase, retirement or new fuel price is saved in the same write, so it happens only if the
            # advance does.
            round_format = self.round_format
            undos: list[Callable[[], None]] = []
            if isinstance(checkpoint, Investment):
                self.round_format = self.levers.round_format
            try:
                if isinstance(self.checkpoint, Investment):
                    undos.append(self._apply_purchases(self.checkpoint.round)[1])
                elif isinstance(checkpoint, Investment):
                    undos.append(self._apply_retirement(checkpoint.round)[1])
                undos.append(self._fire_events(checkpoint))
                if isinstance(checkpoint, TradingPeriod):
                    undos.append(self._open_fuel_market(checkpoint))
                undos.append(self._apply_unlocks(checkpoint))
                self._save(checkpoint, phase_timer)
            except BaseException:
                # Undo the changes, so the session matches the file and the next advance retries them.
                for undo in reversed(undos):
                    undo()
                self.round_format = round_format
                raise
            self.checkpoint = checkpoint
            self.phase_timer = phase_timer
            return checkpoint

    def extend_phase(self, by: timedelta) -> PhaseTimer:
        """Give the running phase ``by`` more time, and return its timer.

        Raises :class:`NoPhaseRunningError` if no phase is open: the checkpoint is not timed, or its
        time has run out. A closed window is never reopened, since what follows it may already rely
        on it being closed.
        """
        with self._lock:
            if self.phase_timer is None or not self.phase_timer.is_active(self.clock()):
                raise NoPhaseRunningError("no phase is running")
            phase_timer = self.phase_timer.extended(by)
            self._save(self.checkpoint, phase_timer)
            self.phase_timer = phase_timer
            return phase_timer

    def select(self, account_id: int, facility: FacilityId) -> None:
        """Add one ``facility`` to the player's selection, to be bought when the Investment phase closes."""
        with self._lock:
            if not self.investment_open():
                raise InvestmentClosedError("the Investment phase is not open")
            if facility not in {offered.id for offered in self.offered_facilities()}:
                raise FacilityNotOfferedError(f"{facility} is not offered")
            player = self.network.members[account_id]
            if player.selection_cost(self.facility_prices()) + self.facility_price(facility) > player.money:
                raise NotEnoughMoneyError("the selection would cost more than the player has")
            self._set_selection(player, [*player.selection, facility])

    def deselect(self, account_id: int, facility: FacilityId) -> None:
        """Take one ``facility`` out of the player's selection: the copy picked last."""
        with self._lock:
            if not self.investment_open():
                raise InvestmentClosedError("the Investment phase is not open")
            player = self.network.members[account_id]
            if facility not in player.selection:
                raise NotSelectedError(f"{facility} is not selected")
            selection = list(player.selection)
            del selection[len(selection) - 1 - selection[::-1].index(facility)]
            self._set_selection(player, selection)

    def _set_selection(self, player: WorkshopPlayer, selection: list[FacilityId]) -> None:
        """Give ``player`` the selection ``selection`` and save it. The caller holds the lock."""
        before = player.selection
        player.selection = selection
        try:
            self._save(self.checkpoint, self.phase_timer)
        except BaseException:
            # Undo the change, so the session matches the file.
            player.selection = before
            raise

    def buy_selections(self) -> bool:
        """Buy every player's selection if the Investment phase's time has run out, and return whether
        anything changed.

        Each selected facility is paid for in full and owned from the Round it is bought in. Stored
        energy that no longer fits its storage type is then lost (#1001). Nothing happens while the
        phase is open, or outside an Investment phase.
        """
        with self._lock:
            if not isinstance(self.checkpoint, Investment) or self.investment_open():
                return False
            return self._buy_selections(self.checkpoint.round, checkpoint=self.checkpoint, phase_timer=self.phase_timer)

    def _buy_selections(self, round_number: int, *, checkpoint: Checkpoint, phase_timer: PhaseTimer | None) -> bool:
        """Buy every player's selection in Round ``round_number``, drop the stored energy that no longer
        fits, and return whether anything changed.

        This is saved with the session at ``checkpoint`` with ``phase_timer``, and nothing is saved if
        nothing changed. The caller holds the lock.
        """
        changed, undo = self._apply_purchases(round_number)
        if not changed:
            return False
        try:
            self._save(checkpoint, phase_timer)
        except BaseException:
            # Undo the purchase, so the session matches the file and the next attempt retries it.
            undo()
            raise
        return True

    def _apply_purchases(self, round_number: int) -> tuple[bool, Callable[[], None]]:
        """Buy every player's selection in Round ``round_number`` and drop the stored energy that no longer fits,
        without saving. Returns whether anything changed, and what undoes it. The caller holds the lock.
        """
        players = self.network.players()
        before = [
            (
                player.money,
                list(player.owned_facilities),
                list(player.purchases),
                list(player.selection),
                dict(player.stored_energy),
            )
            for player in players
        ]
        prices = self.facility_prices(round_number)
        for player in players:
            player.money -= player.selection_cost(prices)
            player.owned_facilities.extend(
                OwnedFacility(facility=facility, built_round=round_number) for facility in player.selection
            )
            player.purchases.extend(
                Purchase(facility=facility, round=round_number, price=prices[facility]) for facility in player.selection
            )
            player.selection.clear()
            player.stored_energy = keep_what_fits(
                player.stored_energy, player.owned_facilities, current_round=round_number
            )
        changed = any(
            (player.owned_facilities, player.stored_energy) != (owned_facilities, stored_energy)
            for player, (_, owned_facilities, _, _, stored_energy) in zip(players, before, strict=True)
        )

        def undo() -> None:
            for player, (money, owned_facilities, purchases, selection, stored_energy) in zip(
                players, before, strict=True
            ):
                player.money, player.owned_facilities, player.selection = money, owned_facilities, selection
                player.purchases = purchases
                player.stored_energy = stored_energy

        return changed, undo

    def _apply_unlocks(self, checkpoint: Checkpoint) -> Callable[[], None]:
        """Unlock what the move to ``checkpoint`` unlocks, without saving. Returns what undoes it.

        At a Round's Recap, an upgrade whose base tier has had enough spent on it unlocks from the next Round, and
        so does Concentrated solar power once that Round is far enough on. Full-season storage unlocks there too if
        the storage lever already allows every type for the next Round, so the Recap can announce it. The last
        Round's Recap unlocks nothing. If the moderator only allows every type during the Recap, full-season storage
        unlocks when the Round's Investment phase opens instead. The caller holds the lock, and has fixed the
        Round's format.
        """
        before = self.unlocks
        unlocked = {unlock.facility for unlock in before}
        match checkpoint:
            case Recap(round=round_number) if round_number < self.round_count:
                new = [
                    *round_end_unlocks(
                        next_round=round_number + 1,
                        spent=self._invested(),
                        threshold=self._unlock_threshold(),
                        unlocked=unlocked,
                    ),
                    *format_lever_unlocks(
                        round_number=round_number + 1, storage=self.levers.round_format.storage, unlocked=unlocked
                    ),
                ]
            case Investment(round=round_number):
                new = format_lever_unlocks(
                    round_number=round_number, storage=self.current_format().storage, unlocked=unlocked
                )
            case _:
                new = []
        self.unlocks = [*before, *new]

        def undo() -> None:
            self.unlocks = before

        return undo

    def _apply_retirement(self, round_number: int) -> tuple[bool, Callable[[], None]]:
        """Retire every facility past its lifetime in Round ``round_number``, without saving. Returns whether any
        was, and what undoes it.

        Retirement needs no player action and pays nothing back (#992 §6). The caller holds the lock.
        """
        before = {player: list(player.owned_facilities) for player in self.network.players()}
        for player in before:
            player.owned_facilities = [
                owned
                for owned in player.owned_facilities
                if lifetime_left(owned, current_round=round_number).rounds > 0
            ]

        def undo() -> None:
            for player, owned in before.items():
                player.owned_facilities = owned

        return any(player.owned_facilities != owned for player, owned in before.items()), undo

    def _open_fuel_market(self, period: TradingPeriod) -> Callable[[], None]:
        """Set each fuel's price for ``period``, fix the fuel procurement lever for it, and under manual procurement
        start each player's fuel order from its default, without saving. Returns what undoes it.

        A fuel shock that fired for ``period`` lands now. The caller holds the lock, and has fired the events.
        """
        players = self.network.players()
        before = (self.fuel_procurement, self.fuel_prices)
        orders = [player.fuel_order for player in players]
        period_index = (period.round - 1) * len(SEASONS) + SEASONS.index(period.season)
        shocks = fuel_shocks(self.fired_events, period.round, period.season)
        self.fuel_procurement = self.levers.fuel_procurement
        self.fuel_prices = {
            fuel: next_fuel_price(
                fuel,
                self.fuel_prices.get(fuel),
                seed=self.weather_seed,
                period_index=period_index,
                shock=shocks.get(fuel),
            )
            for fuel in Fuel
        }
        if self.fuel_procurement == "manual":
            for player in players:
                player.fuel_order = default_orders(
                    player.fuel_order, needs=self.fuel_needs(player, period.round), stocks=player.fuel_stock
                )

        def undo() -> None:
            self.fuel_procurement, self.fuel_prices = before
            for player, order in zip(players, orders, strict=True):
                player.fuel_order = order

        return undo

    @staticmethod
    def fuel_needs(player: WorkshopPlayer, round_number: int) -> dict[Fuel, float]:
        """The season need of each fuel the player's facilities operating in ``round_number`` burn."""
        fleet = player.owned_facilities
        return {
            fuel: season_need(fuel, fleet, current_round=round_number)
            for fuel in burned_fuels(fleet, current_round=round_number)
        }

    def set_price(self, account_id: int, facility: FacilityId, side: PriceSide, price: float) -> None:
        """Set the price the player offers ``facility``'s power at, per MWh: its ``"sell"`` price, or for
        storage its ``"buy"`` price too. Only while the price-setting window is open.

        A price has no ceiling, but cannot go below :data:`~energetica.workshop.prices.PRICE_FLOOR`.
        """
        with self._lock:
            if not self.price_setting_open():
                raise PriceSettingClosedError("the price-setting window is not open")
            if not (math.isfinite(price) and price >= PRICE_FLOOR):
                raise PriceBelowFloorError(f"{price} is not a price of at least {PRICE_FLOOR}")
            if side == "buy" and not is_storage(facility):
                raise NotStorageError(f"{facility} is not storage, so it does not buy")
            player = self.network.members[account_id]
            before = player.prices
            player.prices = before.with_price(facility, side, price)
            try:
                self._save(self.checkpoint, self.phase_timer)
            except BaseException:
                # Undo the change, so the session matches the file.
                player.prices = before
                raise

    def set_fuel_order(self, account_id: int, fuel: Fuel, quantity: float) -> float:
        """Set how much ``fuel`` the player buys when the price-setting window closes, in kg, and return the
        quantity set. Only under manual procurement, while the window is open, and for a fuel the player's
        operating facilities burn.

        A quantity that would take the player's stock over the stockpile limit is cut down to fit.
        """
        with self._lock:
            if not self.price_setting_open():
                raise PriceSettingClosedError("the price-setting window is not open")
            if self.fuel_procurement != "manual":
                raise FuelNotManualError("fuel procurement is automatic")
            if not (math.isfinite(quantity) and quantity >= 0):
                raise InvalidFuelQuantityError(f"{quantity} is not a quantity of fuel")
            player = self.network.members[account_id]
            needs = self.fuel_needs(player, self.current_round())
            if fuel not in needs:
                raise FuelNotBurnedError(f"no operating facility of the player burns {fuel}")
            quantity = capped_order(quantity, stock=player.fuel_stock.get(fuel, 0.0), need=needs[fuel])
            before = player.fuel_order
            player.fuel_order = {**before, fuel: quantity}
            try:
                self._save(self.checkpoint, self.phase_timer)
            except BaseException:
                # Undo the change, so the session matches the file.
                player.fuel_order = before
                raise
            return quantity

    def events_view(self) -> EventsView:
        """The events waiting and fired, read in one step so its parts agree (#1012)."""
        with self._lock:
            return EventsView(
                list(self.event_picks), list(self.fired_events), self.emissions(), len(self.network.players())
            )

    def pick_event(self, pick: EventPick) -> bool:
        """Pick an event to fire at the next boundary of its kind, in place of any pick waiting for the same one.

        Raises :class:`~energetica.workshop.events.InvalidPickError` if the pick names no event, a severity the
        event does not have, or a wrong fuel, and :class:`NoBoundaryLeftError` if its boundary will not come again,
        so it would never fire. Returns whether the picks changed.
        """
        event = validate_pick(pick)
        place = slot(event)
        with self._lock:
            if not self._boundary_ahead(event.boundary_type):
                raise NoBoundaryLeftError(f"no {event.boundary_type} boundary is left in the session")
            return self._set_picks([*(other for other in self.event_picks if slot(EVENTS[other.event]) != place), pick])

    def drop_event(self, event_id: str) -> bool:
        """Drop the pick of ``event_id``, if it is waiting, so that it does not fire. Returns whether it was."""
        with self._lock:
            return self._set_picks([pick for pick in self.event_picks if pick.event != event_id])

    def _boundary_ahead(self, boundary: BoundaryType) -> bool:
        """Whether a boundary of kind ``boundary`` is still to come: an Investment phase for a Round, a Trading
        period for a Trading period. The caller holds the lock.
        """
        boundary_kind = Investment if boundary == "round" else TradingPeriod
        if isinstance(self.checkpoint, Finished):
            return False
        # The first step follows a blackout as advancing does, since one in the last Round ends the session early.
        checkpoint = self._next_checkpoint()
        while not isinstance(checkpoint, Finished):
            if isinstance(checkpoint, boundary_kind):
                return True
            checkpoint = next_checkpoint(checkpoint, round_count=self.round_count)
        return False

    def _set_picks(self, picks: list[EventPick]) -> bool:
        """Replace the waiting picks with ``picks`` and save them, unless they are the same, and return whether they
        changed. The caller holds the lock.
        """
        if picks == self.event_picks:
            return False
        before, self.event_picks = self.event_picks, picks
        try:
            self._save(self.checkpoint, self.phase_timer)
        except BaseException:
            # Undo the change, so the session matches the file.
            self.event_picks = before
            raise
        return True

    def _fire_events(self, checkpoint: Checkpoint) -> Callable[[], None]:
        """Fire the picks waiting for ``checkpoint``, if it is a boundary, without saving. Returns what undoes it.

        A Trading period is the boundary of the picks waiting for one, and an Investment phase that of those waiting
        for a Round. The caller holds the lock.
        """
        match checkpoint:
            case TradingPeriod(round=round_number, season=season):
                boundary, fired_season = "trading_period", season
            case Investment(round=round_number):
                boundary, fired_season = "round", None
            case _:
                return lambda: None
        before = (self.event_picks, self.fired_events)
        firing = [pick for pick in self.event_picks if EVENTS[pick.event].boundary_type == boundary]
        # Built before either list changes, so that an error leaves the session as it was.
        fired = [FiredEvent.of(pick, round_number=round_number, season=fired_season) for pick in firing]
        self.event_picks = [pick for pick in self.event_picks if pick not in firing]
        self.fired_events = [*self.fired_events, *fired]

        def undo() -> None:
            self.event_picks, self.fired_events = before

        return undo

    def set_levers(self, levers: RoundLevers) -> None:
        """Replace the levers with ``levers``. The timing levers apply to the next phase that opens, the fuel
        procurement lever to the next Trading period, and the Round format to the next Round.

        Once a Recap has announced that full-season storage unlocks next Round, the storage lever must keep
        allowing every type until that Round starts, or players could not buy what was announced. Raises
        :class:`StorageLeverLockedError` if ``levers`` would switch it back.
        """
        with self._lock:
            announced = any(
                unlock.trigger == "format_lever" and unlock.round > self.current_round() for unlock in self.unlocks
            )
            if announced and levers.round_format.storage != "all":
                raise StorageLeverLockedError("the Recap announced every storage type for the next Round")
            before, self.levers = self.levers, levers
            try:
                self._save(self.checkpoint, self.phase_timer)
            except BaseException:
                # Undo the change, so the session matches the file.
                self.levers = before
                raise

    def start_settlement(self) -> SettlementJob | None:
        """Start settling the Trading period if its price-setting window has run out, and return what the
        engine needs to simulate it.

        Returns ``None`` while the window is open, outside a Trading period, while the period is being
        simulated, and once it is settled. Otherwise the period counts as being simulated until
        :meth:`finish_settlement` or :meth:`abandon_settlement`. The first Trading period also fixes the
        demand block's amplitude from the headcount, once it is settled. The events that fired move the amplitude
        the period is simulated with (#1012).
        """
        with self._lock:
            period = self.checkpoint
            if (
                not isinstance(period, TradingPeriod)
                or self.price_setting_open()
                or self.settlement is not None
                or self.settled_period == period
            ):
                return None
            players = self.network.players()
            base_amplitude = self.demand_amplitude
            if base_amplitude is None:
                base_amplitude = round_one_amplitude(PER_PLAYER_BASE_AMPLITUDE, headcount=len(players))
            round_format = self.current_format()
            job = SettlementJob(
                period=period,
                # Copies, so the engine never reads a list the session changes.
                bidders=[
                    Bidder(
                        player.account_id,
                        list(player.owned_facilities),
                        player.prices,
                        dict(player.stored_energy),
                        fuel=self._fuel_held(player),
                    )
                    for player in players
                ],
                round_format=round_format,
                demand_amplitude=base_amplitude * demand_factor(self.fired_events, period.round, period.season),
                base_demand_amplitude=base_amplitude,
                weather_seed=self.weather_seed,
            )
            self.settlement = SettlementProgress(period, 0, len(simulated_days(period.season, round_format)))
            return job

    def run_settlement(self, job: SettlementJob) -> TradingOutcome:
        """Simulate ``job``'s Trading period, keeping :attr:`settlement` up to date after each day.

        Holds no lock and changes nothing else, so it can run on another thread while the session serves
        requests. A failure here changes nothing: call :meth:`abandon_settlement` to try again later.
        Raises :class:`SettlementCancelledError` once ``job.cancelled`` is set, after the day it is on.
        """

        def on_day_done(days_done: int) -> None:
            if job.cancelled.is_set():
                raise SettlementCancelledError(f"the simulation of {job.period} was cancelled")
            settlement = self.settlement
            if settlement is not None and settlement.period == job.period:
                self.settlement = replace(settlement, days_done=days_done)

        return simulate_trading_period(
            job.bidders,
            round_number=job.period.round,
            season=job.period.season,
            round_format=job.round_format,
            amplitude=job.demand_amplitude,
            curve=national_demand_curve(),
            weather=representative_weather(job.weather_seed),
            on_day_done=on_day_done,
        )

    def abandon_settlement(self, job: SettlementJob) -> None:
        """Give up settling ``job``'s Trading period, so that :meth:`start_settlement` starts it again."""
        with self._lock:
            if self.settlement is not None and self.settlement.period == job.period:
                self.settlement = None

    def finish_settlement(self, job: SettlementJob, outcome: TradingOutcome) -> None:
        """Settle ``job``'s Trading period with ``outcome``, what :meth:`run_settlement` made of it.

        Each player's prices are recorded, holding the prices of the facility types they had operating
        (#1002). Each player is paid what it made, less any revenue tax a climate event took (#1012) and the fuel it
        paid for (:meth:`_fuel_payment`), their
        storage keeps the energy it ends with, and a player with anything operating gets a result. A player with nothing operating gets neither a
        price record nor a result, and nor does one who joined while the period was being simulated. If the
        grid went down, the period is recorded as a blackout, so that advancing from it ends the Round.

        It is saved even if no player had anything operating, since the session must remember that the
        period is settled. If the save fails, nothing changes and the period still counts as being
        simulated, so the caller can try again with the same ``outcome`` rather than simulate it again.
        """
        with self._lock:
            self._settle(job, outcome)
            self.settlement = None

    def _settle(self, job: SettlementJob, outcome: TradingOutcome) -> None:
        """Apply ``outcome`` to the session and save it. The caller holds the lock."""
        period = job.period
        if self.checkpoint != period or self.settled_period == period:
            raise RuntimeError(f"{period} is not waiting to be settled")
        players = [self.network.members[bidder.player_id] for bidder in job.bidders]
        # Worked out before anything changes, so a failure here leaves the session as it was.
        tax_rate = revenue_tax_rate(self.fired_events, period.round, period.season)
        paid = {
            player.account_id: self._fuel_payment(player, result.model_copy(update={"revenue_tax_rate": tax_rate}))
            for player in players
            if (result := outcome.results.get(player.account_id)) is not None
        }
        before = [
            (
                player.money,
                list(player.locked_prices),
                dict(player.stored_energy),
                list(player.trading_results),
                dict(player.fuel_stock),
            )
            for player in players
        ]
        previous_amplitude, settled_period, blackouts = self.demand_amplitude, self.settled_period, self.blackouts
        recorded_periods = self.recorded_periods
        self.demand_amplitude = job.base_demand_amplitude
        if outcome.blackout:
            self.blackouts = [*blackouts, period]
        for player in players:
            operating = {
                owned.facility for owned in player.owned_facilities if is_operating(owned, current_round=period.round)
            }
            if operating:
                player.locked_prices.append(
                    LockedPrices(round=period.round, season=period.season, prices=player.prices.only(operating))
                )
        for player in players:
            player.stored_energy = outcome.stored_energy[player.account_id]
            if player.account_id in paid:
                result, player.fuel_stock = paid[player.account_id]
                player.money += result.net
                player.trading_results.append(result)
        self.settled_period = period
        try:
            # Listed only once its record is written: a page reading records does not take the session's
            # lock, so it may look in between.
            outcome.record.save(self.record_path(period))
            self.recorded_periods = [*recorded_periods, period]
            self._save(self.checkpoint, self.phase_timer)
        except BaseException:
            # Undo the settlement, so the session matches the file and the next attempt retries it.
            for player, (money, locked_prices, stored_energy, trading_results, fuel_stock) in zip(
                players, before, strict=True
            ):
                player.money, player.locked_prices = money, locked_prices
                player.stored_energy, player.trading_results = stored_energy, trading_results
                player.fuel_stock = fuel_stock
            self.demand_amplitude, self.settled_period, self.blackouts = previous_amplitude, settled_period, blackouts
            self.recorded_periods = recorded_periods
            raise

    def _fuel_held(self, player: WorkshopPlayer) -> dict[Fuel, float] | None:
        """The fuel ``player``'s facilities can burn in the Trading period being settled: under manual procurement,
        their stock plus their order (#1010). None under automatic procurement, where fuel never runs short.
        The caller holds the lock.
        """
        if self.fuel_procurement != "manual":
            return None
        held = dict(player.fuel_stock)
        for fuel, quantity in player.fuel_order.items():
            held[fuel] = held.get(fuel, 0.0) + quantity
        return held

    def _fuel_payment(self, player: WorkshopPlayer, result: TradingResult) -> tuple[TradingResult, dict[Fuel, float]]:
        """What ``player`` pays for the fuel of the Trading period ``result`` is for: the result with the fuel they paid
        for, and their stock afterwards. Changes nothing. The caller holds the lock.

        Under manual procurement, the player pays for their order, which joins their stock, and the period's burn
        comes out of it. Their facilities could burn no more than that (:meth:`_fuel_held`). Under automatic
        procurement, the burn comes out of their stock first, and they pay for the rest. Either way it is at the
        season's price.
        """
        burned: dict[Fuel, float] = {}
        for facility, performance in result.facilities.items():
            fuel = CATALOG[facility].fuel_type
            if fuel is not None:
                burned[fuel] = burned.get(fuel, 0.0) + performance.fuel_burned
        stock = dict(player.fuel_stock)
        bought: dict[Fuel, float] = {}
        if self.fuel_procurement == "manual":
            for fuel, quantity in player.fuel_order.items():
                if fuel in burned:
                    bought[fuel] = quantity
                    stock[fuel] = stock.get(fuel, 0.0) + quantity
            for fuel, amount in burned.items():
                held = stock.get(fuel, 0.0)
                # Burning all of it can leave a rounding error either side of zero, which counts as none.
                stock[fuel] = held - amount if held - amount > held * _EMPTY_STOCK else 0.0
        else:
            for fuel, amount in burned.items():
                from_stock = min(stock.get(fuel, 0.0), amount)
                stock[fuel] = stock.get(fuel, 0.0) - from_stock
                bought[fuel] = amount - from_stock
        purchases = [
            FuelPurchase(fuel=fuel, quantity=quantity, price=self.fuel_price(fuel))
            for fuel, quantity in bought.items()
            if quantity > 0
        ]
        stock = {fuel: amount for fuel, amount in stock.items() if amount > 0}
        return result.model_copy(update={"fuel": purchases}), stock

    def fuel_price(self, fuel: Fuel) -> float:
        """``fuel``'s price per kg this season. Its catalog price if the season has none, as in a session saved
        during a Trading period before fuel had prices.
        """
        price = self.fuel_prices.get(fuel)
        return price.price if price is not None else CATALOG_FUEL_PRICES[fuel]

    def join(self, account: Account) -> WorkshopPlayer:
        """Place ``account`` into the Run's Network, or return its existing player."""
        with self._lock:
            is_new = account.account_id not in self.network.members
            player = self.network.join(account)
            if is_new:
                try:
                    self._save(self.checkpoint, self.phase_timer)
                except BaseException:
                    # Undo the join, so the session matches the file and the next entry retries it.
                    del self.network.members[account.account_id]
                    raise
            return player

    def _save(self, checkpoint: Checkpoint, phase_timer: PhaseTimer | None) -> None:
        """Write the session to its file as it would be at ``checkpoint`` with ``phase_timer``."""
        saved = _SavedSession(
            checkpoint=checkpoint,
            round_count=self.round_count,
            levers=self.levers,
            phase_timer=phase_timer,
            players=[
                _SavedPlayer(
                    account_id=player.account_id,
                    username=player.username,
                    money=player.money,
                    owned_facilities=player.owned_facilities,
                    purchases=player.purchases,
                    selection=player.selection,
                    stored_energy=player.stored_energy,
                    prices=player.prices,
                    locked_prices=player.locked_prices,
                    trading_results=player.trading_results,
                    fuel_stock=player.fuel_stock,
                    fuel_order=player.fuel_order,
                )
                for player in self.network.players()
            ],
            weather_seed=self.weather_seed,
            demand_amplitude=self.demand_amplitude,
            settled_period=self.settled_period,
            round_format=self.round_format,
            blackouts=self.blackouts,
            recorded_periods=self.recorded_periods,
            fuel_procurement=self.fuel_procurement,
            fuel_prices=self.fuel_prices,
            unlocks=self.unlocks,
            event_picks=self.event_picks,
            fired_events=self.fired_events,
        )
        write_atomically(self.path, saved.model_dump_json(indent=2))
