"""FastAPI dependencies resolving the session cookie to an ``Account``.

The lobby has no game ``User`` — it resolves the cookie's ``account_id`` straight against the
server-wide accounts store (contrast the instance's ``get_user``, which resolves a local ``User``).
"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from energetica import accounts
from energetica.accounts import Account
from energetica.game_error import GameExceptionType
from lobby.session import account_id_from_request


def get_current_account(request: Request) -> Account | None:
    """The authenticated account, or ``None`` when unauthenticated (optional-auth dependency)."""
    account_id = account_id_from_request(request)
    if account_id is None:
        return None
    return accounts.get_account_by_id(account_id)


def require_current_account(request: Request) -> Account:
    """The authenticated account, or a 401 when unauthenticated."""
    account = get_current_account(request)
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)
    return account
