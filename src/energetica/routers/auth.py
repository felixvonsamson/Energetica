"""The persistent world's ``/auth/me``: the entry gate plus the account's role and settled status.

Credentials, signup, logout and change-password are owned by the **lobby** now (ADR-0002/0003);
the instance no longer mints sessions. It only *validates* the shared-secret SSO cookie and
enforces this instance's access policy — the **entry gate**, which lives in
:func:`energetica.identity.web.resolve_entry_account` so Workshop shares it. There is nothing left
to auto-provision (ADR-0004): role is a lobby fact read straight from ``accounts.db``, and a
``Player`` only ever exists for an account that has actually settled. ``/auth/me`` is the SPA's
first authenticated call on load.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.freeplay.database.player import Player
from energetica.identity.accounts import Account
from energetica.identity.web import get_role, resolve_entry_account
from energetica.schemas.auth import UserOut
from energetica.schemas.capabilities import PlayerCapabilities

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
