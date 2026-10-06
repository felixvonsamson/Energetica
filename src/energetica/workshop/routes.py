"""Workshop's HTTP routes, under ``/api/v1/workshop``.

Every route goes through the same entry gate as the persistent world
(:func:`~energetica.identity.web.resolve_entry_account`), so a private Workshop Run admits the same
accounts. Advancing the session and extending its running phase are the facilitator's alone, and
each tells every open page (#1140). A player's investment selection is theirs alone (#999).
"""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool

from energetica.identity.accounts import Account
from energetica.identity.web import get_facilitator, get_role, resolve_entry_account
from energetica.kernel.game_error import GameError, GameExceptionType
from energetica.workshop.facilities import FacilityId, WorkshopFacility
from energetica.workshop.player import WorkshopPlayer
from energetica.workshop.realtime import invalidate_session
from energetica.workshop.schemas import (
    WorkshopEntryOut,
    WorkshopMemberOut,
    WorkshopOwnedFacilityOut,
    WorkshopPhaseExtendIn,
    WorkshopPhaseTimerOut,
    WorkshopPlayerOut,
    WorkshopSelectionIn,
    WorkshopSelectionOut,
    WorkshopSessionOut,
)
from energetica.workshop.session import (
    FacilityNotOfferedError,
    InvestmentClosedError,
    NoPhaseRunningError,
    NotEnoughMoneyError,
    NotSelectedError,
    SessionFinishedError,
    WorkshopSession,
)
from energetica.workshop.unlocks import available_facilities

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


def _session_out(session: WorkshopSession) -> WorkshopSessionOut:
    phase_timer = session.phase_timer
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
    """
    try:
        await run_in_threadpool(session.advance)
    except SessionFinishedError as exc:
        raise GameError(GameExceptionType.WORKSHOP_SESSION_FINISHED) from exc
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


@router.get("/facilities")
def get_facilities(_: Annotated[Account, Depends(resolve_entry_account)]) -> list[WorkshopFacility]:
    """The facilities players can see and buy now. One that is not yet unlocked is left out, not
    shown as locked.
    """
    return available_facilities()


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


def _selection_out(player: WorkshopPlayer) -> WorkshopSelectionOut:
    return WorkshopSelectionOut(
        facilities=list(player.selection), total_cost=player.selection_cost(), money=player.money
    )


@router.get("/selection")
def get_selection(player: Player) -> WorkshopSelectionOut:
    """The facilities the calling player has picked to buy when the Investment phase closes."""
    return _selection_out(player)


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
    return _selection_out(player)


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
    return _selection_out(player)
