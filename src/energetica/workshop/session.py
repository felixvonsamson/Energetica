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
:mod:`~energetica.workshop.trading` clears the period's representative day and pays each player.

:class:`WorkshopSession` holds a Run's whole state: the current checkpoint, the Round count, the
round-configuration levers, the running phase's countdown, and the Run's single shared
Network. It is saved to a JSON file after
every change and reloaded from it on start, so a restart resumes the session where it was. This is
Workshop's own persistence. It shares nothing with the persistent world's model store or checkpoints
(#1049), and the file follows the shape of the session rather than of any persistent-world object.
"""

from __future__ import annotations

import math
import os
import random
import tempfile
import threading
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import BaseModel, Field

from energetica.sim.national_demand import national_demand_curve
from energetica.workshop.demand_block import PER_PLAYER_BASE_AMPLITUDE, round_one_amplitude
from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility, is_operating, lifetime_left
from energetica.workshop.network import WorkshopNetwork
from energetica.workshop.phase_timer import PhaseTimer
from energetica.workshop.prices import DEFAULT_PRICES, PRICE_FLOOR, LockedPrices, PriceSheet, PriceSide, is_storage
from energetica.workshop.seasons import SEASONS, Season
from energetica.workshop.setup import open_workshop_run
from energetica.workshop.storage import keep_what_fits
from energetica.workshop.trading import Bidder, TradingResult, representative_weather, simulate_trading_period
from energetica.workshop.unlocks import available_facilities

if TYPE_CHECKING:
    from energetica.identity.accounts import Account
    from energetica.identity.instance_config import InstanceConfig
    from energetica.workshop.player import WorkshopPlayer

# How many Rounds a session runs unless the moderator chooses otherwise (#992). A placeholder, like
# every other Workshop magnitude.
DEFAULT_ROUND_COUNT = 3

# How many different weather seeds there are. The noise behind ``sim.renewables`` repeats after 256.
WEATHER_SEEDS = 256

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


def next_checkpoint(checkpoint: Checkpoint, *, round_count: int) -> Checkpoint:
    """The checkpoint that follows ``checkpoint`` in a session of ``round_count`` Rounds."""
    match checkpoint:
        case NotStarted():
            return Investment(round=1)
        case Investment(round=round_number):
            return TradingPeriod(round=round_number, season=SEASONS[0])
        case TradingPeriod(round=round_number, season=season) if season != SEASONS[-1]:
            return TradingPeriod(round=round_number, season=SEASONS[SEASONS.index(season) + 1])
        case TradingPeriod(round=round_number):
            return Recap(round=round_number)
        case Recap(round=round_number) if round_number < round_count:
            return Investment(round=round_number + 1)
        case Recap():
            return Finished()
        case Finished():
            raise SessionFinishedError("the session is over")


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
    # How many times a day the market clears in a Trading period (#992 §2). The moderator console will
    # make it editable (#1004).
    clearings_per_day: Literal[24, 96, 288] = 24


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


class _SavedPlayer(BaseModel):
    account_id: int
    username: str
    money: float
    owned_facilities: list[OwnedFacility]
    # Defaults to empty for a file saved before selections existed.
    selection: list[FacilityId] = []
    # Defaults to empty for a file saved before stored energy existed.
    stored_energy: dict[FacilityId, float] = {}
    # Default to the starting prices and no history for a file saved before prices existed.
    prices: PriceSheet = DEFAULT_PRICES
    locked_prices: list[LockedPrices] = []
    # Defaults to none for a file saved before Trading periods were settled.
    trading_results: list[TradingResult] = []


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
        # The demand block's amplitude, in W. Set from the headcount when the first Trading period
        # settles, and kept for the rest of the session, since no formula moves it yet (#992).
        self.demand_amplitude = demand_amplitude
        # The last Trading period settled, so that none is settled twice.
        self.settled_period = settled_period
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
                selection=player.selection,
                stored_energy=player.stored_energy,
                prices=player.prices,
                locked_prices=player.locked_prices,
                trading_results=player.trading_results,
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
            clock=clock,
        )

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
        return next_checkpoint(self.checkpoint, round_count=self.round_count)

    def advance(self) -> Checkpoint:
        """Move to the next checkpoint and return it. The only way the session changes phase.

        A timed checkpoint starts its phase's countdown now. Leaving an Investment phase also buys
        any selection still waiting, so none is lost if the moderator advances before the timer has
        run out or before the purchase at its end has happened. Leaving a Trading period settles it, if
        its window has not already closed and settled it. Starting a new Round's Investment phase retires every facility whose lifetime
        has ended. Raises
        :class:`SessionFinishedError` once the session is :class:`Finished`.
        """
        with self._lock:
            checkpoint = next_checkpoint(self.checkpoint, round_count=self.round_count)
            duration = phase_duration(checkpoint, self.levers)
            phase_timer = None if duration is None else PhaseTimer(started_at=self.clock(), duration=duration)
            # Saved before it is applied, so a failed write leaves the session where the file says. A
            # purchase or retirement is saved in the same write, so it happens only if the advance does.
            if isinstance(self.checkpoint, Investment):
                saved = self._buy_selections(self.checkpoint.round, checkpoint=checkpoint, phase_timer=phase_timer)
            elif isinstance(self.checkpoint, TradingPeriod):
                saved = self._settle(self.checkpoint, checkpoint=checkpoint, phase_timer=phase_timer)
            elif isinstance(checkpoint, Investment):
                saved = self._retire_expired(checkpoint.round, checkpoint=checkpoint, phase_timer=phase_timer)
            else:
                saved = False
            if not saved:
                self._save(checkpoint, phase_timer)
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
            if facility not in {offered.id for offered in available_facilities()}:
                raise FacilityNotOfferedError(f"{facility} is not offered")
            player = self.network.members[account_id]
            if player.selection_cost() + CATALOG[facility].base_price > player.money:
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
        players = self.network.players()
        before = [
            (player.money, list(player.owned_facilities), list(player.selection), dict(player.stored_energy))
            for player in players
        ]
        for player in players:
            player.money -= player.selection_cost()
            player.owned_facilities.extend(
                OwnedFacility(facility=facility, built_round=round_number) for facility in player.selection
            )
            player.selection.clear()
            player.stored_energy = keep_what_fits(
                player.stored_energy, player.owned_facilities, current_round=round_number
            )
        changed = any(
            (player.owned_facilities, player.stored_energy) != (owned_facilities, stored_energy)
            for player, (_, owned_facilities, _, stored_energy) in zip(players, before, strict=True)
        )
        if not changed:
            return False
        try:
            self._save(checkpoint, phase_timer)
        except BaseException:
            # Undo the purchase, so the session matches the file and the next attempt retries it.
            for player, (money, owned_facilities, selection, stored_energy) in zip(players, before, strict=True):
                player.money, player.owned_facilities, player.selection = money, owned_facilities, selection
                player.stored_energy = stored_energy
            raise
        return True

    def _retire_expired(self, round_number: int, *, checkpoint: Checkpoint, phase_timer: PhaseTimer | None) -> bool:
        """Retire every facility past its lifetime in Round ``round_number``, and return whether any was.

        Retirement needs no player action and pays nothing back (#992 §6). It is saved with the session
        at ``checkpoint`` with ``phase_timer``, and nothing is saved if nothing retires. The caller holds
        the lock.
        """
        before = {player: list(player.owned_facilities) for player in self.network.players()}
        for player in before:
            player.owned_facilities = [
                owned
                for owned in player.owned_facilities
                if lifetime_left(owned, current_round=round_number).rounds > 0
            ]
        if all(player.owned_facilities == owned for player, owned in before.items()):
            return False
        try:
            self._save(checkpoint, phase_timer)
        except BaseException:
            # Undo the retirement, so the session matches the file and the next attempt retries it.
            for player, owned in before.items():
                player.owned_facilities = owned
            raise
        return True

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

    def close_price_setting(self) -> bool:
        """Settle the Trading period if its price-setting window has run out, and return whether it did.

        Nothing happens while the window is open, outside a Trading period, or once the period is settled.
        """
        with self._lock:
            if not isinstance(self.checkpoint, TradingPeriod) or self.price_setting_open():
                return False
            return self._settle(self.checkpoint, checkpoint=self.checkpoint, phase_timer=self.phase_timer)

    def _settle(self, period: TradingPeriod, *, checkpoint: Checkpoint, phase_timer: PhaseTimer | None) -> bool:
        """Settle ``period``, unless it already is, and return whether it was settled now.

        Each player's prices are recorded, holding the prices of the facility types they had operating
        (#1002). The engine then simulates the period (#1003): each player is paid what it made, their
        storage keeps the energy it ends with, and a player with anything operating gets a result. A
        player with nothing operating gets neither a price record nor a result. The first Trading period
        settled also fixes the demand block's amplitude from the headcount.

        It is saved with the session at ``checkpoint`` with ``phase_timer``. The caller holds the lock.
        """
        if self.settled_period == period:
            return False
        players = self.network.players()
        before = [
            (player.money, list(player.locked_prices), dict(player.stored_energy), list(player.trading_results))
            for player in players
        ]
        demand_amplitude = self.demand_amplitude
        if self.demand_amplitude is None:
            self.demand_amplitude = round_one_amplitude(PER_PLAYER_BASE_AMPLITUDE, headcount=len(players))
        for player in players:
            operating = {
                owned.facility for owned in player.owned_facilities if is_operating(owned, current_round=period.round)
            }
            if operating:
                player.locked_prices.append(
                    LockedPrices(round=period.round, season=period.season, prices=player.prices.only(operating))
                )
        # A blackout is not acted on yet: what it does to the session is #1005.
        outcome = simulate_trading_period(
            [
                Bidder(player.account_id, player.owned_facilities, player.prices, player.stored_energy)
                for player in players
            ],
            round_number=period.round,
            season=period.season,
            clearings_per_day=self.levers.clearings_per_day,
            amplitude=self.demand_amplitude,
            curve=national_demand_curve(),
            weather=representative_weather(self.weather_seed),
        )
        for player in players:
            player.stored_energy = outcome.stored_energy[player.account_id]
            result = outcome.results.get(player.account_id)
            if result is not None:
                player.money += result.net
                player.trading_results.append(result)
        self.settled_period = period
        try:
            self._save(checkpoint, phase_timer)
        except BaseException:
            # Undo the settlement, so the session matches the file and the next attempt retries it.
            for player, (money, locked_prices, stored_energy, trading_results) in zip(players, before, strict=True):
                player.money, player.locked_prices = money, locked_prices
                player.stored_energy, player.trading_results = stored_energy, trading_results
            self.demand_amplitude = demand_amplitude
            self.settled_period = None
            raise
        return True

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
                    selection=player.selection,
                    stored_energy=player.stored_energy,
                    prices=player.prices,
                    locked_prices=player.locked_prices,
                    trading_results=player.trading_results,
                )
                for player in self.network.players()
            ],
            weather_seed=self.weather_seed,
            demand_amplitude=self.demand_amplitude,
            settled_period=self.settled_period,
        )
        _write_atomically(self.path, saved.model_dump_json(indent=2))


def _write_atomically(path: Path, text: str) -> None:
    """Write ``text`` to ``path`` so that a crash mid-write leaves the previous file whole.

    Writes a temporary file beside ``path`` and renames it into place, which replaces the file in
    one step.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f"{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tmp_file:
            tmp_file.write(text)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
