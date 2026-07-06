"""Test helpers for the post-cutover instance auth model.

The instance no longer mints sessions — the lobby does (ADR-0002/0003). The instance only validates
the shared-secret SSO cookie carrying the immutable ``account_id``. These helpers create a
server-wide account and set that cookie on a ``TestClient`` directly, standing in for a lobby login,
so entry-gate tests need no lobby app. Minting uses the same in-process ``serializer`` the instance
validates with, so the signature is valid.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from energetica import accounts
from energetica.utils.session import SESSION_COOKIE_NAME, generate_password_hash, serializer


def make_account(username: str = "alice", password: str = "correct-password") -> int:
    """Create a server-wide account (as the lobby's signup would) and return its ``account_id``."""
    return accounts.create_account(username=username, pwhash=generate_password_hash(password))


def session_cookie_value(account_id: int) -> str:
    """The signed SSO cookie value a lobby login would set for ``account_id``."""
    return serializer.dumps(str(account_id))


def authenticate(client: TestClient, account_id: int) -> None:
    """Set the SSO cookie on ``client`` as if the account had logged in at the lobby."""
    client.cookies.set(SESSION_COOKIE_NAME, session_cookie_value(account_id))
