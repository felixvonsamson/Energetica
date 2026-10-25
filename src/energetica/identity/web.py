"""Request dependencies that resolve the caller's account and role.

These hand the session cookie to the lobby service, which answers with the account and its standing
in this run (ADR-0009), and read nothing from any mode's world, so every application package can
use them: the persistent world's routes and real-time layer, and Workshop's routes. The entry gate,
:func:`resolve_entry_account`, is here too, so both apps admit accounts by the same access policy,
and so is its Socket.IO form, :func:`admit_socket_connection`. Dependencies that need the persistent
world, such as resolving a settled ``Player`` or refusing writes after freeze, live in
``energetica.utils.auth``.
"""

import logging
from dataclasses import dataclass
from http.cookies import SimpleCookie
from typing import Any

from fastapi import HTTPException, Request, status
from socketio.exceptions import ConnectionRefusedError

from energetica.identity import instance_config
from energetica.identity.account import Account, Role
from energetica.identity.game_error import IdentityErrorCode
from energetica.identity.lobby_service_client import LobbyServiceClient
from energetica.kernel.game_error import SharedErrorCode
from energetica.kernel.session_cookie import SESSION_COOKIE_NAME

logger = logging.getLogger(__name__)

REPLAYED_ACCOUNT_SCOPE_KEY = "energetica.replayed_account"
"""The ASGI scope key under which replay passes the account a logged request came from (#1342).

Replay calls the app in-process (:mod:`energetica.simulate`) and sets this key itself. The server
builds the scope of a real request from the connection and never sets it, so no client can.
"""

_STANDING_SCOPE_KEY = "energetica.standing"
"""
The ASGI scope key under which a request keeps its resolved :class:`Standing`, so the
dependencies and the action log share one lobby service call per request.
"""

_lobby_service: LobbyServiceClient | None = None


def lobby_service() -> LobbyServiceClient:
    """This run's client for the lobby service, connected on first use. Tests replace it."""
    global _lobby_service
    if _lobby_service is None:
        _lobby_service = LobbyServiceClient.connect(f"run-{instance_config.instance_slug() or 'unconfigured'}")
    return _lobby_service


@dataclass(frozen=True)
class Standing:
    """
    An account and its standing in this run, as the lobby service reported it for one request.

    ``role`` is ``"facilitator"`` only if a grant covers this run (server-wide or scoped to it,
    ADR-0004); ``"player"`` is the default for every other account, settled or not. ``joined`` says
    whether the account has joined this run as a player, and is ``None`` on an unconfigured
    instance, which has no slug to have joined.
    """

    account: Account
    role: Role
    joined: bool | None


def replayed_account(request: Request) -> Account | None:
    """The account a replayed request came from, or ``None`` for a real request."""
    return request.scope.get(REPLAYED_ACCOUNT_SCOPE_KEY)


def _resolve_token(token: str | None) -> Standing | None:
    """
    The standing of the account behind a session token, or ``None`` for a missing, invalid or
    expired token, or one for an account since deleted.
    """
    if not token:
        return None
    session = lobby_service().resolve_session(token, run=instance_config.instance_slug())
    if session is None:
        return None
    return Standing(
        account=Account(account_id=session.account_id, username=session.username),
        role=session.role,
        joined=session.joined,
    )


def get_standing(request: Request) -> Standing | None:
    """
    The caller's account and standing in this run, or ``None`` without a valid session.

    Resolved once per request and kept in its scope. A replayed request has no cookie, so there is
    no session to ask the lobby service about: it acts as the player it was logged for. That holds
    only because the action log records nothing but players' requests (``routers.setup_routes``).
    A facilitator request in a log written before that rule replays as a player's and is refused
    with a 403, which changes nothing.
    """
    if _STANDING_SCOPE_KEY not in request.scope:
        account = replayed_account(request)
        if account is not None:
            standing = Standing(account=account, role="player", joined=True)
        else:
            standing = _resolve_token(request.cookies.get(SESSION_COOKIE_NAME))
        request.scope[_STANDING_SCOPE_KEY] = standing
    return request.scope[_STANDING_SCOPE_KEY]


def get_current_account(request: Request) -> Account | None:
    """The account behind the session cookie, or ``None`` without a valid session."""
    standing = get_standing(request)
    return standing.account if standing is not None else None


