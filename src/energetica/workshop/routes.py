"""Workshop's HTTP routes, under ``/api/v1/workshop``.

Every route goes through the same entry gate as the persistent world
(:func:`~energetica.identity.web.resolve_entry_account`), so a private Workshop Run admits the same
accounts. Advancing the session, extending its running phase and changing the levers are the
facilitator's alone, and each tells every open page (#1140). A player's investment selection (#999)
and prices (#1002) and fuel (#1009) are theirs alone. A settled Trading period's review (#1007) is open to everyone in the
Run: players see every bid, as they do in the persistent world. A Round's balance sheet (#1008) is the
player's own.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool

from energetica.identity.accounts import Account
from energetica.identity.web import get_facilitator, get_role, resolve_entry_account
from energetica.kernel.game_error import GameError, GameExceptionType
from energetica.workshop.balance_sheet import BalanceSheet, balance_sheet
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fuel import FUEL_NAMES, STOCKPILE_SEASONS
from energetica.workshop.player import WorkshopPlayer
from energetica.workshop.prices import PRICE_FLOOR, LockedPrices, PriceSide
from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.realtime import invalidate_session
from energetica.workshop.schemas import (
    WorkshopEntryOut,
    WorkshopFacilityOut,
    WorkshopFuelLineOut,
    WorkshopFuelOrderIn,
    WorkshopFuelOut,
    WorkshopMemberOut,
    WorkshopMeritOrderOut,
    WorkshopOwnedFacilityOut,
    WorkshopPeriodDayOut,
    WorkshopPeriodOut,
    WorkshopPhaseExtendIn,
    WorkshopPhaseTimerOut,
    WorkshopPlayerOut,
    WorkshopPriceIn,
    WorkshopPricesOut,
    WorkshopSelectionIn,
    WorkshopSelectionOut,
    WorkshopSessionOut,
    WorkshopSettlementOut,
)
from energetica.workshop.session import (
    FacilityNotOfferedError,
    FuelNotBurnedError,
    FuelNotManualError,
    InvalidFuelQuantityError,
    InvestmentClosedError,
    NoPhaseRunningError,
    NotEnoughMoneyError,
    NotSelectedError,
    NotStorageError,
    PriceBelowFloorError,
    PriceSettingClosedError,
    RoundLevers,
    SessionFinishedError,
    SettlementRunningError,
    TradingPeriod,
    WorkshopSession,
)
from energetica.workshop.seasons import Season
from energetica.workshop.storage import energy_at_risk

router = APIRouter(prefix="/workshop", tags=["Workshop"])


def get_session(request: Request) -> WorkshopSession:
    """The Run's session, which :func:`~energetica.workshop.app.create_workshop_app` opens."""
    return request.app.state.workshop_session


Session = Annotated[WorkshopSession, Depends(get_session)]


