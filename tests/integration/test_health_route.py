"""Integration tests for the /healthz endpoint."""

import datetime

import pytest
from fastapi.testclient import TestClient

from energetica import create_app
from energetica.globals import engine


@pytest.fixture(autouse=True)
def _reset_engine_health_state() -> None:
    """Reset module-level engine health fields so tests don't bleed into each other.

    create_app() / init_instance() reset the pickled engine fields, but the
    health-check additions (last_tick_at, scheduler_exception_count, …) are
    only initialized in GameEngine.__init__, which runs once per process.
    """
    engine.last_tick_at = None
    engine.recent_tick_timestamps.clear()
    engine.resim_start_tick = None
    engine.resim_target_tick = None
    engine.scheduler_exception_count = 0


def _make_client() -> TestClient:
    app = create_app(rm_instance=True, env="dev", port=8001)
    engine.serve_local = False
    return TestClient(app)


def test_healthz_returns_ok_after_init() -> None:
    """Right after init_instance, no tick has fired yet — status should still be 'ok'."""
    client = _make_client()

    response = client.get("/healthz")
    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "ok"
    assert body["engine"]["loaded"] is True
    assert body["engine"]["total_t"] == 0
    assert body["engine"]["scheduler_exception_count"] == 0
    assert "uptime_s" in body
    assert "static_app_index_present" in body


def test_healthz_status_degraded_on_stale_tick() -> None:
    """If last_tick_at is older than 2 * clock_time seconds, status should be 'degraded'."""
    client = _make_client()
    # Force a stale last_tick_at by setting it well in the past.
    engine.last_tick_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        seconds=10 * engine.clock_time
    )

    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"


def test_healthz_status_degraded_on_scheduler_error() -> None:
    """A non-zero scheduler exception count should downgrade status to 'degraded'."""
    client = _make_client()
    engine.last_tick_at = datetime.datetime.now(datetime.timezone.utc)
    engine.scheduler_exception_count = 1

    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"


def test_healthz_status_resimulating_when_serve_local() -> None:
    """While engine.serve_local is True the server is replaying actions; status reflects that."""
    client = _make_client()
    engine.serve_local = True
    engine.resim_start_tick = 100
    engine.resim_target_tick = 500
    engine.total_t = 250

    response = client.get("/healthz")
    body = response.json()
    assert body["status"] == "resimulating"
    assert body["resim_progress"] == {"from_tick": 100, "to_tick": 500, "current_tick": 250}
