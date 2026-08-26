"""Integration tests for the public join-link routes (#1021): ``GET/POST /api/v1/join/{token}``.

The visitor-facing counterpart to #1020's facilitator page — reachable by anyone holding the
token, not just the instance's admin. Builds on #1019's write path (``add_allowed_username``) the
same way ``test_facilitator_router.py`` builds on ``get_or_create_join_token``/``set_join_open``.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import create_app
from energetica.database.user import User
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
        "allowed_usernames": ["alice"],
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


def _allowed_usernames(path: Path) -> list[str]:
    return json.loads(path.read_text())["access"]["allowed_usernames"]


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


def test_get_reports_the_viewer_username_for_a_signed_in_visitor_with_no_local_user(instance_json: Path) -> None:
    """The crux of #1021: a visitor with a valid SSO session but no User row yet (not
    access-allowed, so the entry gate has never provisioned one) must still be identified here.
    """
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)
    assert next(User.filter_by(account_id=account_id), None) is None

    response = client.get(_join_url(TOKEN))

    assert response.status_code == 200
    assert response.json()["viewer_username"] == "carol"
    # Merely resolving the link must not itself grant or provision anything.
    assert next(User.filter_by(account_id=account_id), None) is None
    assert "carol" not in _allowed_usernames(instance_json)


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
    assert "carol" not in _allowed_usernames(instance_json)


def test_post_rejects_when_join_is_closed_and_does_not_modify_the_allowlist(instance_json: Path) -> None:
    closed = {**PRIVATE_JSON, "access": {**PRIVATE_JSON["access"], "join_open": False}}
    _write(instance_json, closed)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    response = client.post(_join_url(TOKEN))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_CLOSED"
    assert "carol" not in _allowed_usernames(instance_json)


def test_post_adds_the_visitor_to_the_allowlist_and_the_entry_gate_then_admits_them(instance_json: Path) -> None:
    """The full acceptance scenario: confirm, then the existing entry gate (unmodified) admits
    the visitor as a normal player and provisions their local User.
    """
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    # Blocked before confirming, exactly like any other not-yet-allowed account.
    assert client.get(f"http://localhost:{PORT}/api/v1/auth/me").status_code == 403

    response = client.post(_join_url(TOKEN))
    assert response.status_code == 204
    assert "carol" in _allowed_usernames(instance_json)

    me = client.get(f"http://localhost:{PORT}/api/v1/auth/me")
    assert me.status_code == 200
    body = me.json()
    assert body["username"] == "carol"
    assert body["role"] == "player"
    assert next(User.filter_by(account_id=account_id), None) is not None


def test_post_is_idempotent_for_an_already_allowed_username(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)  # "alice" is already allowlisted
    client = _client()
    account_id = make_account("alice", "pw")
    authenticate(client, account_id)

    response = client.post(_join_url(TOKEN))

    assert response.status_code == 204
    assert _allowed_usernames(instance_json).count("alice") == 1


def test_post_rejects_a_token_on_a_public_instance(instance_json: Path) -> None:
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("carol", "pw")
    authenticate(client, account_id)

    response = client.post(_join_url(TOKEN))

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "JOIN_LINK_INVALID"