def get_player(account: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> WorkshopPlayer:
    """The calling account's player. A facilitator, or a player who has not entered yet, is refused."""
    player = session.player(account.account_id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    return player


Player = Annotated[WorkshopPlayer, Depends(get_player)]


def check_phases_now(request: Request) -> None:
    """Have the app check the phases now rather than at its next interval (see
    :mod:`~energetica.workshop.app`).
    """
    phase_check: asyncio.Event | None = getattr(request.app.state, "phase_check", None)
    if phase_check is not None:
        phase_check.set()


def _session_out(session: WorkshopSession) -> WorkshopSessionOut:
    phase_timer, settlement = session.phase_timer, session.settlement
    return WorkshopSessionOut(
        checkpoint=session.checkpoint,
        next_checkpoint=session.upcoming_checkpoint(),
        round_count=session.round_count,
        phase_timer=None
        if phase_timer is None
        else WorkshopPhaseTimerOut(remaining_seconds=phase_timer.remaining(session.clock()).total_seconds()),
        players=[
            WorkshopMemberOut(account_id=player.account_id, username=player.username)
            for player in session.network.players()
        ],
        round_format=session.current_format(),
        settlement=None if settlement is None else WorkshopSettlementOut.from_progress(settlement),
        blackouts=session.blackouts,
    )


@router.post("/enter")
def enter(account: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> WorkshopEntryOut:
    """Enter the Run. A player is placed into its shared Network the first time and gets the same
    player every time after. A facilitator moderates rather than plays, so is placed nowhere.
    """
    if get_role(account.account_id) == "facilitator":
        return WorkshopEntryOut(role="facilitator", player=None)
    player = session.join(account)
    return WorkshopEntryOut(
        role="player",
        player=WorkshopPlayerOut(account_id=player.account_id, username=player.username, money=player.money),
    )


@router.get("/session")
def get_session_state(_: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> WorkshopSessionOut:
    """Where the session is."""
    return _session_out(session)


# Async so it can send through Socket.IO directly. The advance itself waits on a lock and writes the
# session file, so it runs on a worker thread to keep the event loop free.
@router.post("/session/advance")
async def advance_session(
    _: Annotated[Account, Depends(get_facilitator)], session: Session, request: Request
) -> WorkshopSessionOut:
    """Move the session to its next checkpoint, and tell every open page. Nothing else changes the
    session's phase.

    While the Investment phase or a price-setting window is open, advancing closes it and the session
    stays where it is: the selections are bought, or the Trading period is simulated in the background.
    Advancing again moves on, once a Trading period is settled. While it is being simulated, advancing is
    refused.
    """
    try:
        await run_in_threadpool(session.advance)
    except SessionFinishedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_SESSION_FINISHED) from exc
    except SettlementRunningError as exc:
        raise GameError(GameExceptionType.WORKSHOP_SETTLEMENT_RUNNING) from exc
    # A window the advance closed is simulated now rather than at the next check.
    check_phases_now(request)
    await invalidate_session(request.app)
    return _session_out(session)


@router.post("/session/phase/extend")
async def extend_phase(
    _: Annotated[Account, Depends(get_facilitator)],
    session: Session,
    request: Request,
    extension: WorkshopPhaseExtendIn,
) -> WorkshopSessionOut:
    """Give the running phase more time, and tell every open page. A phase whose time is up cannot be
    reopened, and no phase can be ended early.
    """
    try:
        await run_in_threadpool(session.extend_phase, timedelta(minutes=extension.minutes))
    except NoPhaseRunningError as exc:
        raise GameError(GameExceptionType.WORKSHOP_NO_PHASE_RUNNING) from exc
    await invalidate_session(request.app)
    return _session_out(session)


@router.get("/levers")
def get_levers(_: Annotated[Account, Depends(get_facilitator)], session: Session) -> RoundLevers:
    """The round-configuration levers. The format levers apply from the next Round."""
    return session.levers


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/levers")
async def set_levers(
    _: Annotated[Account, Depends(get_facilitator)], session: Session, request: Request, levers: RoundLevers
) -> RoundLevers:
    """Replace the levers, and tell every open page. The timing levers apply to the next phase that opens,
    and the Round format to the next Round. Every storage type needs the full-season format.
    """
    await run_in_threadpool(session.set_levers, levers)
    await invalidate_session(request.app)
    return session.levers


@router.get("/facilities")
def get_facilities(
    account: Annotated[Account, Depends(resolve_entry_account)], session: Session
) -> list[WorkshopFacilityOut]:
    """The facilities players can buy in the current Round, and any others the calling player owns, in
    catalog order. One that is not yet unlocked is left out, not shown as locked.
    """
    for_sale = {facility.id for facility in session.offered_facilities()}
    player = session.player(account.account_id)
    owned = {owned.facility for owned in player.owned_facilities} if player is not None else set()
    return [
        WorkshopFacilityOut(**facility.model_dump(), for_sale=facility.id in for_sale)
        for facility in CATALOG.values()
        if facility.id in for_sale or facility.id in owned
    ]


@router.get("/fleet")
def get_fleet(
    account: Annotated[Account, Depends(resolve_entry_account)], session: Session
) -> list[WorkshopOwnedFacilityOut]:
    """The facilities the calling player owns, in the order they were bought. Empty for a facilitator,
    who does not play.
    """
    player = session.player(account.account_id)
    if player is None:
        return []
    current_round = session.current_round()
    return [
        WorkshopOwnedFacilityOut.from_owned(owned, current_round=current_round) for owned in player.owned_facilities
    ]


def _selection_out(player: WorkshopPlayer, session: WorkshopSession) -> WorkshopSelectionOut:
    return WorkshopSelectionOut(
        facilities=list(player.selection),
        total_cost=player.selection_cost(),
        money=player.money,
        stored_energy_at_risk=energy_at_risk(
            player.stored_energy,
            player.owned_facilities,
            player.selection,
            current_round=session.current_round(),
        ),
    )


@router.get("/selection")
def get_selection(player: Player, session: Session) -> WorkshopSelectionOut:
    """The facilities the calling player has picked to buy when the Investment phase closes."""
    return _selection_out(player, session)


# Each change waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.post("/selection")
async def add_to_selection(player: Player, session: Session, pick: WorkshopSelectionIn) -> WorkshopSelectionOut:
    """Add one facility to the calling player's selection. Only while the Investment phase is open, and
    only if the player can pay for the whole selection.
    """
    try:
        await run_in_threadpool(session.select, player.account_id, pick.facility)
    except InvestmentClosedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_INVESTMENT_CLOSED) from exc
    except FacilityNotOfferedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_FACILITY_NOT_OFFERED) from exc
    except NotEnoughMoneyError as exc:
        raise GameError(GameExceptionType.WORKSHOP_NOT_ENOUGH_MONEY) from exc
    return _selection_out(player, session)


@router.delete("/selection/{facility}")
async def remove_from_selection(player: Player, session: Session, facility: FacilityId) -> WorkshopSelectionOut:
    """Take one copy of ``facility`` out of the calling player's selection. Only while the Investment
    phase is open.
    """
    try:
        await run_in_threadpool(session.deselect, player.account_id, facility)
    except InvestmentClosedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_INVESTMENT_CLOSED) from exc
    except NotSelectedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_NOT_SELECTED) from exc
    return _selection_out(player, session)