def get_playing_account(request: Request) -> Account:
    """Restrict a route to an authenticated account whose role is ``"player"``.

    No session, or a session that resolves to a facilitator, both fail as ``403`` — plain
    authentication is already covered by the entry gate, ``/auth/me``.
    """
    standing = get_standing(request)
    if standing is None or standing.role != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=IdentityErrorCode.USER_IS_NOT_A_PLAYER)
    return standing.account


def get_facilitator(request: Request) -> Account:
    """Restrict a route to the current instance's facilitator (server-wide or scoped grant,
    ADR-0004) — the facilitator surfaces (#989) depend on this the way game routes depend on
    ``get_settled_player``.

    No session, or a session that resolves to a non-facilitator account, both fail as ``403`` —
    mirroring :func:`get_playing_account`'s convention of not distinguishing "not logged in" from
    "wrong role" here.
    """
    standing = get_standing(request)
    if standing is None or standing.role != "facilitator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=IdentityErrorCode.ACCOUNT_IS_NOT_A_FACILITATOR
        )
    return standing.account


def _enforce_instance_access(standing: Standing) -> None:
    """Gate this instance's entry on its access policy.

    A facilitator grant covering this instance (server-wide or scoped) bypasses the allowlist
    entirely (ADR-0004): the allowlist governs players, and a facilitator does not enter as one.

    ``instance.json`` (re-read fresh, no cache) decides *whether* this instance is gated at all
    — ``public`` or ``private``, and an unconfigured instance (no slug / no file) is treated as
    ``public``. *Who* may enter a private one is a separate, lobby-side fact: whether the account
    has joined the run, which the lobby service reports with the session (ADR-0007, ADR-0009) —
    ``instance.json`` no longer carries an allowlist to read. A present-but-broken config fails
    closed. On a successful, allowed read, the public-facing fragment is re-published if its fields
    have changed since this process last wrote them.
    """
    if standing.role == "facilitator":
        return
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        logger.warning("entry blocked: %s", exc)
        raise HTTPException(status.HTTP_403_FORBIDDEN, SharedErrorCode.INSTANCE_ACCESS_DENIED) from exc
    if config is not None and isinstance(config.access, instance_config.PrivateAccess) and not standing.joined:
        raise HTTPException(status.HTTP_403_FORBIDDEN, SharedErrorCode.INSTANCE_ACCESS_DENIED)
    instance_config.publish(config)


def resolve_entry(request: Request) -> Standing:
    """The entry gate. Validate the session cookie and enforce this instance's access policy.

    - No/invalid cookie, or a session for an account that no longer exists → **401**.
    - Access policy denies the account → **403**.

    Access is enforced on *every* entry — the analog of the old per-login check — so a private
    instance that is locked down after an account last visited still denies it on the next load.
    A replayed request skips the gate: it was admitted when it was logged, and the access policy
    or membership may have changed since.
    """
    standing = get_standing(request)
    if standing is not None and replayed_account(request) is not None:
        return standing
    return _admit(standing)


def resolve_entry_account(request: Request) -> Account:
    """The entry gate (:func:`resolve_entry`), for routes that only need the account."""
    return resolve_entry(request).account


def admit_socket_connection(environ: dict[str, Any]) -> Standing:
    """The entry gate for a Socket.IO connection, so a socket is admitted exactly when the Run's
    pages would be (#1142).

    ``environ`` is the one a Socket.IO ``connect`` handler receives, which carries the raw cookie
    header rather than a ``Request``. A refusal raises Socket.IO's ``ConnectionRefusedError``, whose
    message is the error type the HTTP gate would have answered with. Each app checks the account's
    role itself, since the persistent world admits only players and Workshop admits facilitators too.
    """
    cookie = SimpleCookie(environ.get("HTTP_COOKIE", ""))
    morsel = cookie.get(SESSION_COOKIE_NAME)
    try:
        return _admit(_resolve_token(morsel.value if morsel is not None else None))
    except HTTPException as exc:
        raise ConnectionRefusedError(str(exc.detail)) from exc


def _admit(standing: Standing | None) -> Standing:
    """The entry gate, given the caller's standing: a 401 without a session, else the access policy."""
    if standing is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SharedErrorCode.NOT_AUTHENTICATED)
    _enforce_instance_access(standing)
    return standing
