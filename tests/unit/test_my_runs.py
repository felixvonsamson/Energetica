"""Unit tests for the shared ``my-runs`` read (``energetica.identity.my_runs.build_my_runs``).

This is the single join both the instance-side ``GET /lobby/my-runs`` and the lobby backend serve:
an account's memberships, as the lobby service reports them (joined runs, settled or not, #1030,
and run-scoped facilitator grants, most recent first), joined against the on-disk instance
fragments, with stale memberships (run since deleted → no fragment) filtered out. It touches only
the fragment reader — no game engine and no lobby service.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from energetica.identity.my_runs import build_my_runs
from energetica.identity.schemas.lobby_service import GrantedRun, JoinedRun, MembershipsOut


@pytest.fixture
def instances(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A per-test landing dir; returns the instances/ fragment dir."""
    instances = tmp_path / "landing" / "instances"
    instances.mkdir(parents=True)
    monkeypatch.setenv("ENERGETICA_LANDING_DIR", str(tmp_path / "landing"))
    return instances


def _fragment(
    instances: Path, *, slug: str, name: str, starts_at: str, advertised: bool = True, mode: str = "freeplay"
) -> None:
    (instances / f"{slug}.json").write_text(
        json.dumps({"slug": slug, "name": name, "advertised": advertised, "starts_at": starts_at, "mode": mode}),
        encoding="utf-8",
    )


def _joined(*runs: tuple[str, str]) -> MembershipsOut:
    return MembershipsOut(runs=[JoinedRun(slug=slug, joined_at=at) for slug, at in runs], facilitated_runs=[])


def _granted(*runs: tuple[str, str]) -> MembershipsOut:
    return MembershipsOut(runs=[], facilitated_runs=[GrantedRun(slug=slug, granted_at=at) for slug, at in runs])


def test_joins_memberships_with_fragments_in_the_order_given(instances: Path) -> None:
    _fragment(instances, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    _fragment(instances, slug="autumn-2026", name="Autumn 2026", starts_at="2026-09-01T00:00:00Z")

    response = build_my_runs(
        "alice", _joined(("autumn-2026", "2026-09-02T00:00:00+00:00"), ("spring-2026", "2026-03-02T00:00:00+00:00"))
    )

    # The lobby service sends the most recently joined first, and the order is kept.
    assert [run.slug for run in response.runs] == ["autumn-2026", "spring-2026"]
    assert response.runs[0].name == "Autumn 2026"
    # Echoed back for the change-password form's autocomplete="username" field.
    assert response.username == "alice"


def test_runs_carry_their_run_mode(instances: Path) -> None:
    """The lobby shows a Workshop run with a different icon, so each run says which mode it is in."""
    _fragment(instances, slug="workshop-1", name="Workshop", starts_at="2026-03-01T00:00:00Z", mode="workshop")
    _fragment(instances, slug="world", name="World", starts_at="2026-01-01T00:00:00Z")

    runs = build_my_runs(
        "alice", _joined(("workshop-1", "2026-03-02T00:00:00+00:00"), ("world", "2026-01-02T00:00:00+00:00"))
    ).runs

    assert [(run.slug, run.mode) for run in runs] == [("workshop-1", "workshop"), ("world", "freeplay")]


def test_surfaces_unadvertised_runs(instances: Path) -> None:
    """An account's own unadvertised run has an on-disk fragment, so it appears in *its* my-runs
    even though it is absent from the public manifest.
    """
    _fragment(instances, slug="secret-run", name="Secret", starts_at="2026-01-01T00:00:00Z", advertised=False)

    runs = build_my_runs("alice", _joined(("secret-run", "2026-01-02T00:00:00+00:00"))).runs

    assert [run.slug for run in runs] == ["secret-run"]


def test_filters_stale_membership_without_fragment(instances: Path) -> None:
    _fragment(instances, slug="live-run", name="Live", starts_at="2026-03-01T00:00:00Z")

    # The run since deleted still has a membership, but its fragment is gone.
    runs = build_my_runs(
        "alice", _joined(("deleted-run", "2026-04-02T00:00:00+00:00"), ("live-run", "2026-03-02T00:00:00+00:00"))
    ).runs

    assert [run.slug for run in runs] == ["live-run"]


def test_empty_when_no_memberships(instances: Path) -> None:
    assert build_my_runs("alice", _joined()).runs == []


def test_naive_timestamps_recovered_as_utc(instances: Path) -> None:
    """A legacy naive joined_at must not 500 the endpoint; it is recovered as UTC and the run shows."""
    _fragment(instances, slug="legacy", name="Legacy", starts_at="2026-01-01T00:00:00Z")

    runs = build_my_runs("alice", _joined(("legacy", "2026-01-02T00:00:00"))).runs

    assert [run.slug for run in runs] == ["legacy"]
    assert runs[0].joined_at.tzinfo is not None


def test_unparseable_joined_at_skipped_not_fatal(instances: Path) -> None:
    """A corrupt joined_at drops that membership rather than hiding every run for the account."""
    _fragment(instances, slug="good", name="Good", starts_at="2026-01-01T00:00:00Z")
    _fragment(instances, slug="corrupt", name="Corrupt", starts_at="2026-02-01T00:00:00Z")

    runs = build_my_runs("alice", _joined(("corrupt", "not-a-timestamp"), ("good", "2026-01-02T00:00:00+00:00"))).runs

    assert [run.slug for run in runs] == ["good"]


def test_facilitated_runs_joined_with_fragments(instances: Path) -> None:
    """The instance-scoped-facilitator counterpart to `runs` (#1032): joined against the same fragments."""
    _fragment(instances, slug="spring-2026", name="Spring 2026", starts_at="2026-03-01T00:00:00Z")
    _fragment(instances, slug="autumn-2026", name="Autumn 2026", starts_at="2026-09-01T00:00:00Z")

    response = build_my_runs(
        "alice", _granted(("autumn-2026", "2026-02-01T00:00:00+00:00"), ("spring-2026", "2026-01-01T00:00:00+00:00"))
    )

    assert [run.slug for run in response.facilitated_runs] == ["autumn-2026", "spring-2026"]
    assert response.facilitated_runs[0].name == "Autumn 2026"
    assert response.facilitated_runs[0].granted_at.isoformat() == "2026-02-01T00:00:00+00:00"


def test_facilitated_runs_filters_stale_grant_without_fragment(instances: Path) -> None:
    assert build_my_runs("alice", _granted(("deleted-run", "2026-01-01T00:00:00+00:00"))).facilitated_runs == []


def test_facilitated_runs_empty_when_no_grants(instances: Path) -> None:
    assert build_my_runs("alice", _granted()).facilitated_runs == []
