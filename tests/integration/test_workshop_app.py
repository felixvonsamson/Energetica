"""Integration tests for the Workshop app (#994): what the backend serves when it starts a Workshop
Run instead of the persistent world.

These build the Workshop app directly. ``test_instance_app_starts_workshop_without_the_persistent_world``
checks the dispatch that ``main.py`` goes through, in a fresh interpreter, because the test process
has already imported the persistent world.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica.identity import accounts
from energetica.identity.instance_config import load_instance_config
from energetica.workshop.app import create_workshop_app

from . import _socketio_helpers as socket
from ._session_helpers import authenticate, make_account

SLUG = "workshop-autumn"
_REPO_ROOT = Path(__file__).resolve().parents[2]

WORKSHOP_JSON = {
    "name": "Workshop",
    "advertised": False,
    "starts_at": "2026-03-01T00:00:00Z",
    "run": {"mode": "workshop"},
}

ENTER_URL = "/api/v1/workshop/enter"
SESSION_URL = "/api/v1/workshop/session"
ADVANCE_URL = "/api/v1/workshop/session/advance"


@pytest.fixture
def session_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Configure this process as the Workshop Run ``SLUG`` and return where its session is saved."""
    config_dir = tmp_path / "etc"
    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", SLUG)
    monkeypatch.setenv("ENERGETICA_INSTANCE_CONFIG_DIR", str(config_dir))
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    instance_json = config_dir / SLUG / "instance.json"
    instance_json.parent.mkdir(parents=True)
    instance_json.write_text(json.dumps(WORKSHOP_JSON), encoding="utf-8")
    return tmp_path / "instance" / "workshop_session.json"


def _client(session_path: Path) -> TestClient:
    config = load_instance_config()
    assert config is not None
    return TestClient(create_workshop_app(config, session_path=session_path))


def _player(client: TestClient, username: str) -> int:
    account_id = make_account(username)
    accounts.record_join(account_id=account_id, slug=SLUG, joined_at=datetime.now(timezone.utc).isoformat())
    authenticate(client, account_id)
    return account_id


def _facilitator(client: TestClient) -> int:
    account_id = make_account("prof")
    accounts.grant_facilitator(account_id=account_id, slug=SLUG)
    authenticate(client, account_id)
    return account_id


def _checkpoint(kind: str, round_number: int | None = None, season: str | None = None) -> dict:
    checkpoint: dict = {"kind": kind}
    if round_number is not None:
        checkpoint["round"] = round_number
    if season is not None:
        checkpoint["season"] = season
    return checkpoint


# --- the Run mode ---------------------------------------------------------------------------


def test_reports_the_workshop_run_mode(session_path: Path) -> None:
    response = _client(session_path).get("/api/v1/run")

    assert response.status_code == 200
    assert response.json() == {"mode": "workshop"}


def test_serves_none_of_the_persistent_world(session_path: Path) -> None:
    app = create_workshop_app(load_instance_config(), session_path=session_path)
    paths = {getattr(route, "path", None) for route in app.routes}

    assert "/api/v1/auth/me" not in paths
    assert not any(path and path.startswith("/api/v1/facilities") for path in paths)


