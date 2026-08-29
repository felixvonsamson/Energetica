"""Unit tests for the shared ``my-runs`` read (``energetica.my_runs.resolve_my_runs``).

This is the single join both the instance-side ``GET /lobby/my-runs`` and the lobby service serve:
an account's joined memberships (settled or not, #1030) joined against the on-disk instance
fragments, stale rows (run since deleted → no fragment) filtered, most-recently-joined first. It
touches only the accounts store and the fragment reader — no game engine.
"""

from __future__ import annotations

import json
import os
import sqlite3
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
    accounts.record_settlement(account_id=account_id, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00")
    accounts.record_settlement(account_id=account_id, slug="autumn-2026", settled_at="2026-09-02T00:00:00+00:00")

    response = resolve_my_runs(account_id, "alice")

    # ORDER BY created_at (joined_at) DESC → autumn (joined later) first.
    assert [run.slug for run in response.runs] == ["autumn-2026", "spring-2026"]
    assert response.runs[0].name == "Autumn 2026"
    # Echoed back for the change-password form's autocomplete="username" field.
    assert response.username == "alice"


def test_joined_but_not_settled_run_appears_with_null_settled_at(stores: Path) -> None:
    """The lobby's two-click join (#1030) puts a run under 'your runs' immediately, before the
    account has picked a tile — settled_at reads as null until it does.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    accounts.record_join(account_id=account_id, slug="spring-2026", joined_at="2026-02-15T00:00:00+00:00")

    runs = resolve_my_runs(account_id, "alice").runs

    assert len(runs) == 1
    assert runs[0].settled_at is None
    assert runs[0].joined_at.isoformat() == "2026-02-15T00:00:00+00:00"


def test_settling_after_joining_fills_in_settled_at(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    accounts.record_join(account_id=account_id, slug="spring-2026", joined_at="2026-02-15T00:00:00+00:00")
    accounts.record_settlement(account_id=account_id, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00")

    run = resolve_my_runs(account_id, "alice").runs[0]

    assert run.joined_at.isoformat() == "2026-02-15T00:00:00+00:00"
    assert run.settled_at is not None
    assert run.settled_at.isoformat() == "2026-03-02T00:00:00+00:00"


def test_surfaces_unadvertised_runs(stores: Path) -> None:
    """An account's own unadvertised run has an on-disk fragment, so it appears in *its* my-runs
    even though it is absent from the public manifest.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="secret-run", name="Secret", starts_at="2026-01-01T00:00:00Z", advertised=False)
    accounts.record_settlement(account_id=account_id, slug="secret-run", settled_at="2026-01-02T00:00:00+00:00")

    assert [run.slug for run in resolve_my_runs(account_id, "alice").runs] == ["secret-run"]


def test_filters_stale_membership_without_fragment(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="live-run", name="Live", starts_at="2026-03-01T00:00:00Z")
    accounts.record_settlement(account_id=account_id, slug="live-run", settled_at="2026-03-02T00:00:00+00:00")
    # Run since deleted: membership row remains but its fragment is gone.
    accounts.record_settlement(account_id=account_id, slug="deleted-run", settled_at="2026-04-02T00:00:00+00:00")

    assert [run.slug for run in resolve_my_runs(account_id, "alice").runs] == ["live-run"]


def test_empty_when_no_memberships(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    assert resolve_my_runs(account_id, "alice").runs == []


def _raw_membership(account_id: int, slug: str, created_at: str, *, settled_at: str | None = None) -> None:
    """Insert a membership row directly, bypassing record_join/record_settlement's aware-UTC
    normalisation, to simulate a legacy/restored/hand-edited row.
    """
    conn = sqlite3.connect(os.environ["ENERGETICA_ACCOUNTS_DB_PATH"])
    try:
        conn.execute(
            "INSERT OR IGNORE INTO instance_membership (account_id, slug, role, created_at, settled_at) "
            "VALUES (?, ?, 'player', ?, ?)",
            (account_id, slug, created_at, settled_at),
        )
        conn.commit()
    finally:
        conn.close()


def test_naive_timestamps_recovered_as_utc(stores: Path) -> None:
    """A legacy naive timestamp (joined_at or settled_at) must not 500 the endpoint; both are
    recovered as UTC and the run shows.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="legacy", name="Legacy", starts_at="2026-01-01T00:00:00Z")
    _raw_membership(account_id, "legacy", "2026-01-02T00:00:00", settled_at="2026-01-03T00:00:00")  # naive

    runs = resolve_my_runs(account_id, "alice").runs

    assert [run.slug for run in runs] == ["legacy"]
    assert runs[0].joined_at.tzinfo is not None
    assert runs[0].settled_at is not None
    assert runs[0].settled_at.tzinfo is not None


def test_unparseable_created_at_skipped_not_fatal(stores: Path) -> None:
    """A corrupt joined_at (created_at) drops the whole row — it is the one field every row must
    have — rather than hiding every run for the account.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="good", name="Good", starts_at="2026-01-01T00:00:00Z")
    _fragment(stores, slug="corrupt", name="Corrupt", starts_at="2026-02-01T00:00:00Z")
    accounts.record_settlement(account_id=account_id, slug="good", settled_at="2026-01-02T00:00:00+00:00")
    _raw_membership(account_id, "corrupt", "not-a-timestamp")

    assert [run.slug for run in resolve_my_runs(account_id, "alice").runs] == ["good"]


def test_unparseable_settled_at_keeps_the_run_as_joined_only(stores: Path) -> None:
    """A corrupt settled_at on an otherwise-good row must not hide the run — it reads the same as
    a null settled_at (joined, not settled) rather than dropping the membership.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="odd", name="Odd", starts_at="2026-01-01T00:00:00Z")
    _raw_membership(account_id, "odd", "2026-01-02T00:00:00+00:00", settled_at="not-a-timestamp")

    runs = resolve_my_runs(account_id, "alice").runs

    assert [run.slug for run in runs] == ["odd"]
    assert runs[0].settled_at is None


def test_facilitated_runs_joined_with_fragments_most_recently_granted_first(stores: Path) -> None:
    """The instance-scoped-facilitator counterpart to `runs` (#1032): joined against the same
    fragments, most recently granted first.
    """
    account_id = accounts.create_account(username="alice", pwhash="h")
    _fragment(stores, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    _fragment(stores, slug="autumn-2026", name="Autumn 2026", starts_at="2026-09-01T00:00:00Z")
    accounts.grant_facilitator(account_id=account_id, slug="spring-2026", granted_at="2026-01-01T00:00:00+00:00")
    accounts.grant_facilitator(account_id=account_id, slug="autumn-2026", granted_at="2026-02-01T00:00:00+00:00")

    response = resolve_my_runs(account_id, "alice")

    assert [run.slug for run in response.facilitated_runs] == ["autumn-2026", "spring-2026"]
    assert response.facilitated_runs[0].name == "Autumn 2026"
    assert response.facilitated_runs[0].granted_at.isoformat() == "2026-02-01T00:00:00+00:00"


def test_facilitated_runs_excludes_server_wide_grant(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    accounts.grant_facilitator(account_id=account_id, slug=None)

    assert resolve_my_runs(account_id, "alice").facilitated_runs == []


def test_facilitated_runs_filters_stale_grant_without_fragment(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    accounts.grant_facilitator(account_id=account_id, slug="deleted-run")

    assert resolve_my_runs(account_id, "alice").facilitated_runs == []


def test_facilitated_runs_empty_when_no_grants(stores: Path) -> None:
    account_id = accounts.create_account(username="alice", pwhash="h")
    assert resolve_my_runs(account_id, "alice").facilitated_runs == []
