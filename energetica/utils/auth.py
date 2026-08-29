"""Authentication for the game (instance) side.

The signing/credential primitives now live in the game-model-free leaf
``energetica.utils.session`` so the server-wide identity layer and the lobby can reuse them
without importing ``Player`` (ADR-0002, lobby Phase B). This module re-exports them — game-side
callers keep importing ``generate_password_hash`` etc. from ``energetica.utils.auth``
unchanged — and adds the request dependencies that resolve a session cookie against a role
(read straight from ``accounts.db``, ADR-0004) and, for players, a settled ``Player``.
"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, Request, status

from energetica import accounts, instance_config
from energetica.accounts import Account
from energetica.database.player import Player
from energetica.game_error import GameExceptionType

# Re-exported primitives (defined in the leaf; imported here so existing call sites are unchanged).
from energetica.utils.session import (
    COOKIE_MAX_AGE,
    SECRET_KEY,
    SESSION_COOKIE_NAME,
    account_id_from_token,
    add_session_cookie_to_response,
    add_session_cookie_to_session,
    check_password_hash,
    decode_session_token,
    generate_password_hash,
    get_or_create_secret_key,
    serializer,
)

__all__ = [
    "COOKIE_MAX_AGE",
    "SECRET_KEY",
    "SESSION_COOKIE_NAME",
    "account_id_from_token",
    "add_session_cookie_to_response",
    "add_session_cookie_to_session",
    "check_password_hash",
    "decode_session_token",
    "generate_password_hash",
    "get_or_create_secret_key",
    "serializer",
    "get_current_account",
    "get_account_from_token",
    "get_role",
    "get_playing_account",
    "get_facilitator",
    "get_settled_player",
    "reject_when_frozen",
]


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


def get_current_account(request: Request) -> Account | None:
    """Resolve the SSO cookie to a server-wide :class:`Account`, or ``None``.

    A missing/invalid cookie, or a cookie for an account since deleted from the server-wide
    store, both read as ``None`` here.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    return get_account_from_token(token)


def get_account_from_token(token: str) -> Account | None:
    """Resolve a raw SSO cookie token to a server-wide :class:`Account`, or ``None``.

    The token carries the immutable ``account_id`` (ADR-0002 amendment). Used directly (rather
    than through :func:`get_current_account`) by callers with a raw cookie header instead of a
    ``Request`` — e.g. Socket.IO's ``connect`` handler.
    """
    account_id = account_id_from_token(token)
    if account_id is None:
        return None
    return accounts.get_account_by_id(account_id)


def get_role(account_id: int) -> Literal["player", "facilitator"]:
    """This account's role for the current instance, read straight from ``accounts.db``
    (ADR-0004) — never from a per-instance object, since none exists until a player settles.

    ``"facilitator"`` only if explicitly granted (server-wide or scoped to this instance);
    ``"player"`` is the default for every other account, settled or not.
    """
    if accounts.is_facilitator(account_id=account_id, slug=instance_config.instance_slug()):
        return "facilitator"
    return "player"


def get_playing_account(request: Request) -> Account:
    """Restrict a route to an authenticated account whose role is ``"player"``.

    No session, or a session that resolves to a facilitator, both fail as ``403`` — plain
    authentication is already covered by the entry gate, ``/auth/me``.
    """
    account = get_current_account(request)
    if account is None or get_role(account.account_id) != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    return account


def get_facilitator(request: Request) -> Account:
    """Restrict a route to the current instance's facilitator (server-wide or scoped grant,
    ADR-0004) — the facilitator surfaces (#989) depend on this the way game routes depend on
    :func:`get_settled_player`.

    No session, or a session that resolves to a non-facilitator account, both fail as ``403`` —
    mirroring :func:`get_playing_account`'s convention of not distinguishing "not logged in" from
    "wrong role" here.
    """
    account = get_current_account(request)
    if account is None or get_role(account.account_id) != "facilitator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.ACCOUNT_IS_NOT_A_FACILITATOR
        )
    return account


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
