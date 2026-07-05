"""Instance-side lobby reads.

The lobby (a separate service) owns signup/login/session. Each instance additionally serves
``my-runs`` from its **own** origin so the in-run switcher makes no cross-origin call: identical
read logic (``energetica.my_runs.resolve_my_runs``, shared with the lobby service), deployed in
every service. Serves only the cookie-authenticated account's runs.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.user import User
from energetica.game_error import GameExceptionType
from energetica.my_runs import resolve_my_runs
from energetica.schemas.lobby import MyRunsResponse
from energetica.utils.auth import get_user

router = APIRouter(prefix="/lobby", tags=["Lobby"])


@router.get("/my-runs")
def get_my_runs(user: Annotated[User | None, Depends(get_user)]) -> MyRunsResponse:
    """The authenticated account's settled runs, joined against on-disk fragments for name /
    starts_at, most recently settled first. Stale memberships (run since deleted → no fragment)
    are filtered out.
    """
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)

    return resolve_my_runs(user.account_id)
