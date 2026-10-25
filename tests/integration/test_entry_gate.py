"""Integration tests for the instance entry gate (``GET /api/v1/auth/me``).

The instance mints no sessions and checks none itself: it hands the session cookie the lobby set to
the lobby service, which answers with the account and its standing in this run (ADR-0009), and then
applies this instance's access policy. There is nothing to auto-provision (ADR-0004): role is a
lobby fact (default ``"player"`` for any account with no facilitator grant), and a ``Player`` only
ever exists for an account that has actually settled, so the entry gate is a pure read, with no
find-or-create race to guard against.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.freeplay.app import create_app
from energetica.freeplay.database.player import Player
from energetica.freeplay.globals import engine
from energetica.identity import web
from energetica.identity.lobby_service_client import LobbyServiceClient
from energetica.kernel.session_cookie import SESSION_COOKIE_NAME
from lobby_service.session import mint_session_token

from ._session_helpers import authenticate, make_account

PORT = 8000
ME_URL = f"http://localhost:{PORT}/api/v1/auth/me"


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
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
    client.cookies.set(SESSION_COOKIE_NAME, mint_session_token(999999))
    assert client.get(ME_URL).status_code == 401


def test_an_unreachable_lobby_service_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()
    authenticate(client, make_account("visitor"))
    monkeypatch.setattr(web, "_lobby_service", LobbyServiceClient.connect("test", socket_path=Path("/tmp/absent.sock")))

    assert client.get(ME_URL).status_code == 503


def test_a_request_resolves_its_session_once(
    lobby_service: LobbyServiceClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The dependencies and the action log share one lobby service call per request."""
    client = _client()
    authenticate(client, make_account("visitor"))
    calls = []
    real_resolve = lobby_service.resolve_session

    def counting_resolve(token: str, *, run: str | None = None) -> object:
        calls.append(token)
        return real_resolve(token, run=run)

    monkeypatch.setattr(lobby_service, "resolve_session", counting_resolve)

    # A write: the route checks the player and the action log records the account.
    client.patch(f"http://localhost:{PORT}/api/v1/players/me/settings", json={})

    assert len(calls) == 1


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
