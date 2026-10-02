"""Request dependencies that resolve the caller's account and role.

These read the session cookie and ``accounts.db`` (ADR-0004) and nothing from any mode's world, so
every application package can use them: the persistent world's routes and real-time layer, and
Workshop's routes. The signing and cookie primitives they build on live in
:mod:`energetica.kernel.session`. Dependencies that need the persistent world, such as resolving a
settled ``Player`` or refusing writes after freeze, live in ``energetica.utils.auth``.
"""

from typing import Literal

from fastapi import HTTPException, Request, status

from energetica.identity import accounts, instance_config
from energetica.identity.accounts import Account
from energetica.kernel.game_error import GameExceptionType
from energetica.kernel.session import SESSION_COOKIE_NAME, account_id_from_token


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
    ``get_settled_player``.

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