def _prices_out(player: WorkshopPlayer) -> WorkshopPricesOut:
    return WorkshopPricesOut(sell=player.prices.sell, buy=player.prices.buy, price_floor=PRICE_FLOOR)


@router.get("/prices")
def get_prices(player: Player) -> WorkshopPricesOut:
    """The prices the calling player offers their facilities' power at."""
    return _prices_out(player)


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/prices/{facility}/{side}")
async def set_price(
    player: Player, session: Session, facility: FacilityId, side: PriceSide, new: WorkshopPriceIn
) -> WorkshopPricesOut:
    """Set the calling player's ``side`` price for ``facility``: what it sells at, or for storage, what
    it buys at to charge. Only while a Trading period's price-setting window is open.
    """
    try:
        await run_in_threadpool(session.set_price, player.account_id, facility, side, new.price)
    except PriceSettingClosedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_PRICE_SETTING_CLOSED) from exc
    except PriceBelowFloorError as exc:
        raise GameError(GameExceptionType.WORKSHOP_PRICE_BELOW_FLOOR) from exc
    except NotStorageError as exc:
        raise GameError(GameExceptionType.WORKSHOP_NOT_STORAGE) from exc
    return _prices_out(player)


@router.get("/prices/locked")
def get_locked_prices(player: Player) -> list[LockedPrices]:
    """The prices each completed Trading period ran at for the calling player, oldest first. A period
    in which they had nothing operating is left out.
    """
    return player.locked_prices


def _fuel_out(player: WorkshopPlayer, session: WorkshopSession) -> WorkshopFuelOut:
    needs = session.fuel_needs(player, session.current_round())
    lines = []
    for fuel in Fuel:
        price = session.fuel_prices.get(fuel)
        need = needs.get(fuel)
        if need is None or price is None:
            continue
        lines.append(
            WorkshopFuelLineOut(
                fuel=fuel,
                name=FUEL_NAMES[fuel],
                price=price.price,
                change=price.change,
                shocked=price.shocked,
                stock=player.fuel_stock.get(fuel, 0.0),
                season_need=need,
                stockpile_limit=STOCKPILE_SEASONS * need,
                order=player.fuel_order.get(fuel) if session.fuel_procurement == "manual" else None,
            )
        )
    return WorkshopFuelOut(procurement=session.fuel_procurement, fuels=lines)


