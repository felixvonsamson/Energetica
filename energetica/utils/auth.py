"""Authentication for the game (instance) side.

The signing/credential primitives now live in the game-model-free leaf
``energetica.utils.session`` so the server-wide identity layer and the lobby can reuse them
without importing ``User``/``Player`` (ADR-0002, lobby Phase B). This module re-exports them —
game-side callers keep importing ``generate_password_hash`` etc. from ``energetica.utils.auth``
unchanged — and adds the request dependencies that resolve a session cookie against this
instance's local ``User``.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, Request, status

from energetica import instance_config
from energetica.database.player import Player
from energetica.database.user import User
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
    "get_user_from_token",
    "get_user",
    "get_playing_user",
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
    """
    if instance_config.current_phase() in ("freeze", "ended"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GameExceptionType.INSTANCE_FROZEN)


def get_user_from_token(token: str) -> User | None:
    """Resolve the SSO cookie to this instance's local ``User``, or ``None``.

    The token carries the immutable ``account_id`` (ADR-0002 amendment), resolved against the local
    ``User`` via its ``account_id`` FK. This does **not** auto-provision: a valid session for an
    account with no local ``User`` yet reads as ``None`` here — provisioning is the entry gate's job
    (``routers.auth``), gated by the instance's access policy.
    """
    account_id = account_id_from_token(token)
    if account_id is None:
        return None
    return next(User.filter_by(account_id=account_id), None)


def get_user(request: Request) -> User | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    return get_user_from_token(token)


def get_playing_user(request: Request) -> User:
    user = get_user(request)
    if user is None or user.role != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    return user


def get_settled_player(request: Request) -> Player:
    user = get_user(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GameExceptionType.NOT_AUTHENTICATED)
    if user.role != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    if user.player is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=GameExceptionType.PLAYER_NOT_SET_UP)
    if (
        user.player.last_connection is None
        or (datetime.now(timezone.utc) - user.player.last_connection).total_seconds() > 300
    ):
        user.player.last_connection = datetime.now(timezone.utc)
    return user.player
