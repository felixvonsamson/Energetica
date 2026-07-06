"""Instance-side authenticated entry gate.

Credentials, signup, logout and change-password are owned by the **lobby** now (ADR-0002/0003);
the instance no longer mints sessions. It only *validates* the shared-secret SSO cookie and, on an
account's first authenticated visit, auto-provisions a local ``User`` — the **entry gate** — gated
by this instance's access policy. ``/auth/me`` is that gate: the SPA's first authenticated call on
load, so provisioning there covers every subsequent game request.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from energetica import accounts, instance_config
from energetica.database.user import User
from energetica.game_error import GameExceptionType
from energetica.globals import engine
from energetica.schemas.auth import UserOut
from energetica.schemas.capabilities import PlayerCapabilities
from energetica.utils.auth import SESSION_COOKIE_NAME, account_id_from_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _enforce_instance_access(username: str) -> None:
    """Gate this instance's entry on its access policy.

    Reads ``instance.json`` fresh (no cache) so admin edits take effect on the next attempt.
    An unconfigured instance (no slug / no file) is treated as ``public``. A present-but-broken
    config fails closed. On a successful, allowed read, the public-facing fragment is re-published
    if its fields have changed since this process last wrote them.
    """
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        engine.log(f"entry blocked: {exc}")
        raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED) from exc
    if config is not None and not instance_config.is_access_allowed(config, username):
        raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED)
    instance_config.publish(config)


def resolve_entry_user(request: Request) -> User:
    """The entry gate. Validate the SSO cookie, enforce this instance's access policy, and
    auto-provision a local ``User`` on the account's first authenticated visit.

    - No/invalid cookie, or an ``account_id`` with no matching server-wide account → **401**.
    - Access policy denies the account → **403** (no ``User`` is created).
    - Otherwise: return the existing local ``User``, provisioning one (``role=player``,
      ``player=None``) if this is the account's first touch on this instance. ``Player`` creation
      still happens later, at settle.

    Access is enforced on *every* entry — the analog of the old per-login check — so a private
    instance that is locked down after a user was provisioned still denies them on the next load.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    account_id = account_id_from_token(token) if token else None
    if account_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)
    account = accounts.get_account_by_id(account_id)
    if account is None:
        # A validly-signed session for an account since deleted from the server-wide store.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)

    _enforce_instance_access(account.username)

    # Find-or-create under the engine lock. Unlike the retired /login POST (which the request
    # middleware ran under engine.lock), /auth/me is a GET the SPA fires on every load — and GET
    # and /auth/* requests deliberately bypass that middleware lock. Two first-visit tabs could
    # otherwise both pass the `user is None` check and create duplicate User rows for one account.
    # engine.lock is an RLock and this path does not already hold it, so acquiring it here is safe.
    with engine.lock:
        user = next(User.filter_by(account_id=account.account_id), None)
        if user is None:
            # First authenticated visit to this instance: provision a pickle User for the
            # server-wide account. The signed session already proves the credential; the access
            # policy above proves admission. Player creation still happens at the settle page.
            user = User(username=account.username, pwhash=account.pwhash, role="player", account_id=account.account_id)
            engine.log(f"{account.username} auto-provisioned on this instance from server-wide account")
    return user


@router.get("/me")
def get_current_user(user: Annotated[User, Depends(resolve_entry_user)]) -> UserOut:
    """Entry gate: validate the SSO cookie, enforce access, auto-provision, and return the user."""
    capabilities = None
    if user.player is not None:
        capabilities = PlayerCapabilities.from_player(user.player)

    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        player_id=user.player.id if user.player is not None else None,
        is_settled=user.player is not None,
        capabilities=capabilities,
    )