def test_health_check_is_ok(session_path: Path) -> None:
    response = _client(session_path).get("/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# --- entering the Run -----------------------------------------------------------------------


def test_entering_without_a_session_is_401(session_path: Path) -> None:
    assert _client(session_path).post(ENTER_URL).status_code == 401


def test_entering_a_private_run_without_having_joined_it_is_403(session_path: Path) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    assert client.post(ENTER_URL).status_code == 403


def test_a_player_entering_is_placed_into_the_shared_network(session_path: Path) -> None:
    client = _client(session_path)
    account_id = _player(client, "alice")

    response = client.post(ENTER_URL)

    assert response.status_code == 200
    assert response.json() == {
        "role": "player",
        "player": {"account_id": account_id, "username": "alice", "money": 25_000.0},
    }
    assert [player["username"] for player in client.get(SESSION_URL).json()["players"]] == ["alice"]


def test_entering_twice_keeps_one_place_in_the_network(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    client.post(ENTER_URL)
    client.post(ENTER_URL)

    assert len(client.get(SESSION_URL).json()["players"]) == 1


def test_a_facilitator_entering_is_not_placed_into_the_network(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    response = client.post(ENTER_URL)

    assert response.status_code == 200
    assert response.json() == {"role": "facilitator", "player": None}
    assert client.get(SESSION_URL).json()["players"] == []


# --- the session ----------------------------------------------------------------------------


def test_a_new_session_has_not_started(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    body = client.get(SESSION_URL).json()

    assert body["checkpoint"] == _checkpoint("not_started")
    assert body["round_count"] == 3


def test_the_session_names_the_checkpoint_an_advance_moves_to(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    assert client.get(SESSION_URL).json()["next_checkpoint"] == _checkpoint("investment", 1)

    body = client.post(ADVANCE_URL).json()

    assert body["checkpoint"] == _checkpoint("investment", 1)
    assert body["next_checkpoint"] == _checkpoint("trading_period", 1, "spring")


def test_reading_the_session_needs_entry(session_path: Path) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    assert client.get(SESSION_URL).status_code == 403


def test_a_player_cannot_advance_the_session(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")

    assert client.post(ADVANCE_URL).status_code == 403
    assert client.get(SESSION_URL).json()["checkpoint"] == _checkpoint("not_started")


def test_the_moderator_advances_an_empty_round_to_recap_and_into_round_two(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)

    visited = [client.post(ADVANCE_URL).json()["checkpoint"] for _ in range(8)]

    assert visited == [
        _checkpoint("investment", 1),
        _checkpoint("trading_period", 1, "spring"),
        _checkpoint("trading_period", 1, "summer"),
        _checkpoint("trading_period", 1, "autumn"),
        _checkpoint("trading_period", 1, "winter"),
        _checkpoint("recap", 1),
        _checkpoint("investment", 2),
        _checkpoint("trading_period", 2, "spring"),
    ]


def test_advancing_a_finished_session_is_an_error(session_path: Path) -> None:
    client = _client(session_path)
    _facilitator(client)
    # Three Rounds of six checkpoints each, plus the step into the first Round and the step out of the last.
    for _ in range(3 * 6 + 1):
        assert client.post(ADVANCE_URL).status_code == 200
    finished = client.get(SESSION_URL).json()
    assert finished["checkpoint"] == _checkpoint("finished")
    assert finished["next_checkpoint"] is None

    response = client.post(ADVANCE_URL)

    assert response.status_code == 400
    assert response.json()["game_exception_type"] == "WORKSHOP_SESSION_FINISHED"


def test_the_session_survives_a_restart(session_path: Path) -> None:
    client = _client(session_path)
    account_id = _player(client, "alice")
    client.post(ENTER_URL)
    _facilitator(client)
    for _ in range(3):
        client.post(ADVANCE_URL)

    restarted = _client(session_path)
    authenticate(restarted, account_id)
    body = restarted.get(SESSION_URL).json()

    assert body["checkpoint"] == _checkpoint("trading_period", 1, "summer")
    assert [player["username"] for player in body["players"]] == ["alice"]


# --- pushing changes to open pages ---------------------------------------------------------


def test_a_joined_player_and_the_facilitator_can_connect_a_socket(session_path: Path) -> None:
    client = _client(session_path)
    _player(client, "alice")
    assert socket.is_admitted(socket.connect(client)[1])

    _facilitator(client)
    assert socket.is_admitted(socket.connect(client)[1])


def test_a_socket_without_a_session_is_refused(session_path: Path) -> None:
    _, answer = socket.connect(_client(session_path))

    assert answer == {"message": "NOT_AUTHENTICATED"}


def test_a_socket_for_an_account_that_has_not_joined_is_refused(session_path: Path) -> None:
    client = _client(session_path)
    authenticate(client, make_account("stranger"))

    _, answer = socket.connect(client)

    assert answer == {"message": "INSTANCE_ACCESS_DENIED"}


def test_advancing_tells_every_open_page_to_reread_the_session(session_path: Path) -> None:
    # One client, so one event loop, serves every request: the server's queues belong to it.
    with TestClient(create_workshop_app(load_instance_config(), session_path=session_path)) as client:
        _player(client, "alice")
        player_sid, _ = socket.connect(client)
        _facilitator(client)
        facilitator_sid, _ = socket.connect(client)

        assert client.post(ADVANCE_URL).status_code == 200

        invalidate = ["invalidate", {"queries": [["workshop", "session"]]}]
        assert socket.poll(client, player_sid) == [invalidate]
        assert socket.poll(client, facilitator_sid) == [invalidate]


# --- starting the backend -------------------------------------------------------------------


def test_instance_app_starts_workshop_without_the_persistent_world(session_path: Path, tmp_path: Path) -> None:
    """``main.py`` builds its app with ``create_instance_app``. For a Workshop Run that must give the
    Workshop app and never import ``energetica.freeplay``, whose import builds the persistent
    world's game engine.
    """
    code = (
        "import json, sys\n"
        "from energetica.entry import create_instance_app\n"
        "app = create_instance_app(env='dev')\n"
        "paths = sorted(getattr(route, 'path', '') for route in app.routes)\n"
        "loaded = sorted(m for m in sys.modules if m.startswith('energetica.freeplay'))\n"
        "print(json.dumps({'paths': paths, 'freeplay': loaded}))\n"
    )
    env = {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(filter(None, [str(_REPO_ROOT / "src"), os.environ.get("PYTHONPATH")])),
    }
    result = subprocess.run(
        [sys.executable, "-c", code], cwd=tmp_path, env=env, capture_output=True, text=True, check=True
    )
    output = json.loads(result.stdout.strip().splitlines()[-1])

    assert output["freeplay"] == []
    assert SESSION_URL in output["paths"]
