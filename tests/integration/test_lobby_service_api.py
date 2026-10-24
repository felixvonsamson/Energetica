"""Integration tests for the lobby service's internal API (``/internal/v1``, ADR-0009).

Each test talks to the real service app in-process, over a fresh ``lobby.db`` migrated to the
latest schema, the way the service is at start-up.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.kernel.session import decode_session_token, mint_session_token
from lobby_service.app import create_service_app
from lobby_service.schema import SCHEMA_VERSION, upgrade_database

BASE = "http://lobby-service/internal/v1"


@pytest.fixture
def service(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "lobby.db"
    monkeypatch.setenv("ENERGETICA_LOBBY_DB_PATH", str(db_path))
    upgrade_database(db_path)
    return TestClient(create_service_app(), base_url=BASE)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_account(service: TestClient, username: str = "alice", password: str = "correct-password") -> dict:
    resp = service.post("/accounts", json={"username": username, "password": password})
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- accounts and sessions ---------------------------------------------------------------------


def test_a_new_account_comes_with_a_session(service: TestClient) -> None:
    created = _create_account(service)

    resp = service.get("/session", headers=_bearer(created["token"]))

    assert resp.status_code == 200
    body = resp.json()
    assert body["account_id"] == created["account_id"]
    assert body["username"] == "alice"
    assert body["role"] == "player"
    assert body["joined"] is None


def test_the_tokens_are_the_ones_runs_on_old_code_accept(service: TestClient) -> None:
    """During the switch-over, runs on old code check cookies themselves, so the format must not change."""
    created = _create_account(service)
    assert decode_session_token(created["token"]) == str(created["account_id"])

    resp = service.get("/session", headers=_bearer(mint_session_token(created["account_id"])))
    assert resp.status_code == 200


def test_a_taken_username_conflicts(service: TestClient) -> None:
    _create_account(service)
    resp = service.post("/accounts", json={"username": "alice", "password": "another-password"})
    assert resp.status_code == 409
    assert resp.json()["detail"] == "USERNAME_TAKEN"


def test_a_short_password_is_refused(service: TestClient) -> None:
    resp = service.post("/accounts", json={"username": "alice", "password": "short"})
    assert resp.status_code == 422
    assert resp.json()["detail"] == "PASSWORD_TOO_SHORT"


def test_login_mints_a_session(service: TestClient) -> None:
    created = _create_account(service)

    resp = service.post("/sessions", json={"username": "alice", "password": "correct-password"})

    assert resp.status_code == 201
    session = service.get("/session", headers=_bearer(resp.json()["token"]))
    assert session.json()["account_id"] == created["account_id"]


@pytest.mark.parametrize(
    ("username", "password", "detail"),
    [("ghost", "correct-password", "USER_NOT_FOUND"), ("alice", "wrong-password", "INVALID_PASSWORD")],
)
def test_login_with_bad_credentials_is_refused(service: TestClient, username: str, password: str, detail: str) -> None:
    _create_account(service)
    resp = service.post("/sessions", json={"username": username, "password": password})
    assert resp.status_code == 401
    assert resp.json()["detail"] == detail


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer not-a-token"}, {"Authorization": "Basic x"}])
def test_a_missing_or_bad_token_resolves_to_401(service: TestClient, headers: dict[str, str]) -> None:
    assert service.get("/session", headers=headers).status_code == 401


def test_a_token_for_an_account_that_does_not_exist_resolves_to_401(service: TestClient) -> None:
    assert service.get("/session", headers=_bearer(mint_session_token(999))).status_code == 401


def test_accounts_can_be_looked_up_by_id_username_and_prefix(service: TestClient) -> None:
    alice = _create_account(service, "alice")
    _create_account(service, "alfred")
    _create_account(service, "Alba")
    _create_account(service, "bob")

    by_id = service.get(f"/accounts/{alice['account_id']}").json()
    by_username = service.get("/accounts/by-username/alice").json()
    by_prefix = service.get("/accounts", params={"prefix": "al"}).json()

    assert by_id == by_username
    assert by_id["username"] == "alice"
    assert "pwhash" not in by_id
    assert [account["username"] for account in by_prefix] == ["alfred", "alice"]
    assert service.get("/accounts", params={"prefix": "al", "limit": 1}).json()[0]["username"] == "alfred"


def test_unknown_accounts_are_404(service: TestClient) -> None:
    assert service.get("/accounts/999").status_code == 404
    assert service.get("/accounts/by-username/ghost").status_code == 404


def test_changing_the_password(service: TestClient) -> None:
    account_id = _create_account(service)["account_id"]

    wrong_old = service.put(
        f"/accounts/{account_id}/password", json={"old_password": "nope", "new_password": "brand-new-password"}
    )
    too_short = service.put(
        f"/accounts/{account_id}/password", json={"old_password": "correct-password", "new_password": "short"}
    )
    changed = service.put(
        f"/accounts/{account_id}/password",
        json={"old_password": "correct-password", "new_password": "brand-new-password"},
    )

    assert (wrong_old.status_code, wrong_old.json()["detail"]) == (403, "OLD_PASSWORD_INCORRECT")
    assert (too_short.status_code, too_short.json()["detail"]) == (422, "PASSWORD_TOO_SHORT")
    assert changed.status_code == 204
    assert service.post("/sessions", json={"username": "alice", "password": "correct-password"}).status_code == 401
    assert service.post("/sessions", json={"username": "alice", "password": "brand-new-password"}).status_code == 201


# --- run members and facilitator grants --------------------------------------------------------


def test_joining_a_run_shows_in_the_session_members_and_memberships(service: TestClient) -> None:
    created = _create_account(service)
    account_id = created["account_id"]

    assert service.put(f"/runs/spring/members/{account_id}").status_code == 204
    assert service.put(f"/runs/spring/members/{account_id}").status_code == 204  # idempotent

    session = service.get("/session", params={"run": "spring"}, headers=_bearer(created["token"])).json()
    other_run = service.get("/session", params={"run": "autumn"}, headers=_bearer(created["token"])).json()
    members = service.get("/runs/spring/members").json()
    memberships = service.get(f"/accounts/{account_id}/memberships").json()

    assert (session["role"], session["joined"]) == ("player", True)
    assert other_run["joined"] is False
    assert [(m["account_id"], m["username"]) for m in members] == [(account_id, "alice")]
    assert [run["slug"] for run in memberships["runs"]] == ["spring"]
    assert memberships["facilitated_runs"] == []


def test_removing_a_member(service: TestClient) -> None:
    account_id = _create_account(service)["account_id"]
    service.put(f"/runs/spring/members/{account_id}")

    assert service.delete(f"/runs/spring/members/{account_id}").status_code == 204
    assert service.delete(f"/runs/spring/members/{account_id}").status_code == 204  # idempotent
    assert service.get("/runs/spring/members").json() == []


def test_joining_an_unknown_account_is_404(service: TestClient) -> None:
    assert service.put("/runs/spring/members/999").status_code == 404


def test_a_run_scoped_grant(service: TestClient) -> None:
    created = _create_account(service)
    account_id = created["account_id"]

    assert service.put(f"/facilitator-grants/{account_id}", json={"slug": "spring"}).status_code == 204
    assert service.put(f"/facilitator-grants/{account_id}", json={"slug": "spring"}).status_code == 204  # idempotent

    in_run = service.get("/session", params={"run": "spring"}, headers=_bearer(created["token"])).json()
    server_wide = service.get("/session", headers=_bearer(created["token"])).json()
    memberships = service.get(f"/accounts/{account_id}/memberships").json()
    assert in_run["role"] == "facilitator"
    assert in_run["joined"] is False
    assert server_wide["role"] == "player"
    assert [run["slug"] for run in memberships["facilitated_runs"]] == ["spring"]


def test_a_server_wide_grant_covers_every_run(service: TestClient) -> None:
    created = _create_account(service)

    assert service.put(f"/facilitator-grants/{created['account_id']}", json={}).status_code == 204

    for params in ({}, {"run": "anything"}):
        session = service.get("/session", params=params, headers=_bearer(created["token"])).json()
        assert session["role"] == "facilitator"
    # Not tied to a run, so it is not listed as one.
    assert service.get(f"/accounts/{created['account_id']}/memberships").json()["facilitated_runs"] == []


def test_player_and_facilitator_roles_conflict(service: TestClient) -> None:
    player = _create_account(service, "player")["account_id"]
    facilitator = _create_account(service, "facilitator")["account_id"]
    service.put(f"/runs/spring/members/{player}")
    service.put(f"/facilitator-grants/{facilitator}", json={})

    grant = service.put(f"/facilitator-grants/{player}", json={"slug": "spring"})
    join = service.put(f"/runs/spring/members/{facilitator}")

    assert (grant.status_code, grant.json()["detail"]) == (409, "ROLE_CONFLICT")
    assert (join.status_code, join.json()["detail"]) == (409, "ROLE_CONFLICT")


def test_granting_an_unknown_account_is_404(service: TestClient) -> None:
    assert service.put("/facilitator-grants/999", json={}).status_code == 404


# --- health -------------------------------------------------------------------------------------


def test_healthz_reports_the_schema_version_and_api_versions(service: TestClient) -> None:
    assert service.get("/healthz").json() == {"status": "ok", "schema_version": SCHEMA_VERSION, "api_versions": ["v1"]}
