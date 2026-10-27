"""Workshop's HTTP routes, under ``/api/v1/workshop``.

Every route goes through the same entry gate as the persistent world
(:func:`~energetica.identity.web.resolve_entry_account`), so a private Workshop Run admits the same
accounts. Advancing the session, extending its running phase, changing the phase timers and editing each Round's
plan (#1190) are the facilitator's alone, and each tells every open page (#1140). So is reading how close each
technology is to unlocking (#1011), and so are the events: planning them, and reading what fired (#1012). A player's
investment selection (#999)
and prices (#1002) and fuel (#1009) are theirs alone. A settled Trading period's review (#1007) is open to everyone in the
Run: players see every bid, as they do in the persistent world. A Round's balance sheet (#1008) is the
player's own. A Round's Recap (#1013) is open to everyone in the Run, but only once it has opened. Everyone reads the
current Round's carbon tax vote (#1014), but only a player casts a ballot, and only their own. No answer tells how
anyone else voted, or how many did, and casting a ballot tells no other page, so the room never learns a tally.
The scoreboard (#1017) is open to everyone in the Run all game (#1250), and only the facilitator sets the teams' bonus
multipliers on it. A player's loan (#1225) is theirs alone. The
control room (#1289) is open to everyone in the Run, and names no player. Its capacity counts every player's selection
(#1287), so changing a selection tells every open page to re-read it. Once the session is finished, each player can send
feedback on the game, and read back only their own.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool

from energetica.identity.account import Account
from energetica.identity.game_error import IdentityErrorCode
from energetica.identity.web import Standing, get_facilitator, resolve_entry, resolve_entry_account
from energetica.workshop.balance_sheet import BalanceSheet, balance_sheet
from energetica.workshop.control_room import ControlRoom
from energetica.workshop.events import EVENTS, suggested_severity
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel, session_price
from energetica.workshop.feedback import FeedbackNotOpenError, FeedbackStore, WorkshopFeedback
from energetica.workshop.fuel import FUEL_NAMES, FUEL_USE, STOCKPILE_SEASONS
from energetica.workshop.game_error import WorkshopErrorCode
from energetica.workshop.loan import LOAN_AMOUNT, LOAN_PAYMENT, LOAN_PAYMENTS, payment_round
from energetica.workshop.period_record import TradingPeriodRecord
from energetica.workshop.player import WorkshopPlayer
from energetica.workshop.prices import PRICE_CEILING, PRICE_FLOOR, MarketPrices, PriceSide
from energetica.workshop.realtime import invalidate_control_room, invalidate_market_prices, invalidate_session
from energetica.workshop.recap import WorkshopRecap
from energetica.workshop.round_plan import LeverChanges, PlannedEvent, planned_effect_line
from energetica.workshop.schemas import (
    WorkshopBallotIn,
    WorkshopBonusMultipliersIn,
    WorkshopEntryOut,
    WorkshopEventOut,
    WorkshopEventsOut,
    WorkshopFacilityOut,
    WorkshopFiredEventOut,
    WorkshopFuelLineOut,
    WorkshopFuelOrderIn,
    WorkshopFuelOut,
    WorkshopLoanOut,
    WorkshopLoanPaymentOut,
    WorkshopMemberOut,
    WorkshopMeritOrderOut,
    WorkshopOwnedFacilityOut,
    WorkshopPeriodWeekOut,
    WorkshopPeriodOut,
    WorkshopPhaseExtendIn,
    WorkshopPhaseTimerOut,
    WorkshopPlannedEventOut,
    WorkshopPlansOut,
    WorkshopPlayerOut,
    WorkshopPriceIn,
    WorkshopPriceRangeOut,
    WorkshopPricesOut,
    WorkshopRoundPlanOut,
    WorkshopSelectionIn,
    WorkshopSelectionOut,
    WorkshopSessionOut,
    WorkshopSettlementOut,
    WorkshopTeamOut,
    WorkshopTechnologyProgressOut,
    WorkshopUnlocksOut,
    WorkshopVoteOut,
)
from energetica.workshop.score import Scoreboard
from energetica.workshop.seasons import WEEK_DAYS, Season
from energetica.workshop.session import (
    Finished,
    Investment,
    NoSuchRoundError,
    PhaseTimers,
    TradingPeriod,
    WorkshopSession,
)
from energetica.workshop.storage import energy_at_risk
from energetica.workshop.unlocks import CSP_UNLOCK_ROUND, UPGRADES
from energetica.workshop.votes import CARBON_TAX_RATE
from energetica.workshop.weather import capacity_factor

router = APIRouter(prefix="/workshop", tags=["Workshop"])


def get_session(request: Request) -> WorkshopSession:
    """The Run's session, which :func:`~energetica.workshop.app.create_workshop_app` opens."""
    return request.app.state.workshop_session


