"""Lobby runtime configuration derived from the environment.

The apex domain is provided explicitly by the systemd unit / ``setup-lobby.sh`` rather than
sniffed from the ``Host`` header (which is spoofable and breaks behind proxies) — Q3d.
"""

from __future__ import annotations

import os

_APEX_DOMAIN_ENV_VAR = "ENERGETICA_APEX_DOMAIN"


def apex_domain() -> str | None:
    """The server's apex domain (e.g. ``energetica-game.org``), or ``None`` if unset.

    Unset is the dev/test default: the session cookie then falls back to host-only scope, which is
    fine locally. Production sets it so the cookie spans ``.{apex}`` (ADR-0002).
    """
    return os.environ.get(_APEX_DOMAIN_ENV_VAR) or None


def cookie_domain() -> str | None:
    """The ``Domain`` attribute for the session cookie: ``.{apex}`` (spans every run subdomain), or
    ``None`` (host-only) when the apex is unset.
    """
    apex = apex_domain()
    return f".{apex}" if apex else None
