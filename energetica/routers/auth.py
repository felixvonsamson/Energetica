"""Instance-side authenticated entry gate.

Credentials, signup, logout and change-password are owned by the **lobby** now (ADR-0002/0003);
the instance no longer mints sessions. It only *validates* the shared-secret SSO cookie and
enforces this instance's access policy — the **entry gate**. There is nothing left to
auto-provision (ADR-0004): role is a lobby fact read straight from ``accounts.db``, and a
``Player`` only ever exists for an account that has actually settled. ``/auth/me`` is the SPA's
first authenticated call on load.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from energetica import accounts, instance_config
from energetica.accounts import Account
from energetica.database.player import Player
from energetica.game_error import GameExceptionType
from energetica.globals import engine
from energetica.schemas.auth import UserOut
from energetica.schemas.capabilities import PlayerCapabilities
from energetica.utils.auth import SESSION_COOKIE_NAME, account_id_from_token, get_role

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _enforce_instance_access(account: Account) -> None:
    """Gate this instance's entry on its access policy.

    A facilitator grant covering this instance (server-wide or scoped) bypasses the allowlist
    entirely (ADR-0004): the allowlist governs players, and a facilitator does not enter as one.

    Reads ``instance.json`` fresh (no cache) so facilitator edits take effect on the next attempt.
    An unconfigured instance (no slug / no file) is treated as ``public``. A present-but-broken
    config fails closed. On a successful, allowed read, the public-facing fragment is re-published
    if its fields have changed since this process last wrote them.
    """
    if accounts.is_facilitator(account_id=account.account_id, slug=instance_config.instance_slug()):
        return
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        engine.log(f"entry blocked: {exc}")
        raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED) from exc
    if config is not None and not instance_config.is_access_allowed(config, account.username):
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


@router.get("/me")
def get_current_user(account: Annotated[Account, Depends(resolve_entry_account)]) -> UserOut:
    """Entry gate: validate the SSO cookie, enforce access, and return the account's role/status."""
    role = get_role(account.account_id)
    player = next(Player.filter_by(account_id=account.account_id), None) if role == "player" else None
    capabilities = PlayerCapabilities.from_player(player) if player is not None else None

    return UserOut(
        id=account.account_id,
        username=account.username,
        role=role,
        player_id=player.id if player is not None else None,
        is_settled=player is not None,
        capabilities=capabilities,
    )
