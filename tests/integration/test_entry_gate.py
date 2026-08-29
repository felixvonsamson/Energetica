"""Integration tests for the instance entry gate (``GET /api/v1/auth/me``).

Post-cutover the instance mints no sessions: it validates the shared-secret SSO cookie the lobby
set (carrying the ``account_id``) against this instance's access policy. There is nothing to
auto-provision (ADR-0004): role is a lobby fact read straight from ``accounts.db`` (default
``"player"`` for any account with no facilitator grant), and a ``Player`` only ever exists for an
account that has actually settled — so the entry gate is a pure read, with no find-or-create race
to guard against.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from energetica import create_app
from energetica.database.player import Player
from energetica.globals import engine
from energetica.utils.session import SESSION_COOKIE_NAME, serializer

from ._session_helpers import authenticate, make_account

PORT = 8000
ME_URL = f"http://localhost:{PORT}/api/v1/auth/me"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def test_no_cookie_is_401() -> None:
    assert _client().get(ME_URL).status_code == 401


def test_tampered_cookie_is_401() -> None:
    client = _client()
    client.cookies.set(SESSION_COOKIE_NAME, "not-a-valid-signed-token")
    assert client.get(ME_URL).status_code == 401


def test_valid_cookie_for_unknown_account_is_401() -> None:
    """A validly-signed session for an account_id with no server-wide row (e.g. deleted) is 401,
    not a crash.
    """
    client = _client()
    client.cookies.set(SESSION_COOKIE_NAME, serializer.dumps("999999"))
    assert client.get(ME_URL).status_code == 401


def test_entry_gate_defaults_an_unsettled_account_to_player_and_creates_nothing() -> None:
    """A server-wide account with a valid session and no facilitator grant reads as an unsettled
    player — the default — and entry never creates a ``Player``; only settling does.
    """
    client = _client()
    account_id = make_account("visitor")
    authenticate(client, account_id)

    response = client.get(ME_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "visitor"
    assert body["role"] == "player"
    assert body["is_settled"] is False
    assert body["player_id"] is None
    assert next(Player.filter_by(account_id=account_id), None) is None


def test_entry_gate_is_a_pure_read_repeated_visits_change_nothing() -> None:
    client = _client()
    account_id = make_account("visitor")
    authenticate(client, account_id)

    assert client.get(ME_URL).status_code == 200
    assert client.get(ME_URL).status_code == 200

    assert next(Player.filter_by(account_id=account_id), None) is None
