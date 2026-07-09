"""Integration tests for the instance-side ``GET /lobby/my-runs`` endpoint.

Serves **only** the cookie-authenticated account's memberships, joined against the on-disk
instance fragments for name / starts_at. This is the data source for the in-run switcher.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from energetica import accounts, create_app
from energetica.globals import engine

from ._session_helpers import authenticate, make_account

PORT = 8000
ME_URL = f"http://localhost:{PORT}/api/v1/auth/me"
MY_RUNS_URL = f"http://localhost:{PORT}/api/v1/lobby/my-runs"


@pytest.fixture
def landing_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the fragment reader at a per-test landing dir and return its instances/ subdir."""
    instances = tmp_path / "landing" / "instances"
    instances.mkdir(parents=True)
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    return instances


def _write_fragment(instances: Path, *, slug: str, name: str, starts_at: str, advertised: bool = True) -> None:
    (instances / f"{slug}.json").write_text(
        json.dumps({"slug": slug, "name": name, "advertised": advertised, "starts_at": starts_at}),
        encoding="utf-8",
    )


def _authenticated_client() -> tuple[TestClient, int]:
    """Create a server-wide account for 'alice', set her SSO cookie (as a lobby login would), and
    drive the entry gate (``GET /auth/me``) so a local ``User`` is provisioned — the state a real
    browser is in by the time the in-run switcher calls my-runs. Returns the client + account_id.
    """
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    client = TestClient(app)
    account_id = make_account("alice")
    authenticate(client, account_id)
    assert client.get(ME_URL).status_code == 200  # entry gate provisions the local User
    return client, account_id


def test_my_runs_requires_authentication(landing_dir: Path) -> None:
    app = create_app(rm_instance=True, skip_adding_handlers=True, env="dev", port=PORT)
    engine.serve_local = False
    response = TestClient(app).get(MY_RUNS_URL)
    assert response.status_code == 401


def test_my_runs_returns_only_the_authed_accounts_runs_joined_with_fragments(landing_dir: Path) -> None:
    client, alice_id = _authenticated_client()
    _write_fragment(landing_dir, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    _write_fragment(landing_dir, slug="autumn-2026", name="Autumn 2026", starts_at="2026-09-01T00:00:00Z")
    accounts.record_membership(account_id=alice_id, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00")
    accounts.record_membership(account_id=alice_id, slug="autumn-2026", settled_at="2026-09-02T00:00:00+00:00")
    # A different account's membership must not leak into alice's runs.
    accounts.record_membership(account_id=alice_id + 999, slug="spring-2026", settled_at="2026-03-03T00:00:00+00:00")

    response = client.get(MY_RUNS_URL)

    assert response.status_code == 200
    # The instance echoes the provisioned User's username (== the account's) for the
    # change-password form's autocomplete="username" field.
    assert response.json()["username"] == "alice"
    runs = response.json()["runs"]
    # Most-recently-settled first.
    assert [r["slug"] for r in runs] == ["autumn-2026", "spring-2026"]
    assert runs[0]["name"] == "Autumn 2026"


def test_my_runs_filters_out_stale_memberships_without_a_fragment(landing_dir: Path) -> None:
    """A membership whose run has been deleted (no fragment on disk) is silently dropped."""
    client, alice_id = _authenticated_client()
    _write_fragment(landing_dir, slug="live-run", name="Live", starts_at="2026-03-01T00:00:00Z")
    accounts.record_membership(account_id=alice_id, slug="live-run", settled_at="2026-03-02T00:00:00+00:00")
    accounts.record_membership(account_id=alice_id, slug="deleted-run", settled_at="2026-01-01T00:00:00+00:00")

    runs = client.get(MY_RUNS_URL).json()["runs"]

    assert [r["slug"] for r in runs] == ["live-run"]


def test_my_runs_surfaces_the_accounts_own_unadvertised_run(landing_dir: Path) -> None:
    """The public manifest hides unadvertised runs, but an account must still see its own — the
    fragment exists on disk even when advertised is false.
    """
    client, alice_id = _authenticated_client()
    _write_fragment(landing_dir, slug="hidden", name="Hidden", starts_at="2026-03-01T00:00:00Z", advertised=False)
    accounts.record_membership(account_id=alice_id, slug="hidden", settled_at="2026-03-02T00:00:00+00:00")

    runs = client.get(MY_RUNS_URL).json()["runs"]

    assert [r["slug"] for r in runs] == ["hidden"]
