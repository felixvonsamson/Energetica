"""Instance-side lobby reads.

The lobby (a separate service) owns signup/login/session. Each instance additionally serves
``my-runs`` from its **own** origin so the in-run switcher makes no cross-origin call: identical
read logic, deployed in every service. Serves only the cookie-authenticated account's runs.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica import accounts, instance_config
from energetica.database.user import User
from energetica.game_error import GameExceptionType
from energetica.schemas.lobby import MyRun, MyRunsResponse
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

    runs: list[MyRun] = []
    for membership in accounts.get_memberships(account_id=user.account_id):
        fragment = instance_config.load_fragment(membership.slug)
        if fragment is None:
            continue
        runs.append(
            MyRun(
                slug=fragment.slug,
                name=fragment.name,
                starts_at=fragment.starts_at,
                # Stored as an ISO-8601 string (aware, written from Player.created_at); parse back
                # to the aware datetime the schema declares rather than lean on Pydantic coercion.
                settled_at=datetime.fromisoformat(membership.settled_at),
            )
        )
    return MyRunsResponse(runs=runs)
