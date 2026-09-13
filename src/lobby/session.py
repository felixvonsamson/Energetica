"""Lobby session cookie: mint, clear, and read the authenticated ``account_id``.

The lobby signs the (immutable) ``account_id`` into the shared ``session`` cookie, scoped to
``.{apex}`` so one login spans every run subdomain (ADR-0002). Signing uses the server-wide shared
secret via ``energetica.utils.session`` — the same secret every instance validates with.
"""

from __future__ import annotations

from fastapi import Request, Response

from energetica.utils.session import (
    SESSION_COOKIE_NAME,
    account_id_from_token,
    add_session_cookie_to_response,
)
from lobby.config import cookie_domain


def set_lobby_session_cookie(response: Response, account_id: int, request: Request) -> Response:
    """Sign ``account_id`` into the parent-domain session cookie on ``response``."""
    return add_session_cookie_to_response(response, str(account_id), request, domain=cookie_domain())


def clear_lobby_session_cookie(response: Response) -> Response:
    """Clear the session cookie. Must pass the same ``domain`` used to set it, or the browser keeps
    the parent-domain cookie and logout silently fails.
    """
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", domain=cookie_domain())
    return response


def account_id_from_request(request: Request) -> int | None:
    """The authenticated ``account_id`` from the session cookie, or ``None`` if absent/invalid.

    A tampered, expired, or non-integer payload reads as ``None`` (never raises).
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    return account_id_from_token(token)
