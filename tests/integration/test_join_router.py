"""Integration tests for the public join-link routes (#1021): ``GET/POST /api/v1/join/{token}``.

The visitor-facing counterpart to #1020's facilitator page — reachable by anyone holding the
token, not just the instance's admin. Confirming records the join in ``accounts.db``'s
``instance_membership`` (``accounts.record_join``, #1030 follow-up, ADR-0007) the same way
``test_facilitator_router.py``'s roster-add does, built on ``get_or_create_join_token`` /
``set_join_open`` for the token/toggle themselves.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.database.player import Player
from energetica.globals import engine

from ._session_helpers import authenticate, make_account

PORT = 8000
SLUG = "autumn-2025"
TOKEN = "the-real-join-token"

PRIVATE_JSON = {
    "name": "ETHZ Spring 2026",
    "advertised": False,
    "starts_at": "2026-03-01T00:00:00Z",
    "access": {
        "policy": "private",
        "join_token": TOKEN,
        "join_open": True,
    },
}
PUBLIC_JSON = {
    "name": "Autumn 2025",
    "advertised": True,
    "starts_at": "2025-09-15T00:00:00Z",
    "access": {"policy": "public"},
}


def _join_url(token: str) -> str:
    return f"http://localhost:{PORT}/api/v1/join/{token}"


@pytest.fixture
def instance_json(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point ``instance_config`` at a per-test config dir and return the path to write to."""
    config_dir = tmp_path / "etc"
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(config_dir))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    path = config_dir / SLUG / "instance.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _write(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def _client() -> TestClient:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    return TestClient(app)


def _joined_usernames() -> list[str]:
    """Usernames that have joined this test's instance, per accounts.db."""
    return [entry.username for entry in accounts.get_run_roster(slug=SLUG)]


# --- GET: resolving the link -------------------------------------------------------------------


def test_get_rejects_an_unknown_token(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()

    response = client.get(_join_url("wrong-token"))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_INVALID"


def test_get_rejects_a_token_on_a_public_instance(instance_json: Path) -> None:
    _write(instance_json, PUBLIC_JSON)
    client = _client()

    response = client.get(_join_url(TOKEN))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_INVALID"


def test_get_rejects_a_token_on_an_unconfigured_instance() -> None:
    """No ENERGETICA_INSTANCE_SLUG set at all — nothing to resolve against."""
    client = _client()

    response = client.get(_join_url(TOKEN))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_INVALID"


def test_get_with_a_valid_token_reports_the_instance_name_and_open_state(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()

    response = client.get(_join_url(TOKEN))

    assert response.status_code == 200
    body = response.json()
    assert body["instance_name"] == "ETHZ Spring 2026"
    assert body["join_open"] is True
    assert body["viewer_username"] is None


def test_get_reports_join_open_false(instance_json: Path) -> None:
    closed = {**PRIVATE_JSON, "access": {**PRIVATE_JSON["access"], "join_open": False}}
    _write(instance_json, closed)
    client = _client()

    response = client.get(_join_url(TOKEN))

    assert response.status_code == 200
    assert response.json()["join_open"] is False


def test_get_reports_the_viewer_username_for_a_signed_in_visitor_with_no_player(instance_json: Path) -> None:
    """The crux of #1021: a visitor with a valid SSO session but no Player yet (not
    access-allowed, so they've never settled) must still be identified here.
    """
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)
    assert next(Player.filter_by(account_id=account_id), None) is None

    response = client.get(_join_url(TOKEN))

    assert response.status_code == 200
    assert response.json()["viewer_username"] == "carol"
    # Merely resolving the link must not itself grant or create anything.
    assert next(Player.filter_by(account_id=account_id), None) is None
    assert "carol" not in _joined_usernames()


# --- POST: confirming -----------------------------------------------------------------------


def test_post_rejects_an_unauthenticated_visitor(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()

    response = client.post(_join_url(TOKEN))

    assert response.status_code == 401


def test_post_rejects_an_unknown_token(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    response = client.post(_join_url("wrong-token"))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_INVALID"
    assert "carol" not in _joined_usernames()


def test_post_rejects_when_join_is_closed_and_does_not_modify_the_allowlist(instance_json: Path) -> None:
    closed = {**PRIVATE_JSON, "access": {**PRIVATE_JSON["access"], "join_open": False}}
    _write(instance_json, closed)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    response = client.post(_join_url(TOKEN))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_CLOSED"
    assert "carol" not in _joined_usernames()


def test_post_adds_the_visitor_to_the_roster_and_the_entry_gate_then_admits_them(instance_json: Path) -> None:
    """The full acceptance scenario: confirm, then the existing entry gate (unmodified) admits
    the visitor as a normal player.
    """
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    # Blocked before confirming, exactly like any other not-yet-joined account.
    assert client.get(f"http://localhost:{PORT}/api/v1/auth/me").status_code == 403

    response = client.post(_join_url(TOKEN))
    assert response.status_code == 204
    assert "carol" in _joined_usernames()

    me = client.get(f"http://localhost:{PORT}/api/v1/auth/me")
    assert me.status_code == 200
    body = me.json()
    assert body["username"] == "carol"
    assert body["role"] == "player"


def test_post_is_idempotent_for_an_already_joined_username(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("alice", "pw")
    authenticate(client, account_id)
    client.post(_join_url(TOKEN))  # already joined once

    response = client.post(_join_url(TOKEN))  # confirm again

    assert response.status_code == 204
    assert _joined_usernames().count("alice") == 1


def test_post_rejects_a_token_on_a_public_instance(instance_json: Path) -> None:
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    response = client.post(_join_url(TOKEN))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_INVALID"