@router.get("/fuel")
def get_fuel(player: Player, session: Session) -> WorkshopFuelOut:
    """The fuel the calling player's operating facilities burn: this season's prices, their stock, and under manual
    procurement what they buy when the price-setting window closes.
    """
    return _fuel_out(player, session)


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/fuel/{fuel}")
async def set_fuel_order(player: Player, session: Session, fuel: Fuel, order: WorkshopFuelOrderIn) -> WorkshopFuelOut:
    """Set how much ``fuel`` the calling player buys when the price-setting window closes. Only under manual
    procurement, while the window is open, and for a fuel their operating facilities burn. A quantity that would
    take their stock over the stockpile limit is cut down to fit.
    """
    try:
        await run_in_threadpool(session.set_fuel_order, player.account_id, fuel, order.quantity)
    except PriceSettingClosedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_PRICE_SETTING_CLOSED) from exc
    except FuelNotManualError as exc:
        raise GameError(GameExceptionType.WORKSHOP_FUEL_NOT_MANUAL) from exc
    except FuelNotBurnedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_FUEL_NOT_BURNED) from exc
    except InvalidFuelQuantityError as exc:
        # The request model already refuses such a quantity, so this only guards the session's own check.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return _fuel_out(player, session)


def _period_record(session: WorkshopSession, round_number: int, season: Season) -> TradingPeriodRecord:
    """The record of the period, or 404 if it has none: not settled yet, or settled before records were kept."""
    record = session.period_record(TradingPeriod(round=round_number, season=season))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This Trading period has no record")
    return record


# Reads the record from disk the first time, so these run on a worker thread.
@router.get("/periods/{round_number}/{season}")
def get_period(
    _: Annotated[Account, Depends(resolve_entry_account)], session: Session, round_number: int, season: Season
) -> WorkshopPeriodOut:
    """A settled Trading period's simulated days and settlement points, for its review."""
    return WorkshopPeriodOut.from_record(_period_record(session, round_number, season))


@router.get("/periods/{round_number}/{season}/days/{day}")
def get_period_day(
    _: Annotated[Account, Depends(resolve_entry_account)],
    session: Session,
    round_number: int,
    season: Season,
    day: int,
) -> WorkshopPeriodDayOut:
    """Every settlement point of one simulated day of a settled Trading period: the price, and each player's and
    each demand tier's power. ``day`` is the day's position in the period's days.
    """
    record = _period_record(session, round_number, season)
    if not 0 <= day < len(record.days):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The period did not simulate this day")
    return WorkshopPeriodDayOut.from_record(record, day)


@router.get("/periods/{round_number}/{season}/points/{point}/merit-order")
def get_merit_order(
    _: Annotated[Account, Depends(resolve_entry_account)],
    session: Session,
    round_number: int,
    season: Season,
    point: int,
) -> WorkshopMeritOrderOut:
    """The merit order at one settlement point of a settled Trading period, counted from the period's first.
    Every bid is listed with its player, whether it sold or not. A point after a blackout never cleared, so it has
    none.
    """
    record = _period_record(session, round_number, season)
    if not 0 <= point < record.point_count:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The period has no such settlement point")
    order = record.merit_order(point)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The grid was down at this point")
    return WorkshopMeritOrderOut.from_merit_order(order)


@router.get("/rounds/{round_number}/balance-sheet")
def get_balance_sheet(player: Player, session: Session, round_number: int) -> BalanceSheet:
    """The calling player's balance sheet for a Round: what each settled season earned and cost, and the Round's
    investments and net profit so far.
    """
    if not 1 <= round_number <= session.round_count:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The session has no such Round")
    settled = session.settled_period
    return balance_sheet(
        round_number,
        results=player.trading_results,
        purchases=player.purchases,
        settled=(settled.round, settled.season) if settled is not None else None,
        blackouts=[(period.round, period.season) for period in session.blackouts],
    )
