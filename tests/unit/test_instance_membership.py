"""Unit tests for the instance_membership store: the 'your runs' set for an account.

A membership row is written when an account settles (creates a Player) in a run. The lobby
and the in-run switcher read these rows back, joined against on-disk instance fragments.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from energetica import accounts


@pytest.fixture
def accounts_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the accounts module at a per-test SQLite file and initialise the schema."""
    db_path = tmp_path / "accounts.db"
    monkeypatch.setenv("ENERGETICA_ACCOUNTS_DB_PATH", str(db_path))
    accounts.init_db()
    return db_path


def test_record_and_read_back_membership(accounts_db: Path) -> None:
    """record_membership writes a row; get_memberships reads it back with slug and settled_at."""
    accounts.record_membership(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert len(memberships) == 1
    assert memberships[0].slug == "spring-2026"
    assert memberships[0].settled_at == "2026-03-01T12:00:00+00:00"


def test_record_membership_is_idempotent_and_keeps_first_settled_at(accounts_db: Path) -> None:
    """A second record for the same (account, slug) does not duplicate the row nor overwrite
    the original settled_at — settling is a one-time event, and the backfill may re-run.
    """
    accounts.record_membership(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")
    accounts.record_membership(account_id=1, slug="spring-2026", settled_at="2026-09-09T09:09:09+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert len(memberships) == 1
    assert memberships[0].settled_at == "2026-03-01T12:00:00+00:00"


def test_get_memberships_returns_only_the_given_account_ordered_by_settled_at_desc(accounts_db: Path) -> None:
    """get_memberships is scoped to one account and lists its runs most-recently-settled first."""
    accounts.record_membership(account_id=1, slug="spring-2026", settled_at="2026-03-01T00:00:00+00:00")
    accounts.record_membership(account_id=1, slug="autumn-2026", settled_at="2026-09-01T00:00:00+00:00")
    accounts.record_membership(account_id=2, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert [m.slug for m in memberships] == ["autumn-2026", "spring-2026"]


def test_get_memberships_empty_for_account_with_no_runs(accounts_db: Path) -> None:
    assert accounts.get_memberships(account_id=999) == []


def test_settled_at_is_normalised_to_utc_so_ordering_is_chronological(accounts_db: Path) -> None:
    """settled_at is stored as canonical UTC ISO regardless of the caller's offset, so the
    lexicographic ORDER BY on the TEXT column stays chronological. A '+02:00' timestamp that is
    chronologically earlier must sort before a later UTC one, not after it by string bytes.
    """
    # 08:00+02:00 == 06:00Z (earlier) vs 07:00Z (later). Lexicographically "08..." > "07...",
    # so without UTC normalisation the earlier event would wrongly sort last.
    accounts.record_membership(account_id=1, slug="earlier", settled_at="2026-03-01T08:00:00+02:00")
    accounts.record_membership(account_id=1, slug="later", settled_at="2026-03-01T07:00:00+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert [m.slug for m in memberships] == ["later", "earlier"]  # most recent first
    assert memberships[1].settled_at == "2026-03-01T06:00:00+00:00"  # stored normalised to UTC


def test_record_membership_rejects_naive_timestamp(accounts_db: Path) -> None:
    """A tz-less settled_at is a bug and fails loud rather than sorting unpredictably."""
    with pytest.raises(ValueError, match="timezone-aware"):
        accounts.record_membership(account_id=1, slug="oops", settled_at="2026-03-01T08:00:00")


def test_settling_records_membership_for_this_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    """Creating a Player (settle) writes a membership row keyed by the user's account_id and this
    instance's slug, stamped with the Player's settle time — this is what makes a run appear under
    'your runs'.
    """
    from energetica import create_app
    from energetica.database.map.hex_tile import HexTile
    from energetica.database.user import User
    from energetica.utils.auth import generate_password_hash
    from energetica.utils.map_helpers import confirm_location

    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User(username="alice", pwhash=generate_password_hash("pw"), role="player", account_id=7)

    player = confirm_location(user, HexTile.getitem(1))

    memberships = accounts.get_memberships(account_id=7)
    assert len(memberships) == 1
    assert memberships[0].slug == "spring-2026"
    assert memberships[0].settled_at == player.created_at.isoformat()


def test_settle_survives_a_membership_write_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """A failed membership write (e.g. SQLITE_BUSY on the shared accounts.db) must not break an
    otherwise-successful settle: the player is created in-memory regardless, and the row is
    recoverable via the backfill script. Best-effort, like instance_config.publish.
    """
    import sqlite3

    from energetica import create_app
    from energetica.database.map.hex_tile import HexTile
    from energetica.database.user import User
    from energetica.utils.auth import generate_password_hash
    from energetica.utils.map_helpers import confirm_location

    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")

    def boom(**_kwargs: object) -> None:
        raise sqlite3.OperationalError("database is locked")

    monkeypatch.setattr(accounts, "record_membership", boom)
    user = User(username="carol", pwhash=generate_password_hash("pw"), role="player", account_id=9)

    player = confirm_location(user, HexTile.getitem(1))  # must not raise

    assert user.player is player  # settle completed in-memory despite the DB failure


def test_settling_records_no_membership_when_slug_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """In dev / unconfigured deployments there is no slug and no lobby; settle must not crash and
    writes no membership row (mirrors instance_config.publish's no-op-without-slug behaviour).
    """
    from energetica import create_app
    from energetica.database.map.hex_tile import HexTile
    from energetica.database.user import User
    from energetica.utils.auth import generate_password_hash
    from energetica.utils.map_helpers import confirm_location

    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    user = User(username="bob", pwhash=generate_password_hash("pw"), role="player", account_id=8)

    confirm_location(user, HexTile.getitem(1))

    assert accounts.get_memberships(account_id=8) == []
