"""
Integration tests for the lobby service's internal API (``/internal/v1``, ADR-0009).

Each test talks to the real service app in-process, over a fresh ``lobby.db`` migrated to the
latest schema, the way the service is at start-up.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.identity.lobby_service_client import LobbyServiceClient, LobbyServiceRefusal
from energetica.identity.schemas.lobby_service import LobbyServiceErrorCode, RunCreate, RunUpdate
from lobby_service import store
from lobby_service.app import create_service_app
from lobby_service.schema import SCHEMA_VERSION, upgrade_database
from lobby_service.session import decode_session_token, mint_session_token

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


def test_the_tokens_keep_the_cookie_format(service: TestClient) -> None:
    """Session cookies last 60 days, so tokens minted before a deploy must keep working after it."""
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


@pytest.mark.parametrize("username", ["alice?team", "alice#1", "a/b", "50%", "al ice"])
def test_a_username_lookup_finds_exactly_that_username(service: TestClient, username: str) -> None:
    """Signup accepts any characters, and a lookup must not read part of the name as URL syntax."""
    _create_account(service, "alice")
    target = _create_account(service, username)
    client = LobbyServiceClient(service)

    account = client.get_account_by_username(username)

    assert account is not None
    assert account.account_id == target["account_id"]


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


# --- temporary accounts (#1383) ----------------------------------------------------------------


def _create_temporary_account(service: TestClient, username: str, expires_at: str) -> dict:
    resp = service.post(
        "/accounts", json={"username": username, "password": "correct-password", "expires_at": expires_at}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_a_temporary_account_reports_its_expiry_in_utc(service: TestClient) -> None:
    temporary = _create_temporary_account(service, "table1-a", "2026-11-03T18:30:00.5+01:00")
    permanent = _create_account(service)

    account = service.get(f"/accounts/{temporary['account_id']}").json()
    session = service.get("/session", headers=_bearer(temporary["token"])).json()

    assert account["expires_at"] == "2026-11-03T17:30:00+00:00"
    assert session["expires_at"] == "2026-11-03T17:30:00+00:00"
    assert service.get(f"/accounts/{permanent['account_id']}").json()["expires_at"] is None


def test_an_expiry_with_no_time_zone_is_refused(service: TestClient) -> None:
    resp = service.post(
        "/accounts", json={"username": "table1-a", "password": "correct-password", "expires_at": "2026-11-03T18:30:00"}
    )
    assert resp.status_code == 422


def test_deleting_expired_accounts_keeps_permanent_and_unexpired_ones(service: TestClient) -> None:
    expired = _create_temporary_account(service, "table1-a", "2026-10-01T00:00:00+00:00")
    unexpired = _create_temporary_account(service, "table1-b", "2026-12-01T00:00:00+00:00")
    permanent = _create_account(service)
    for account in (expired, unexpired, permanent):
        service.put(f"/runs/spring/members/{account['account_id']}")
    service.put(f"/facilitator-grants/{expired['account_id']}", json={"slug": "autumn"})

    deleted = store.delete_expired_accounts(now=datetime(2026, 11, 1, tzinfo=timezone.utc))

    assert [account.username for account in deleted] == ["table1-a"]
    assert service.get(f"/accounts/{expired['account_id']}").status_code == 404
    assert service.get("/session", headers=_bearer(expired["token"])).status_code == 401
    assert [m["username"] for m in service.get("/runs/spring/members").json()] == ["alice", "table1-b"]
    with sqlite3.connect(store.db_path()) as conn:
        rows = conn.execute("SELECT * FROM instance_membership WHERE account_id = ?", (expired["account_id"],))
        assert rows.fetchall() == []


def test_an_account_expires_at_its_expiry_time(service: TestClient) -> None:
    _create_temporary_account(service, "table1-a", "2026-11-01T00:00:00+00:00")

    assert store.delete_expired_accounts(now=datetime(2026, 10, 31, 23, 59, 59, tzinfo=timezone.utc)) == []
    assert len(store.delete_expired_accounts(now=datetime(2026, 11, 1, tzinfo=timezone.utc))) == 1


def test_a_deleted_accounts_username_is_free_for_a_new_account(service: TestClient) -> None:
    expired = _create_temporary_account(service, "table1-a", "2026-10-01T00:00:00+00:00")
    store.delete_expired_accounts(now=datetime(2026, 11, 1, tzinfo=timezone.utc))

    reused = _create_temporary_account(service, "table1-a", "2026-12-01T00:00:00+00:00")

    assert reused["account_id"] > expired["account_id"]


def test_the_service_deletes_expired_accounts_when_it_starts(service: TestClient) -> None:
    expired = _create_temporary_account(service, "table1-a", "2000-01-01T00:00:00+00:00")

    with TestClient(create_service_app(), base_url=BASE) as started:
        assert started.get(f"/accounts/{expired['account_id']}").status_code == 404


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


def test_joining_or_removing_an_unknown_account_is_404(service: TestClient) -> None:
    assert service.put("/runs/spring/members/999").status_code == 404
    assert service.delete("/runs/spring/members/999").status_code == 404


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


# --- runs ---------------------------------------------------------------------------------------


def _run_body(**overrides: object) -> dict:
    return {
        "name": "Spring",
        "mode": "freeplay",
        "advertised": True,
        "access_policy": "public",
        "starts_at": "2026-03-01T12:00:00Z",
        **overrides,
    }


def _create_run(service: TestClient, slug: str = "spring", **overrides: object) -> dict:
    resp = service.put(f"/runs/{slug}", json=_run_body(**overrides))
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_a_created_run_reads_back_with_its_phase(service: TestClient) -> None:
    created = _create_run(service, freeze_at="2026-06-01T14:00:00+02:00", ended_at="2099-01-01T00:00:00Z")

    run = service.get("/runs/spring").json()

    assert run == created
    assert run["name"] == "Spring"
    assert (run["access_policy"], run["join_token"], run["join_open"]) == ("public", None, False)
    assert run["phase"] == "freeze"
    assert service.get("/runs").json() == [run]


def test_timestamps_are_stored_in_utc_to_the_second(service: TestClient, tmp_path: Path) -> None:
    _create_run(service, starts_at="2026-03-01T13:00:00.75+01:00")

    with sqlite3.connect(tmp_path / "lobby.db") as conn:
        stored = conn.execute("SELECT starts_at FROM runs").fetchone()[0]

    assert stored == "2026-03-01T12:00:00+00:00"


def test_runs_are_listed_latest_start_first(service: TestClient) -> None:
    _create_run(service, "old", starts_at="2025-01-01T00:00:00Z")
    _create_run(service, "new", starts_at="2026-01-01T00:00:00Z")

    assert [run["slug"] for run in service.get("/runs").json()] == ["new", "old"]


def test_an_unknown_run_is_404(service: TestClient) -> None:
    for resp in (
        service.get("/runs/ghost"),
        service.patch("/runs/ghost", json={"name": "Ghost"}),
        service.post("/runs/ghost/join-token"),
        service.delete("/runs/ghost"),
    ):
        assert (resp.status_code, resp.json()["detail"]) == (404, "RUN_NOT_FOUND")


def test_a_taken_slug_conflicts(service: TestClient) -> None:
    _create_run(service)
    resp = service.put("/runs/spring", json=_run_body(name="Other"))
    assert (resp.status_code, resp.json()["detail"]) == (409, "RUN_EXISTS")
    assert service.get("/runs/spring").json()["name"] == "Spring"


@pytest.mark.parametrize(
    ("slug", "overrides", "message"),
    [
        ("spring", {"freeze_at": "2026-02-01T00:00:00Z"}, "freeze_at"),
        ("spring", {"freeze_at": "2026-04-01T00:00:00Z", "ended_at": "2026-03-15T00:00:00Z"}, "ended_at"),
        ("spring", {"ended_at": "2026-02-01T00:00:00Z"}, "ended_at"),
        ("spring", {"join_open": True}, "private"),
        ("spring", {"join_token": "abc"}, "private"),
        ("spring", {"name": "  "}, "name"),
        ("Spring", {}, "slug"),
        ("-spring", {}, "slug"),
        ("landing", {}, "reserved"),
    ],
)
def test_an_invalid_run_is_refused_with_a_message(
    service: TestClient, slug: str, overrides: dict, message: str
) -> None:
    resp = service.put(f"/runs/{slug}", json=_run_body(**overrides))

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")
    assert message in resp.json()["message"]
    assert service.get("/runs").json() == []


def test_a_naive_timestamp_is_refused_with_a_message(service: TestClient) -> None:
    resp = service.put("/runs/spring", json=_run_body(starts_at="2026-03-01T12:00:00"))

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")
    assert "starts_at" in resp.json()["message"]


def test_other_endpoints_keep_the_default_validation_error(service: TestClient) -> None:
    resp = service.post("/accounts", json={"username": "alice"})

    assert resp.status_code == 422
    assert isinstance(resp.json()["detail"], list)


@pytest.mark.parametrize("field", ["name", "advertised", "access_policy", "join_open", "starts_at"])
def test_a_field_that_always_has_a_value_cannot_be_cleared(service: TestClient, field: str) -> None:
    _create_run(service)

    resp = service.patch("/runs/spring", json={field: None})

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")
    assert field in resp.json()["message"]


def test_patch_changes_only_the_fields_it_names(service: TestClient) -> None:
    _create_run(service, freeze_at="2026-06-01T00:00:00Z")

    resp = service.patch("/runs/spring", json={"name": "Spring 2026", "advertised": False})

    assert resp.status_code == 200
    run = resp.json()
    assert (run["name"], run["advertised"]) == ("Spring 2026", False)
    assert run["freeze_at"] == "2026-06-01T00:00:00Z"


def test_patch_clears_a_field_sent_as_null(service: TestClient) -> None:
    _create_run(service, freeze_at="2026-06-01T00:00:00Z")

    run = service.patch("/runs/spring", json={"freeze_at": None}).json()

    assert run["freeze_at"] is None


def test_patch_checks_the_run_as_a_whole(service: TestClient) -> None:
    _create_run(service, freeze_at="2026-06-01T00:00:00Z")

    resp = service.patch("/runs/spring", json={"starts_at": "2026-07-01T00:00:00Z"})

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")
    assert service.get("/runs/spring").json()["starts_at"] == "2026-03-01T12:00:00Z"


@pytest.mark.parametrize("field", [{"mode": "workshop"}, {"slug": "summer"}])
def test_slug_and_mode_cannot_change(service: TestClient, field: dict) -> None:
    _create_run(service)

    resp = service.patch("/runs/spring", json=field)

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")
    assert next(iter(field)) in resp.json()["message"]
    assert service.get("/runs/spring").json()["mode"] == "freeplay"


def test_a_private_run_gets_one_join_token(service: TestClient) -> None:
    _create_run(service, access_policy="private")

    first = service.post("/runs/spring/join-token")
    second = service.post("/runs/spring/join-token")

    assert first.status_code == 200
    token = first.json()["join_token"]
    assert len(token) >= 32
    assert second.json()["join_token"] == token
    assert service.get("/runs/spring").json()["join_token"] == token
    assert service.patch("/runs/spring", json={"join_open": True}).json()["join_open"] is True


def test_a_public_run_has_no_join_token(service: TestClient) -> None:
    _create_run(service)

    resp = service.post("/runs/spring/join-token")

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")


def test_making_a_run_public_needs_its_join_link_cleared(service: TestClient) -> None:
    _create_run(service, access_policy="private", join_token="the-token", join_open=True)

    refused = service.patch("/runs/spring", json={"access_policy": "public"})
    allowed = service.patch("/runs/spring", json={"access_policy": "public", "join_token": None, "join_open": False})

    assert (refused.status_code, refused.json()["detail"]) == (422, "INVALID_RUN")
    assert allowed.status_code == 200


def test_two_runs_cannot_share_a_join_token(service: TestClient) -> None:
    _create_run(service, "spring", access_policy="private", join_token="the-token")
    _create_run(service, "summer", access_policy="private")

    resp = service.patch("/runs/summer", json={"join_token": "the-token"})

    assert (resp.status_code, resp.json()["detail"]) == (422, "INVALID_RUN")
    assert service.get("/runs/spring").json()["join_token"] == "the-token"


def test_deleting_a_run(service: TestClient) -> None:
    _create_run(service)

    assert service.delete("/runs/spring").status_code == 204
    assert service.get("/runs/spring").status_code == 404


def test_deleting_a_run_with_members_needs_asking(service: TestClient) -> None:
    _create_run(service)
    player = _create_account(service, "player")["account_id"]
    facilitator = _create_account(service, "facilitator")["account_id"]
    service.put(f"/runs/spring/members/{player}")
    service.put(f"/facilitator-grants/{facilitator}", json={"slug": "spring"})

    refused = service.delete("/runs/spring")
    deleted = service.delete("/runs/spring", params={"with_members": True})

    assert (refused.status_code, refused.json()["detail"]) == (409, "RUN_HAS_MEMBERS")
    assert "2 membership" in refused.json()["message"]
    assert deleted.status_code == 204
    assert service.get("/runs/spring/members").json() == []
    assert service.get(f"/accounts/{facilitator}/memberships").json()["facilitated_runs"] == []


def test_each_run_write_logs_one_line_without_the_join_token(
    service: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    headers = {"X-Energetica-Caller": "run-py@abc", "X-Energetica-Acting-Account": "7"}
    caplog.set_level(logging.INFO, logger="lobby_service.runs")

    service.put("/runs/spring", json=_run_body(access_policy="private"), headers=headers)
    service.patch("/runs/spring", json={"name": "Spring 2026", "join_open": True}, headers=headers)
    service.patch("/runs/spring", json={"name": "Spring 2026"}, headers=headers)  # changes nothing
    token = service.post("/runs/spring/join-token", headers=headers).json()["join_token"]
    service.post("/runs/spring/join-token", headers=headers)  # changes nothing
    service.delete("/runs/spring", headers=headers)

    lines = [record.getMessage() for record in caplog.records if record.name == "lobby_service.runs"]
    assert [line.split(" ", 2)[1] for line in lines] == ["create", "update", "update", "delete"]
    entries = [json.loads(line.split(" ", 2)[2]) for line in lines]
    assert all((e["slug"], e["caller"], e["acting_account"]) == ("spring", "run-py@abc", "7") for e in entries)
    assert entries[0]["changes"]["starts_at"] == [None, "2026-03-01T12:00:00+00:00"]
    assert entries[1]["changes"] == {"name": ["Spring", "Spring 2026"], "join_open": [False, True]}
    assert entries[2]["changes"] == {"join_token": [None, "(redacted)"]}
    assert all(token not in line for line in lines)


def test_the_client_reads_and_writes_runs(service: TestClient) -> None:
    client = LobbyServiceClient(service)

    created = client.create_run("spring", RunCreate.model_validate(_run_body(access_policy="private")))
    updated = client.update_run("spring", RunUpdate(join_open=True), acting_account_id=7)
    token = client.get_or_create_join_token("spring")

    assert created.slug == "spring"
    assert updated.join_open is True
    assert client.get_run("spring") == updated.model_copy(update={"join_token": token})
    assert client.get_run("ghost") is None
    assert [run.slug for run in client.list_runs()] == ["spring"]
    with pytest.raises(LobbyServiceRefusal) as refusal:
        client.update_run("spring", RunUpdate(freeze_at=datetime(2020, 1, 1, tzinfo=timezone.utc)))
    assert refusal.value.code == LobbyServiceErrorCode.INVALID_RUN
    assert refusal.value.message is not None and "freeze_at" in refusal.value.message
    client.delete_run("spring")
    assert client.list_runs() == []


# --- health -------------------------------------------------------------------------------------


def test_healthz_reports_the_schema_version_and_api_versions(service: TestClient) -> None:
    assert service.get("/healthz").json() == {"status": "ok", "schema_version": SCHEMA_VERSION, "api_versions": ["v1"]}
