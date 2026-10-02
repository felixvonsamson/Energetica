"""Request dependencies that resolve the caller's account and role.

These read the session cookie and ``accounts.db`` (ADR-0004) and nothing from any mode's world, so
every application package can use them: the persistent world's routes and real-time layer, and
Workshop's routes. The entry gate, :func:`resolve_entry_account`, is here too, so both apps admit
accounts by the same access policy. The signing and cookie primitives they build on live in
:mod:`energetica.kernel.session`. Dependencies that need the persistent world, such as resolving a
settled ``Player`` or refusing writes after freeze, live in ``energetica.utils.auth``.
"""

import logging
from typing import Literal

from fastapi import HTTPException, Request, status

from energetica.identity import accounts, instance_config
from energetica.identity.accounts import Account
from energetica.kernel.game_error import GameExceptionType
from energetica.kernel.session import SESSION_COOKIE_NAME, account_id_from_token

logger = logging.getLogger(__name__)


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


def _enforce_instance_access(account: Account) -> None:
    """Gate this instance's entry on its access policy.

    A facilitator grant covering this instance (server-wide or scoped) bypasses the allowlist
    entirely (ADR-0004): the allowlist governs players, and a facilitator does not enter as one.

    ``instance.json`` (re-read fresh, no cache) decides *whether* this instance is gated at all
    — ``public`` or ``private``, and an unconfigured instance (no slug / no file) is treated as
    ``public``. *Who* may enter a private one is a separate, lobby-side fact: ``accounts.db``'s
    ``instance_membership`` table (#1030 follow-up, ADR-0007) — ``instance.json`` no longer
    carries an allowlist to read. A present-but-broken config fails closed. On a successful,
    allowed read, the public-facing fragment is re-published if its fields have changed since
    this process last wrote them.
    """
    slug = instance_config.instance_slug()
    if accounts.is_facilitator(account_id=account.account_id, slug=slug):
        return
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        logger.warning("entry blocked: %s", exc)
        raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED) from exc
    if config is not None and isinstance(config.access, instance_config.PrivateAccess):
        # A loaded config implies a configured slug — load_instance_config() only returns
        # non-None once _instance_json_path() has resolved one.
        assert slug is not None
        if not accounts.has_joined(account_id=account.account_id, slug=slug):
            raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED)
    instance_config.publish(config)


def resolve_entry_account(request: Request) -> Account:
    """The entry gate. Validate the SSO cookie and enforce this instance's access policy.

    - No/invalid cookie, or an ``account_id`` with no matching server-wide account → **401**.
    - Access policy denies the account → **403**.

    Access is enforced on *every* entry — the analog of the old per-login check — so a private
    instance that is locked down after an account last visited still denies it on the next load.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    account_id = account_id_from_token(token) if token else None
    if account_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)
    account = accounts.get_account_by_id(account_id)
    if account is None:
        # A validly-signed session for an account since deleted from the server-wide store.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)

    _enforce_instance_access(account)
    return account