Session = Annotated[WorkshopSession, Depends(get_session)]


def get_player(account: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> WorkshopPlayer:
    """The calling account's player. A facilitator, or a player who has not entered yet, is refused."""
    player = session.player(account.account_id)
    if player is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=IdentityErrorCode.USER_IS_NOT_A_PLAYER)
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
            WorkshopMemberOut(account_id=player.account_id, username=player.username, team=player.team)
            for player in session.network.players()
        ],
        teams=None
        if session.teams is None
        else [WorkshopTeamOut(name=team.name, members=team.members) for team in session.teams],
        round_format=session.current_format(),
        settlement=None if settlement is None else WorkshopSettlementOut.from_progress(settlement),
        blackouts=session.blackouts,
        carbon_tax_since=session.carbon_tax_since(),
    )


@router.post("/enter")
def enter(standing: Annotated[Standing, Depends(resolve_entry)], session: Session) -> WorkshopEntryOut:
    """Enter the Run. A player is placed into its shared Network the first time and gets the same
    player every time after. A facilitator runs the session rather than plays, so is placed nowhere. In a Run with
    teams, an account on no team is refused (#1384).
    """
    if standing.role == "facilitator":
        return WorkshopEntryOut(role="facilitator", player=None)
    player = session.join(standing.account)
    return WorkshopEntryOut(
        role="player",
        player=WorkshopPlayerOut(
            account_id=player.account_id, username=player.username, team=player.team, money=player.money
        ),
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
    await run_in_threadpool(session.advance)
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
    reopened. To end a phase early, the facilitator advances the session instead.
    """
    await run_in_threadpool(session.extend_phase, timedelta(minutes=extension.minutes))
    await invalidate_session(request.app)
    return _session_out(session)


@router.get("/timers")
def get_timers(_: Annotated[Account, Depends(get_facilitator)], session: Session) -> PhaseTimers:
    """How long each timed phase is open when it starts."""
    return session.timers


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/timers")
async def set_timers(
    _: Annotated[Account, Depends(get_facilitator)], session: Session, request: Request, timers: PhaseTimers
) -> PhaseTimers:
    """Replace the phase timers, and tell every open page. They apply to the next phase that opens."""
    await run_in_threadpool(session.set_timers, timers)
    await invalidate_session(request.app)
    return session.timers


@router.get("/unlocks")
def get_unlocks(_: Annotated[Account, Depends(get_facilitator)], session: Session) -> WorkshopUnlocksOut:
    """How far each technology is from unlocking its upgrade, and what has unlocked so far. Facilitator only, so
    that each unlock comes as a surprise to the players.
    """
    progress = session.unlock_progress()
    unlocked_round = {unlock.facility: unlock.round for unlock in progress.unlocks}
    return WorkshopUnlocksOut(
        threshold=progress.threshold,
        technologies=[
            WorkshopTechnologyProgressOut(
                base=base,
                base_name=CATALOG[base].name,
                upgrade=upgrade,
                upgrade_name=CATALOG[upgrade].name,
                invested=progress.invested[base],
                unlocked_round=unlocked_round.get(upgrade),
            )
            for base, upgrade in UPGRADES.items()
        ],
        csp_unlock_round=CSP_UNLOCK_ROUND,
        unlocks=progress.unlocks,
    )


def _events_out(session: WorkshopSession) -> WorkshopEventsOut:
    view = session.events_view()
    return WorkshopEventsOut(
        events=[
            WorkshopEventOut.from_event(
                event, suggested_severity(event, emissions=view.emissions, players=view.players)
            )
            for event in EVENTS.values()
        ],
        fired=[
            WorkshopFiredEventOut(
                event=fired.event,
                name=_event_name(fired.event),
                severity=fired.severity,
                fuel=fired.fuel,
                round=fired.round,
                season=fired.season,
            )
            for fired in view.fired
        ],
        emissions=view.emissions,
    )


def _event_name(event_id: str) -> str:
    """The event's name, or its id if the catalog no longer has it."""
    return EVENTS[event_id].name if event_id in EVENTS else event_id


@router.get("/events")
def get_events(_: Annotated[Account, Depends(get_facilitator)], session: Session) -> WorkshopEventsOut:
    """The events the facilitator can plan, and every event that fired. Facilitator only, and without headlines, so
    that the Recap surprises everyone.
    """
    return _events_out(session)


def _plans_out(session: WorkshopSession) -> WorkshopPlansOut:
    view = session.plans_view()
    return WorkshopPlansOut(
        rounds=[
            WorkshopRoundPlanOut(
                round=round_number,
                locked=round_number <= view.locked_rounds,
                levers=plan.levers,
                events=[
                    WorkshopPlannedEventOut(
                        event=planned.event,
                        name=_event_name(planned.event),
                        severity=planned.severity,
                        fuel=planned.fuel,
                        season=planned.season,
                        summary=planned_effect_line(planned, round_number, fired=view.fired),
                        status=status,
                    )
                    for planned, status in statuses
                ],
            )
            for round_number, (plan, statuses) in enumerate(zip(view.plans, view.statuses, strict=True), start=1)
        ]
    )


@router.get("/plans")
def get_plans(_: Annotated[Account, Depends(get_facilitator)], session: Session) -> WorkshopPlansOut:
    """Every Round's plan: its levers and planned events, whether it is locked, and what became of each event.
    Facilitator only, so that players learn of the next Round only at the Recap.
    """
    return _plans_out(session)


# Each change waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.post("/plans:add")
async def add_round(
    _: Annotated[Account, Depends(get_facilitator)],
    session: Session,
    request: Request,
) -> WorkshopPlansOut:
    """Add a Round after the last one, and tell every open page (#1298). Its plan copies the last Round's levers,
    without its events. Refused once the last Round's Recap has opened, since it shows the final scores. Facility
    prices stay those of the length the session started with.
    """
    await run_in_threadpool(session.add_round)
    await invalidate_session(request.app)
    return _plans_out(session)


@router.patch("/plans/{round_number}/levers")
async def change_round_levers(
    _: Annotated[Account, Depends(get_facilitator)],
    session: Session,
    request: Request,
    round_number: int,
    changes: LeverChanges,
) -> WorkshopPlansOut:
    """Change some of a Round's levers, and tell every open page. A lever left out of the body stays as it is. Each
    lever that changed also changes in every later Round. A locked Round cannot change, and a change that would
    leave the Round or a later one invalid is refused, naming that Round. Every storage type needs the full-season
    format. A carbon tax vote cannot be planned for Round 1, which no Recap announces, nor once a carbon tax has
    passed.
    """
    changed = await run_in_threadpool(session.set_levers, round_number, changes)
    if changed:
        await invalidate_session(request.app)
    return _plans_out(session)


@router.put("/plans/{round_number}/events")
async def plan_event(
    _: Annotated[Account, Depends(get_facilitator)],
    session: Session,
    request: Request,
    round_number: int,
    planned: PlannedEvent,
) -> WorkshopPlansOut:
    """Plan an event for a Round, and for a seasonal event a season. It takes the place of any event of the same
    category planned for the same boundary. A locked Round cannot change, and Round 1 holds no events.
    """
    changed = await run_in_threadpool(session.plan_event, round_number, planned)
    if changed:
        await invalidate_session(request.app)
    return _plans_out(session)


@router.delete("/plans/{round_number}/events/{event_id}")
async def unplan_event(
    _: Annotated[Account, Depends(get_facilitator)],
    session: Session,
    request: Request,
    round_number: int,
    event_id: str,
    season: Season | None = None,
) -> WorkshopPlansOut:
    """Drop an event planned for a Round's ``season``, or for the Round if no season is given. Dropping one that is
    not planned changes nothing. A locked Round cannot change.
    """
    changed = await run_in_threadpool(session.unplan_event, round_number, event_id, season)
    if changed:
        await invalidate_session(request.app)
    return _plans_out(session)


@router.get("/facilities")
def get_facilities(
    account: Annotated[Account, Depends(resolve_entry_account)], session: Session
) -> list[WorkshopFacilityOut]:
    """The facilities players can buy in the current Round, and any others the calling player owns, in
    catalog order, at the current Round's prices. One that is not yet unlocked is left out, not shown as locked.
    """
    for_sale = {facility.id for facility in session.offered_facilities()}
    player = session.player(account.account_id)
    owned = {owned.facility for owned in player.owned_facilities} if player is not None else set()
    return [
        WorkshopFacilityOut(
            **facility.model_dump(exclude={"base_price"}),
            base_price=session_price(facility.id, session.price_round_count),
            for_sale=facility.id in for_sale,
            price=session.facility_price(facility.id),
            fuel_use=FUEL_USE.get(facility.id),
            capacity_factor=capacity_factor(session.weather_seed, facility.id),
        )
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
    # Only warn once a full-season Round has been played. Full-season mode stays on once it is on, and before it
    # the stored energy matters little: a representative week starts from its cyclic charge, and batteries
    # hold little energy anyway.
    previous_round = session.current_round() - 1
    after_full_season = (
        previous_round >= 1 and session.plans[previous_round - 1].levers.round_format.trading_format == "full_season"
    )
    stored_energy_at_risk = (
        energy_at_risk(
            player.stored_energy,
            player.owned_facilities,
            player.selection,
            current_round=session.current_round(),
        )
        if after_full_season
        else {}
    )
    return WorkshopSelectionOut(
        facilities=list(player.selection),
        total_cost=player.selection_cost(session.facility_prices()),
        money=player.money,
        stored_energy_at_risk=stored_energy_at_risk,
    )


@router.get("/selection")
def get_selection(player: Player, session: Session) -> WorkshopSelectionOut:
    """The facilities the calling player has picked to buy when the Investment phase closes."""
    return _selection_out(player, session)


# Each change waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.post("/selection")
async def add_to_selection(
    request: Request, player: Player, session: Session, pick: WorkshopSelectionIn
) -> WorkshopSelectionOut:
    """Add one facility to the calling player's selection, and tell the control room. Only while the Investment phase
    is open, and only if the player can pay for the whole selection.
    """
    await run_in_threadpool(session.select, player.account_id, pick.facility)
    await invalidate_control_room(request.app)
    return _selection_out(player, session)


@router.delete("/selection/{facility}")
async def remove_from_selection(
    request: Request, player: Player, session: Session, facility: FacilityId
) -> WorkshopSelectionOut:
    """Take one copy of ``facility`` out of the calling player's selection, and tell the control room. Only while the
    Investment phase is open.
    """
    await run_in_threadpool(session.deselect, player.account_id, facility)
    await invalidate_control_room(request.app)
    return _selection_out(player, session)


def _prices_out(player: WorkshopPlayer) -> WorkshopPricesOut:
    return WorkshopPricesOut(
        sell=player.prices.sell,
        buy=player.prices.buy,
        price_range=WorkshopPriceRangeOut(floor=PRICE_FLOOR, ceiling=PRICE_CEILING),
    )


@router.get("/prices")
def get_prices(player: Player) -> WorkshopPricesOut:
    """The prices the calling player offers their facilities' power at."""
    return _prices_out(player)


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/prices/{facility}/{side}")
async def set_price(
    request: Request, player: Player, session: Session, facility: FacilityId, side: PriceSide, new: WorkshopPriceIn
) -> WorkshopPricesOut:
    """Set the calling player's ``side`` price for ``facility``: what it sells at, or for storage, what
    it buys at to charge. Only while a Trading period's price-setting window is open.
    """
    await run_in_threadpool(session.set_price, player.account_id, facility, side, new.price)
    await invalidate_market_prices(request.app)
    return _prices_out(player)


def _fuel_out(player: WorkshopPlayer, session: WorkshopSession) -> WorkshopFuelOut:
    needs = session.fuel_needs(player, session.current_round())
    # Only the last settled period counts. A player with nothing operating in it usually has no result for it, so
    # their last one is from further back. If they got a share of a carbon tax, their result for it has no
    # facilities, so no fuel ran out.
    last = player.trading_results[-1] if player.trading_results else None
    run_out = set()
    if last is not None and TradingPeriod(round=last.round, season=last.season) == session.settled_period:
        run_out = last.fuels_run_out
    lines = []
    for fuel in Fuel:
        price = session.fuel_prices.get(fuel)
        if price is None:
            continue
        # A fuel the player does not burn is listed for its price alone (#1290).
        burned = fuel in needs
        need = needs.get(fuel, 0.0)
        lines.append(
            WorkshopFuelLineOut(
                fuel=fuel,
                name=FUEL_NAMES[fuel],
                burned=burned,
                price=price.price,
                change=price.change,
                shocked=price.shocked,
                stock=player.fuel_stock.get(fuel, 0.0),
                season_need=need,
                stockpile_limit=STOCKPILE_SEASONS * need,
                order=player.fuel_order.get(fuel) if burned and session.fuel_procurement == "manual" else None,
                ran_out=fuel in run_out,
            )
        )
    return WorkshopFuelOut(procurement=session.fuel_procurement, fuels=lines)


@router.get("/fuel")
def get_fuel(player: Player, session: Session) -> WorkshopFuelOut:
    """Every fuel's price this season, the calling player's stock of it, and for a fuel their operating facilities
    burn, under manual procurement, what they buy when the price-setting window closes.
    """
    return _fuel_out(player, session)


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/fuel/{fuel}")
async def set_fuel_order(player: Player, session: Session, fuel: Fuel, order: WorkshopFuelOrderIn) -> WorkshopFuelOut:
    """Set how much ``fuel`` the calling player buys when the price-setting window closes. Only under manual
    procurement, while the window is open, and for a fuel their operating facilities burn. A quantity that would
    take their stock over the stockpile limit is cut down to fit.
    """
    await run_in_threadpool(session.set_fuel_order, player.account_id, fuel, order.quantity)
    return _fuel_out(player, session)


def _period_record(session: WorkshopSession, round_number: int, season: Season) -> TradingPeriodRecord:
    """The record of the period, or 404 if it has none: not settled yet, or settled before records were kept."""
    record = session.period_record(TradingPeriod(round=round_number, season=season))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=WorkshopErrorCode.WORKSHOP_NO_PERIOD_RECORD)
    return record


# Reads the record from disk the first time, so these run on a worker thread.
@router.get("/periods/{round_number}/{season}")
def get_period(
    _: Annotated[Account, Depends(resolve_entry_account)], session: Session, round_number: int, season: Season
) -> WorkshopPeriodOut:
    """A settled Trading period's simulated days and settlement points, for its review."""
    return WorkshopPeriodOut.from_record(_period_record(session, round_number, season))


@router.get("/periods/{round_number}/{season}/prices")
def get_market_prices(
    _: Annotated[Account, Depends(resolve_entry_account)], session: Session, round_number: int, season: Season
) -> MarketPrices:
    """Every player's prices for a Trading period, the same for everyone in the Run (#1299): live while it is the
    current period, and the prices it ran at once settled.
    """
    return session.market_prices(TradingPeriod(round=round_number, season=season))


@router.get("/periods/{round_number}/{season}/weeks/{week}")
def get_period_week(
    _: Annotated[Account, Depends(resolve_entry_account)],
    session: Session,
    round_number: int,
    season: Season,
    week: int,
) -> WorkshopPeriodWeekOut:
    """Every settlement point of one simulated week of a settled Trading period: the price, and each player's and
    each demand tier's power. ``week`` is the week's position in the period, from 0: a representative week is week
    0 of 1, and a full season has 13.
    """
    record = _period_record(session, round_number, season)
    if not 0 <= week < len(record.days) // WEEK_DAYS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=WorkshopErrorCode.WORKSHOP_NO_SUCH_WEEK)
    return WorkshopPeriodWeekOut.from_record(record, week)


@router.get("/periods/{round_number}/{season}/points/{point}/merit-order")
def get_merit_order(
    _: Annotated[Account, Depends(resolve_entry_account)],
    session: Session,
    round_number: int,
    season: Season,
    point: int,
) -> WorkshopMeritOrderOut:
    """The merit order at one settlement point of a settled Trading period, counted from the period's first.
    Every bid is listed with its player, whether it sold or not. A point the grid was down at after a blackout never
    cleared, so it has none.
    """
    record = _period_record(session, round_number, season)
    if not 0 <= point < record.point_count:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=WorkshopErrorCode.WORKSHOP_NO_SUCH_POINT)
    order = record.merit_order(point)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=WorkshopErrorCode.WORKSHOP_GRID_DOWN)
    return WorkshopMeritOrderOut.from_merit_order(order)


