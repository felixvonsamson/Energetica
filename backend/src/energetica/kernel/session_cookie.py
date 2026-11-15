"""
The session cookie: its name, its lifetime, and setting it on a response.

The signing secret and the tokens themselves belong to the lobby service
(:mod:`lobby_service.session`). The lobby backend sets the cookie to a token the service minted,
and runs read it to hand it to the service, so neither holds the secret (ADR-0009).
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import Request, Response

# The single-sign-on session cookie is deliberately **not** named ``session``. Pre-cutover the
# instance minted a host-only ``session`` cookie signed with its per-instance secret; those legacy
# cookies linger in browsers for the cookie's whole ``max_age`` (60 days). Naming the shared SSO
# cookie distinctly means the post-cutover instance reads only this name and can never confuse a
# stale host-only ``session`` (which would fail to validate against the shared secret) with the
# valid ``.{apex}`` SSO cookie — RFC 6265 does not define which wins when two same-named cookies
# match a request, so a shared name risks a redirect loop for returning players (#817, ADR-0002).
SESSION_COOKIE_NAME = "energetica_session"

COOKIE_MAX_AGE = int(timedelta(days=60).total_seconds())  # NOTE: could be a command line argument in the future


def set_session_cookie(response: Response, token: str, request: Request, *, domain: str | None = None) -> Response:
    """
    Set the session cookie to ``token`` on ``response``.

    ``Secure`` is set when the reverse proxy reports HTTPS. ``domain`` scopes the cookie: an
    instance leaves it ``None`` (host-only), the lobby passes ``.{apex}`` so one session spans every
    run subdomain (ADR-0002).
    """
    is_https = request.headers.get("X-Forwarded-Proto") == "https"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        domain=domain,
    )
    return response
