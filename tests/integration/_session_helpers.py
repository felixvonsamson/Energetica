"""
Test helpers for the run's auth model.

Runs mint no sessions and hold no accounts: the lobby service does both (ADR-0009). These helpers
create an account through the lobby service the run is wired to (the ``lobby_service`` fixture) and
set the session cookie on a ``TestClient`` directly, standing in for a lobby login, so entry-gate
tests need no lobby app.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from energetica.identity import web
from energetica.kernel.session_cookie import SESSION_COOKIE_NAME

_tokens: dict[int, str] = {}


def make_account(username: str = "alice", password: str = "correct-password") -> int:
    """Create a server-wide account (as the lobby's signup would) and return its ``account_id``."""
    created = web.lobby_service().create_account(username=username, password=password)
    _tokens[created.account_id] = created.token
    return created.account_id


def session_token(account_id: int) -> str:
    """The session token the lobby service minted when :func:`make_account` created ``account_id``."""
    return _tokens[account_id]


def authenticate(client: TestClient, account_id: int) -> None:
    """Set the session cookie on ``client`` as if the account had logged in at the lobby."""
    client.cookies.set(SESSION_COOKIE_NAME, session_token(account_id))


def join(account_id: int, slug: str) -> None:
    """Join ``account_id`` to run ``slug`` as a player, as the lobby picker or a join link would."""
    web.lobby_service().add_run_member(slug, account_id)


def grant_facilitator(account_id: int, slug: str | None = None) -> None:
    """Grant ``account_id`` facilitator authority over ``slug``, or over every run if ``slug`` is ``None``."""
    web.lobby_service().grant_facilitator(account_id, slug=slug)