@router.get("/rounds/{round_number}/balance-sheet")
def get_balance_sheet(player: Player, session: Session, round_number: int) -> BalanceSheet:
    """The calling player's balance sheet for a Round: what each settled season earned and cost, and the Round's
    investments and net profit so far, and the loan and its payments.
    """
    if not 1 <= round_number <= session.round_count:
        raise NoSuchRoundError(f"the session has no Round {round_number}")
    settled = session.settled_period
    return balance_sheet(
        round_number,
        results=player.trading_results,
        purchases=player.purchases,
        settled=(settled.round, settled.season) if settled is not None else None,
        blackouts=session.blackouts,
        loan=player.loan,
        round_count=session.round_count,
    )


@router.get("/rounds/{round_number}/recap")
def get_recap(
    _: Annotated[Account, Depends(resolve_entry_account)], session: Session, round_number: int
) -> WorkshopRecap:
    """The Recap that closes a Round: what happened in it, and what the next Round holds. The same for everyone in
    the Run, and refused until it opens, so that no headline is told before.
    """
    return session.recap(round_number)


@router.get("/scoreboard")
def get_scoreboard(_: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> Scoreboard:
    """Every player's score after the Rounds completed so far, highest first, with what it adds up from. The same
    for everyone in the Run. Final once the session is over.
    """
    return session.scoreboard()


# Waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.put("/scoreboard/bonus-multipliers")
async def set_bonus_multipliers(
    _: Annotated[Account, Depends(get_facilitator)],
    session: Session,
    request: Request,
    bonus_multipliers: WorkshopBonusMultipliersIn,
) -> Scoreboard:
    """Set the bonus multiplier of each team named, which multiplies its score, and tell every open page. Only in a
    Run with teams, and only for its teams.
    """
    await run_in_threadpool(session.set_bonus_multipliers, bonus_multipliers.multipliers)
    await invalidate_session(request.app)
    return session.scoreboard()


def get_feedback_store(request: Request) -> FeedbackStore:
    """The database of players' feedback, which :func:`~energetica.workshop.app.create_workshop_app` opens."""
    return request.app.state.feedback_store


FeedbackStoreDep = Annotated[FeedbackStore, Depends(get_feedback_store)]


@router.get("/feedback")
def get_feedback(player: Player, store: FeedbackStoreDep) -> WorkshopFeedback | None:
    """The feedback the calling player sent, or null if they have not sent any. Players only."""
    return store.get(player.account_id)


# Writes the feedback database, so it runs on a worker thread.
@router.put("/feedback")
def send_feedback(
    player: Player, session: Session, store: FeedbackStoreDep, feedback: WorkshopFeedback
) -> WorkshopFeedback:
    """Send the calling player's feedback on the game, in place of any they sent before. Only once the session is
    finished.
    """
    if not isinstance(session.checkpoint, Finished):
        raise FeedbackNotOpenError("the session is not finished")
    store.save(
        account_id=player.account_id,
        username=player.username,
        team=player.team,
        feedback=feedback,
        submitted_at=session.clock(),
    )
    return store.get(player.account_id) or feedback


# Reads a settled period's record the first time it is asked for, so it runs on a worker thread.
@router.get("/control-room")
def get_control_room(_: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> ControlRoom:
    """Everything the control room dashboard shows the room, apart from where the session is: alarms, carbon, each
    settled season's prices and generation, the room's prices without names, and fuel prices. The same for everyone
    in the Run.
    """
    return session.control_room()


def _vote_out(session: WorkshopSession, account_id: int) -> WorkshopVoteOut:
    round_number = session.current_round()
    return WorkshopVoteOut(
        round=round_number,
        held=session.vote_held(),
        tax_rate=CARBON_TAX_RATE,
        ballot=session.ballot(account_id),
        passed=session.vote_passed(round_number),
    )


@router.get("/vote")
def get_vote(account: Annotated[Account, Depends(resolve_entry_account)], session: Session) -> WorkshopVoteOut:
    """The current Round's carbon tax vote: whether it holds one, the caller's ballot, and once the Investment phase
    is over, whether it passed.
    """
    return _vote_out(session, account.account_id)


# Waits on the session's lock and writes the session file, so it runs on a worker thread. It tells no other page,
# so that nobody can count the ballots.
@router.put("/vote/ballot")
async def cast_ballot(player: Player, session: Session, ballot: WorkshopBallotIn) -> WorkshopVoteOut:
    """Cast the calling player's ballot in the current Round's vote, in place of any they cast before. Only while the
    Investment phase is open, in a Round that holds a vote.
    """
    await run_in_threadpool(session.cast_ballot, player.account_id, ballot.ballot)
    return _vote_out(session, player.account_id)


def _loan_out(player: WorkshopPlayer, session: WorkshopSession) -> WorkshopLoanOut:
    loan, round_number = player.loan, session.current_round()
    payments = []
    if loan is not None:
        for index in range(LOAN_PAYMENTS):
            due = payment_round(loan, index)
            payments.append(
                WorkshopLoanPaymentOut(
                    round=due if due <= session.round_count else None,
                    amount=LOAN_PAYMENT,
                    paid=index < loan.payments_made,
                )
            )
    return WorkshopLoanOut(
        amount=LOAN_AMOUNT,
        payment=LOAN_PAYMENT,
        payment_count=LOAN_PAYMENTS,
        available=loan is None and round_number < session.round_count,
        taken_round=None if loan is None else loan.round,
        cancellable=loan is not None and isinstance(session.checkpoint, Investment) and loan.round == round_number,
        payments=payments,
    )


@router.get("/loan")
def get_loan(player: Player, session: Session) -> WorkshopLoanOut:
    """The calling player's loan: its terms, whether they can take it now, and once taken, its payments."""
    return _loan_out(player, session)


# Each change waits on the session's lock and writes the session file, so it runs on a worker thread.
@router.post("/loan")
async def take_loan(player: Player, session: Session) -> WorkshopLoanOut:
    """Take the loan, adding its amount to the calling player's cash straight away. Only while the Investment phase is
    open, in any Round but the last, and once per session.
    """
    await run_in_threadpool(session.take_loan, player.account_id)
    return _loan_out(player, session)


@router.delete("/loan")
async def cancel_loan(player: Player, session: Session) -> WorkshopLoanOut:
    """Cancel the loan the calling player took in this Investment phase. Only while it is open, and only if their
    selection still fits their cash without the loan.
    """
    await run_in_threadpool(session.cancel_loan, player.account_id)
    return _loan_out(player, session)
