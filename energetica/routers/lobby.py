"""Instance-side lobby reads.

The lobby (a separate service) owns signup/login/session. Each instance additionally serves
``my-runs`` from its **own** origin so the in-run switcher makes no cross-origin call: identical
read logic (``energetica.my_runs.resolve_my_runs``, shared with the lobby service), deployed in
every service. Serves only the cookie-authenticated account's runs.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.accounts import Account
from energetica.game_error import GameExceptionType
from energetica.my_runs import resolve_my_runs
from energetica.schemas.lobby import MyRunsResponse
from energetica.utils.auth import get_current_account

router = APIRouter(prefix="/lobby", tags=["Lobby"])


@router.get("/my-runs")
def get_my_runs(account: Annotated[Account | None, Depends(get_current_account)]) -> MyRunsResponse:
    """The authenticated account's settled runs, joined against on-disk fragments for name /
    starts_at, most recently settled first. Stale memberships (run since deleted → no fragment)
    are filtered out.
    """
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)

    return resolve_my_runs(account.account_id, account.username)
