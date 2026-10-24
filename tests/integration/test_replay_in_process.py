"""Replay calls the app in-process, as the logged account, without session cookies (#1342).

Replay is the run talking to itself, so it does not pass the entry gate again. It needs neither the
signing secret nor the account's current membership, which may have changed since the request was
logged.
"""

from __future__ import annotations

import json
from functools import partial
from datetime import datetime
from pathlib import Path
from typing import Annotated

import httpx
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from energetica.freeplay.app import create_app
from energetica.freeplay.globals import engine
from energetica.freeplay.schemas.simulate import Action, ApiAction, ApiActionRequest, ApiActionResponse
from energetica.identity.accounts import Account
from energetica.identity.web import resolve_entry_account
from energetica.kernel import session
from energetica import simulate as simulate_module
from energetica.simulate import simulate

from ._session_helpers import authenticate, make_account

PROBE_PATH = "/probe/whoami"
SLUG = "test-instance"


@pytest.fixture
def private_instance(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """A private instance that no account has joined."""
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(tmp_path / "etc"))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    config = tmp_path / "etc" / SLUG / "instance.json"
    config.parent.mkdir(parents=True)
    config.write_text(
        json.dumps(
            {
                "name": "Test",
                "advertised": True,
                "starts_at": "2025-01-01T00:00:00Z",
                "access": {"policy": "private"},
                "run": {"mode": "freeplay"},
            }
        ),
        encoding="utf-8",
    )


@pytest.fixture
def admitted() -> list[int]:
    """The account_ids the probe route was called as, in order."""
    return []


@pytest.fixture
def app(admitted: list[int]) -> FastAPI:
    """The run's routes plus a probe that records the account the entry gate admitted."""
    app = create_app(env="dev", schema_only=True)

    @app.post(PROBE_PATH)
    def _whoami(account: Annotated[Account, Depends(resolve_entry_account)]) -> dict[str, int]:
        admitted.append(account.account_id)
        return {"account_id": account.account_id}

    return app


def _logged_request(account_id: int) -> ApiAction:
    return ApiAction(
        timestamp=datetime.now(),
        elapsed=0.0,
        ip="203.0.113.7",
        action_type="request",
        user_id=account_id,
        request=ApiActionRequest(endpoint=PROBE_PATH, method="POST", content_type="application/json", payload={}),
        response=ApiActionResponse(
            status_code=200, content_type="application/json", payload={"account_id": account_id}
        ),
    )


def _replay(app: FastAPI, actions: list[Action]) -> bool:
    return simulate(
        app,
        actions,
        simulating=False,
        stop_on_mismatch=True,
        stop_on_server_error=True,
        stop_on_assertion_error=True,
        checkpoint_every_k_ticks=None,
    )


def test_replay_admits_an_account_not_on_the_roster(app: FastAPI, admitted: list[int], private_instance: None) -> None:
    account_id = make_account("alice")

    assert _replay(app, [_logged_request(account_id)])
    assert admitted == [account_id]


def test_replay_needs_no_signing_secret(app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    account_id = make_account("alice")

    def refuse(*args: object, **kwargs: object) -> str:
        raise AssertionError("replay signed a session cookie")

    monkeypatch.setattr(session.serializer, "dumps", refuse)
    monkeypatch.setattr(session.serializer, "loads", refuse)

    assert _replay(app, [_logged_request(account_id)])


def test_replay_calls_the_app_as_the_logged_account(app: FastAPI, admitted: list[int]) -> None:
    alice, bob = make_account("alice"), make_account("bob")

    assert _replay(app, [_logged_request(alice), _logged_request(bob), _logged_request(alice)])
    assert admitted == [alice, bob, alice]


def test_a_request_from_outside_is_still_gated_after_a_replay(app: FastAPI, admitted: list[int]) -> None:
    account_id = make_account("alice")
    assert _replay(app, [_logged_request(account_id)])
    engine.serve_local = False

    response = TestClient(app).post(PROBE_PATH, json={})

    assert response.status_code == 401
    assert admitted == [account_id]


def test_replay_is_served_while_the_run_only_serves_local_writes(
    app: FastAPI, admitted: list[int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Replay runs while ``serve_local`` refuses writes from anyone else. It must not depend on
    the transport happening to report a local client address.
    """
    account_id = make_account("alice")
    engine.serve_local = True
    monkeypatch.setattr(simulate_module.httpx, "ASGITransport", partial(httpx.ASGITransport, client=("203.0.113.7", 0)))

    assert _replay(app, [_logged_request(account_id)])
    assert admitted == [account_id]


def test_a_crash_during_replay_prints_its_traceback(app: FastAPI, capsys: pytest.CaptureFixture[str]) -> None:
    @app.post("/probe/crash")
    def _crash() -> None:
        raise RuntimeError("probe crashed")

    crash = _logged_request(make_account("alice"))
    crash.request.endpoint = "/probe/crash"

    assert not _replay(app, [crash])
    assert "RuntimeError: probe crashed" in capsys.readouterr().err


def test_replay_sends_the_query_string_of_a_logged_request(app: FastAPI, monkeypatch: pytest.MonkeyPatch) -> None:
    """Some writes take their arguments in the query string, like ``facilities:upgrade-all`` (#1347)."""
    received: list[str] = []

    @app.post("/probe/query")
    def _record_facility_type(facility_type: str) -> None:
        received.append(facility_type)

    logged: list[Action] = []
    monkeypatch.setattr(engine, "log_action", logged.append)
    engine.serve_local = False
    client = TestClient(app)
    authenticate(client, make_account("alice"))

    assert client.post("/probe/query?facility_type=steam_engine", json={}).status_code == 200
    assert [action.request.endpoint for action in logged if isinstance(action, ApiAction)] == [
        "/probe/query?facility_type=steam_engine"
    ]
    assert _replay(app, list(logged))  # replay logs too, so iterate over a copy
    assert received == ["steam_engine", "steam_engine"]
