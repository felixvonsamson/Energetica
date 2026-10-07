"""Workshop's HTTP routes, under ``/api/v1/workshop``.

Every route goes through the same entry gate as the persistent world
(:func:`~energetica.identity.web.resolve_entry_account`), so a private Workshop Run admits the same
accounts. Advancing the session is the facilitator's alone, and tells every open page (#1140).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool

from energetica.identity.accounts import Account
from energetica.identity.web import get_facilitator, get_role, resolve_entry_account
from energetica.kernel.game_error import GameError, GameExceptionType
from energetica.workshop.realtime import invalidate_session
from energetica.workshop.schemas import WorkshopEntryOut, WorkshopMemberOut, WorkshopPlayerOut, WorkshopSessionOut
from energetica.workshop.session import SessionFinishedError, WorkshopSession

router = APIRouter(prefix="/workshop", tags=["Workshop"])


def get_session(request: Request) -> WorkshopSession:
    """The Run's session, which :func:`~energetica.workshop.app.create_workshop_app` opens."""
    return request.app.state.workshop_session


Session = Annotated[WorkshopSession, Depends(get_session)]


def _session_out(session: WorkshopSession) -> WorkshopSessionOut:
    return WorkshopSessionOut(
        checkpoint=session.checkpoint,
        next_checkpoint=session.upcoming_checkpoint(),
        round_count=session.round_count,
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
    await invalidate_session(request)
    return _session_out(session)
