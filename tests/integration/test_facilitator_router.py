"""Integration tests for the facilitator join-link/toggle routes (#1020).

Builds on #1019's plumbing (``get_admin_user``, ``instance_config``'s private-access write path) —
these tests exercise it through a real HTTP request against ``/api/v1/facilitator/access``, the way
the facilitator page (#1020) will call it.
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
ACCESS_URL = f"http://localhost:{PORT}/api/v1/facilitator/access"
SLUG = "autumn-2025"

PRIVATE_JSON = {
    "name": "ETHZ Spring 2026",
    "advertised": False,
    "starts_at": "2026-03-01T00:00:00Z",
    "access": {"policy": "private", "allowed_usernames": ["alice"]},
}
PUBLIC_JSON = {
    "name": "Autumn 2025",
    "advertised": True,
    "starts_at": "2025-09-15T00:00:00Z",
    "access": {"policy": "public"},
}


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
    # The request-logging middleware 503s any non-GET request whose X-Forwarded-For isn't
    # 127.0.0.1 when `serve_local` is set; TestClient requests don't carry that header, so the
    # PATCH calls below need it off (mirrors ``test_admin_dependency_route.py``).
    engine.serve_local = False
    return TestClient(app)


def _admin_client(instance_json: Path) -> TestClient:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    User(username="prof", pwhash="unused", role="admin", account_id=account_id)
    authenticate(client, account_id)
    return client


def test_rejects_unauthenticated(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()

    assert client.get(ACCESS_URL).status_code == 403


def test_rejects_a_player_account(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("alice", "pw")
    User(username="alice", pwhash="unused", role="player", account_id=account_id)
    authenticate(client, account_id)

    assert client.get(ACCESS_URL).status_code == 403


def test_get_generates_and_persists_the_join_token(instance_json: Path) -> None:
    client = _admin_client(instance_json)

    first = client.get(ACCESS_URL)
    assert first.status_code == 200
    body = first.json()
    assert body["join_token"]
    assert body["join_open"] is False

    second = client.get(ACCESS_URL)
    assert second.json()["join_token"] == body["join_token"]

    on_disk = json.loads(instance_json.read_text())
    assert on_disk["access"]["join_token"] == body["join_token"]


def test_patch_flips_join_open_and_persists(instance_json: Path) -> None:
    client = _admin_client(instance_json)
    client.get(ACCESS_URL)  # generate the token first, as the page does on mount

    response = client.patch(ACCESS_URL, json={"join_open": True})
    assert response.status_code == 204

    on_disk = json.loads(instance_json.read_text())
    assert on_disk["access"]["join_open"] is True

    reread = client.get(ACCESS_URL)
    assert reread.json()["join_open"] is True


def test_patch_rejects_a_non_admin(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("alice", "pw")
    User(username="alice", pwhash="unused", role="player", account_id=account_id)
    authenticate(client, account_id)

    assert client.patch(ACCESS_URL, json={"join_open": True}).status_code == 403


def test_get_on_a_public_instance_fails_with_a_game_error(instance_json: Path) -> None:
    """A facilitator route only makes sense on a privately-configured instance."""
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    User(username="prof", pwhash="unused", role="admin", account_id=account_id)
    authenticate(client, account_id)

    response = client.get(ACCESS_URL)
    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "INSTANCE_NOT_PRIVATE"
