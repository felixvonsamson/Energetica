"""Unit tests for the shared ``my-runs`` read (``energetica.my_runs.resolve_my_runs``).

This is the single join both the instance-side ``GET /lobby/my-runs`` and the lobby service serve:
an account's settled memberships joined against the on-disk instance fragments, stale rows (run
since deleted → no fragment) filtered, most-recently-settled first. It touches only the accounts
store and the fragment reader — no game engine.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from energetica import accounts
from energetica.my_runs import resolve_my_runs


@pytest.fixture
def stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Per-test accounts DB + landing dir; returns the instances/ fragment dir."""
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(tmp_path / "accounts.db"))
    instances = tmp_path / "landing" / "instances"
    instances.mkdir(parents=True)
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    accounts.init_db()
    return instances


def _fragment(instances: Path, *, slug: str, name: str, starts_at: str, advertised: bool = True) -> None:
    (instances / f"{slug}.json").write_text(
        json.dumps({"slug": slug, "name": name, "advertised": advertised, "starts_at": starts_at}),
        encoding="utf-8",
    )


def test_joins_memberships_with_fragments_most_recent_first(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    _fragment(stores, slug="autumn-2026", name="Autumn 2026", starts_at="2026-09-01T00:00:00Z")
    accounts.record_membership(account_id=account_id, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00")
    accounts.record_membership(account_id=account_id, slug="autumn-2026", settled_at="2026-09-02T00:00:00+00:00")

    response = resolve_my_runs(account_id)

    # ORDER BY settled_at DESC → autumn (settled later) first.
    assert [run.slug for run in response.runs] == ["autumn-2026", "spring-2026"]
    assert response.runs[0].name == "Autumn 2026"


def test_surfaces_unadvertised_runs(stores: Path) -> None:
    """An account's own unadvertised run has an on-disk fragment, so it appears in *its* my-runs
    even though it is absent from the public manifest.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="secret-run", name="Secret", starts_at="2026-01-01T00:00:00Z", advertised=False)
    accounts.record_membership(account_id=account_id, slug="secret-run", settled_at="2026-01-02T00:00:00+00:00")

    assert [run.slug for run in resolve_my_runs(account_id).runs] == ["secret-run"]


def test_filters_stale_membership_without_fragment(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="live-run", name="Live", starts_at="2026-03-01T00:00:00Z")
    accounts.record_membership(account_id=account_id, slug="live-run", settled_at="2026-03-02T00:00:00+00:00")
    # Run since deleted: membership row remains but its fragment is gone.
    accounts.record_membership(account_id=account_id, slug="deleted-run", settled_at="2026-04-02T00:00:00+00:00")

    assert [run.slug for run in resolve_my_runs(account_id).runs] == ["live-run"]


def test_empty_when_no_memberships(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    assert resolve_my_runs(account_id).runs == []
