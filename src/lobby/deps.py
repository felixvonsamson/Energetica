"""
FastAPI dependencies: the lobby service client, and the account behind the session cookie.

The lobby backend has no game ``User`` and no database. It hands the session cookie to the lobby
service, which checks it and answers with the account (ADR-0009).
"""

from __future__ import annotations

from functools import cache
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from energetica.identity.lobby_service_client import LobbyServiceClient
from energetica.identity.schemas.lobby_service import SessionOut
from energetica.kernel.game_error import SharedErrorCode
from energetica.kernel.session_cookie import SESSION_COOKIE_NAME


@cache
def get_lobby_service() -> LobbyServiceClient:
    """The process-wide lobby service client. Tests override this dependency."""
    return LobbyServiceClient.connect("lobby-backend")


LobbyService = Annotated[LobbyServiceClient, Depends(get_lobby_service)]


def get_current_account(request: Request, service: LobbyService) -> SessionOut | None:
    """The authenticated account, or ``None`` when unauthenticated (optional-auth dependency)."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    return service.resolve_session(token)


def require_current_account(
    account: Annotated[SessionOut | None, Depends(get_current_account)],
) -> SessionOut:
    """The authenticated account, or a 401 when unauthenticated."""
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SharedErrorCode.NOT_AUTHENTICATED)
    return account
