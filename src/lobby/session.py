"""Lobby session cookie: set it to a token the lobby service minted, and clear it.

The cookie is scoped to ``.{apex}`` so one login spans every run subdomain (ADR-0002). The lobby
backend never signs or checks a token itself; the lobby service does both (ADR-0009).
"""

from __future__ import annotations

from fastapi import Request, Response

from energetica.kernel.session_cookie import SESSION_COOKIE_NAME, set_session_cookie
from lobby.config import cookie_domain


def set_lobby_session_cookie(response: Response, token: str, request: Request) -> Response:
    """Set the parent-domain session cookie to ``token`` on ``response``."""
    return set_session_cookie(response, token, request, domain=cookie_domain())


def clear_lobby_session_cookie(response: Response) -> Response:
    """Clear the session cookie. Must pass the same ``domain`` used to set it, or the browser keeps
    the parent-domain cookie and logout silently fails.
    """
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", domain=cookie_domain())
    return response
