"""Request dependencies that need the persistent world.

The account and role checks (``get_current_account``, ``get_role``, ``get_facilitator`` and the
rest) read nothing from any mode's world, so they live in :mod:`energetica.identity.web` where
Workshop can use them too. This module keeps the two that cannot move: resolving a settled
``Player``, and refusing game-state writes once the instance is frozen (freeze is a persistent-world
lifecycle, #992 §10).
"""

from datetime import datetime, timezone

from fastapi import HTTPException, Request, status

from energetica.freeplay.database.player import Player
from energetica.identity import instance_config
from energetica.identity.web import get_current_account, get_role
from energetica.kernel.game_error import GameExceptionType


def reject_when_frozen() -> None:
    """Path-operation guard: reject game-state mutations once this instance has entered ``freeze``
    (or ``ended``).

    Attached via ``dependencies=[Depends(reject_when_frozen)]`` on exactly the game-action **write**
    endpoints (facilities/projects/power-priorities/resource-market/electricity-markets/map-settle/
    daily-quiz). Reads, and the meta-writes that survive freeze (chat, ``/players/me/settings``,
    notifications), keep their plain ``get_settled_player`` dependency — the frozen write-set is
    game-state mutation + the sim tick, nothing else (see G2, #860).

    Fails with ``409 Conflict`` (state, not authorization, forbids the write — distinct from the
    ``403``s that mean auth failures). This is a **backstop**: a normal client derives its phase
    locally and never fires a frozen write, so the 409 only catches a client whose clock lags the
    freeze boundary, or a stale/scripted one.

    The check is at request entry, not atomic with the mutation, so a request that passes here can
    have ``freeze_at`` cross before its handler commits — a single in-flight write landing
    milliseconds into freeze, once, at the exact boundary instant. Accepted by design: freeze is a
    coarse wall-clock boundary (client-side derivation is the primary gate, this the backstop), an
    already-submitted action completing at the deadline is the expected behaviour of any deadline,
    and the recap is a freeze-instant photograph a late write simply isn't part of. Making it
    airtight would mean re-checking inside each mutation's engine-lock section, which G2 (#860)
    deliberately rejected in favour of this entry guard.
    """
    if instance_config.current_phase() in ("freeze", "ended"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GameExceptionType.INSTANCE_FROZEN)


def get_settled_player(request: Request) -> Player:
    account = get_current_account(request)
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GameExceptionType.NOT_AUTHENTICATED)
    if get_role(account.account_id) != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    player = next(Player.filter_by(account_id=account.account_id), None)
    if player is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=GameExceptionType.PLAYER_NOT_SET_UP)
    if player.last_connection is None or (datetime.now(timezone.utc) - player.last_connection).total_seconds() > 300:
        player.last_connection = datetime.now(timezone.utc)
    return player
