"""Integration tests for the facilitator join-link/toggle routes (#1020).

Builds on #1019's plumbing (``get_facilitator``, ``instance_config``'s private-access write path
for the join link/toggle) — these tests exercise it through a real HTTP request against
``/api/v1/facilitator/access``, the way the facilitator page (#1020) will call it. The roster
itself (#1022) lives in ``accounts.db``'s ``instance_membership`` (#1030 follow-up, ADR-0006), not
``instance.json`` — see ``_join`` below.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.globals import engine

from ._session_helpers import authenticate, make_account

PORT = 8000
ACCESS_URL = f"http://localhost:{PORT}/api/v1/facilitator/access"
SLUG = "autumn-2025"

PRIVATE_JSON = {
    "name": "ETHZ Spring 2026",
    "advertised": False,
    "starts_at": "2026-03-01T00:00:00Z",
    "access": {"policy": "private"},
}
PUBLIC_JSON = {
    "name": "Autumn 2025",
    "advertised": True,
    "starts_at": "2025-09-15T00:00:00Z",
    "access": {"policy": "public"},
}


def _join(account_id: int) -> None:
    """Record account_id as having joined this test's instance (accounts.db) — the equivalent of
    the pre-#1030 fixture that allowlisted "alice" directly in instance.json.
    """
    accounts.record_join(account_id=account_id, slug=SLUG, joined_at=datetime.now(timezone.utc).isoformat())


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


def _facilitator_client(instance_json: Path) -> TestClient:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
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
    authenticate(client, account_id)

    assert client.get(ACCESS_URL).status_code == 403


def test_get_generates_and_persists_the_join_token(instance_json: Path) -> None:
    client = _facilitator_client(instance_json)

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
    client = _facilitator_client(instance_json)
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
    authenticate(client, account_id)

    assert client.patch(ACCESS_URL, json={"join_open": True}).status_code == 403


def test_get_on_a_public_instance_fails_with_a_game_error(instance_json: Path) -> None:
    """A facilitator route only makes sense on a privately-configured instance."""
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
    authenticate(client, account_id)

    response = client.get(ACCESS_URL)
    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "INSTANCE_NOT_PRIVATE"


# --- Roster: view, manual add, ban (#1022) -------------------------------------------------------

ROSTER_URL = f"http://localhost:{PORT}/api/v1/facilitator/roster"


def _candidates_url(prefix: str) -> str:
    return f"{ROSTER_URL}/candidates?prefix={prefix}"


def test_roster_rejects_a_non_admin(instance_json: Path) -> None:
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    account_id = make_account("alice", "pw")
    authenticate(client, account_id)

    assert client.get(ROSTER_URL).status_code == 403
    assert client.get(_candidates_url("a")).status_code == 403
    assert client.post(ROSTER_URL, json={"username": "alice"}).status_code == 403
    assert client.delete(f"{ROSTER_URL}/alice").status_code == 403


def test_roster_splits_joined_and_invited(instance_json: Path) -> None:
    """ "alice" has settled (joined, settled_at set); "bob" is on the roster via the add endpoint
    but has never settled (invited, settled_at null).
    """
    from energetica.accounts import Account
    from energetica.database.map.hex_tile import HexTile
    from energetica.utils.map_helpers import confirm_location

    client = _facilitator_client(instance_json)
    alice_id = make_account("alice", "pw")
    confirm_location(
        Account(account_id=alice_id, username="alice", pwhash="unused", email=None, created_at=""), HexTile.getitem(1)
    )  # settling with no prior join step still records an already-settled membership row
    make_account("bob", "pw")  # server-wide account exists, but has never settled
    assert client.post(ROSTER_URL, json={"username": "bob"}).status_code == 204

    response = client.get(ROSTER_URL)

    assert response.status_code == 200
    assert response.json() == {"joined": ["alice"], "invited": ["bob"]}


def test_roster_get_on_a_public_instance_fails_with_a_game_error(instance_json: Path) -> None:
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
    authenticate(client, account_id)

    response = client.get(ROSTER_URL)

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "INSTANCE_NOT_PRIVATE"


def test_roster_candidates_returns_matching_accounts(instance_json: Path) -> None:
    client = _facilitator_client(instance_json)
    make_account("carol", "pw")
    make_account("caroline", "pw")
    make_account("dave", "pw")

    response = client.get(_candidates_url("car"))

    assert response.status_code == 200
    # Alphabetical: "carol" sorts before "caroline" (it's a prefix of it).
    assert response.json() == {"usernames": ["carol", "caroline"]}


def test_roster_candidates_does_not_require_a_private_instance(instance_json: Path) -> None:
    """Searching the server-wide account store doesn't touch this instance's allowlist, so it
    works even before/without a private config — unlike every other roster route.
    """
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
    authenticate(client, account_id)
    make_account("carol", "pw")

    response = client.get(_candidates_url("car"))

    assert response.status_code == 200
    assert response.json() == {"usernames": ["carol"]}


def test_roster_post_adds_an_existing_account_and_it_appears_as_invited(instance_json: Path) -> None:
    client = _facilitator_client(instance_json)
    alice_id = make_account("alice", "pw")
    _join(alice_id)  # already on the roster, unsettled
    carol_id = make_account("carol", "pw")

    response = client.post(ROSTER_URL, json={"username": "carol"})

    assert response.status_code == 204
    assert accounts.has_joined(account_id=carol_id, slug=SLUG) is True
    assert client.get(ROSTER_URL).json()["invited"] == ["carol", "alice"]


def test_roster_post_rejects_a_username_with_no_matching_account(instance_json: Path) -> None:
    """No freeform username strings — only an existing account can be added."""
    client = _facilitator_client(instance_json)

    response = client.post(ROSTER_URL, json={"username": "ghost"})

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "USER_NOT_FOUND"
    assert [entry.username for entry in accounts.get_run_roster(slug=SLUG)] == []


def test_roster_post_on_a_public_instance_fails_with_a_game_error(instance_json: Path) -> None:
    _write(instance_json, PUBLIC_JSON)
    client = _client()
    account_id = make_account("prof", "pw")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
    authenticate(client, account_id)
    make_account("carol", "pw")

    response = client.post(ROSTER_URL, json={"username": "carol"})

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "INSTANCE_NOT_PRIVATE"


def test_roster_delete_removes_from_the_allowlist(instance_json: Path) -> None:
    client = _facilitator_client(instance_json)
    alice_id = make_account("alice", "pw")
    _join(alice_id)

    response = client.delete(f"{ROSTER_URL}/alice")

    assert response.status_code == 204
    assert accounts.has_joined(account_id=alice_id, slug=SLUG) is False


def test_roster_delete_denies_the_banned_account_on_its_next_entry_attempt(instance_json: Path) -> None:
    """One shared client, swapping which account's cookie is set — a second ``_client()`` would
    spin up a second engine and lose the first's state (see the module docstring's single-app
    convention followed throughout this file and ``test_join_router.py``).
    """
    _write(instance_json, PRIVATE_JSON)
    client = _client()
    admin_id = make_account("prof", "pw")
    accounts.grant_facilitator(account_id=admin_id, slug=SLUG)
    carol_id = make_account("carol", "pw")

    authenticate(client, admin_id)
    assert client.post(ROSTER_URL, json={"username": "carol"}).status_code == 204

    authenticate(client, carol_id)
    assert client.get(f"http://localhost:{PORT}/api/v1/auth/me").status_code == 200

    authenticate(client, admin_id)
    response = client.delete(f"{ROSTER_URL}/carol")
    assert response.status_code == 204

    authenticate(client, carol_id)
    assert client.get(f"http://localhost:{PORT}/api/v1/auth/me").status_code == 403


def test_roster_delete_is_a_noop_for_an_unlisted_username(instance_json: Path) -> None:
    client = _facilitator_client(instance_json)

    response = client.delete(f"{ROSTER_URL}/never-invited")

    assert response.status_code == 204
