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
]


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
