"""Unit tests for the instance_membership store: the 'your runs' set for an account.

A membership row is written when an account settles (creates a Player) in a run. The lobby
and the in-run switcher read these rows back, joined against on-disk instance fragments.
"""

from __future__ import annotations

import sqlite3
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
    """record_settlement writes a row; get_memberships reads it back with slug and created_at."""
    accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert len(memberships) == 1
    assert memberships[0].slug == "spring-2026"
    assert memberships[0].role == "player"
    assert memberships[0].created_at == "2026-03-01T12:00:00+00:00"


def test_record_settlement_is_idempotent_and_keeps_first_created_at(accounts_db: Path) -> None:
    """A second record for the same (account, slug) does not duplicate the row nor overwrite
    the original timestamp — settling is a one-time event, and the backfill may re-run.
    """
    accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")
    accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-09-09T09:09:09+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert len(memberships) == 1
    assert memberships[0].created_at == "2026-03-01T12:00:00+00:00"


def test_get_memberships_returns_only_the_given_account_ordered_by_created_at_desc(accounts_db: Path) -> None:
    """get_memberships is scoped to one account and lists its runs most-recently-settled first."""
    accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T00:00:00+00:00")
    accounts.record_settlement(account_id=1, slug="autumn-2026", settled_at="2026-09-01T00:00:00+00:00")
    accounts.record_settlement(account_id=2, slug="spring-2026", settled_at="2026-03-02T00:00:00+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert [m.slug for m in memberships] == ["autumn-2026", "spring-2026"]


def test_get_memberships_empty_for_account_with_no_runs(accounts_db: Path) -> None:
    assert accounts.get_memberships(account_id=999) == []


def test_get_memberships_excludes_facilitator_grants(accounts_db: Path) -> None:
    """'Your runs' is about play, not administration — a facilitator grant never shows up here."""
    accounts.grant_facilitator(account_id=1, slug="spring-2026")

    assert accounts.get_memberships(account_id=1) == []


def test_settled_at_is_normalised_to_utc_so_ordering_is_chronological(accounts_db: Path) -> None:
    """created_at is stored as canonical UTC ISO regardless of the caller's offset, so the
    lexicographic ORDER BY on the TEXT column stays chronological. A '+02:00' timestamp that is
    chronologically earlier must sort before a later UTC one, not after it by string bytes.
    """
    # 08:00+02:00 == 06:00Z (earlier) vs 07:00Z (later). Lexicographically "08..." > "07...",
    # so without UTC normalisation the earlier event would wrongly sort last.
    accounts.record_settlement(account_id=1, slug="earlier", settled_at="2026-03-01T08:00:00+02:00")
    accounts.record_settlement(account_id=1, slug="later", settled_at="2026-03-01T07:00:00+00:00")

    memberships = accounts.get_memberships(account_id=1)

    assert [m.slug for m in memberships] == ["later", "earlier"]  # most recent first
    assert memberships[1].created_at == "2026-03-01T06:00:00+00:00"  # stored normalised to UTC


def test_record_settlement_rejects_naive_timestamp(accounts_db: Path) -> None:
    """A tz-less settled_at is a bug and fails loud rather than sorting unpredictably."""
    with pytest.raises(ValueError, match="timezone-aware"):
        accounts.record_settlement(account_id=1, slug="oops", settled_at="2026-03-01T08:00:00")


def test_record_settlement_rejects_a_facilitator_account(accounts_db: Path) -> None:
    """Player and facilitator are mutually exclusive per (account_id, slug) — see ADR-0004."""
    accounts.grant_facilitator(account_id=1, slug="spring-2026")

    with pytest.raises(accounts.MembershipRoleConflictError):
        accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")


def test_record_settlement_rejects_a_server_wide_facilitator(accounts_db: Path) -> None:
    """A server-wide grant (slug=None) blocks settling in any specific instance too."""
    accounts.grant_facilitator(account_id=1, slug=None)

    with pytest.raises(accounts.MembershipRoleConflictError):
        accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")


def test_grant_facilitator_rejects_an_existing_player(accounts_db: Path) -> None:
    accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")

    with pytest.raises(accounts.MembershipRoleConflictError):
        accounts.grant_facilitator(account_id=1, slug="spring-2026")


def test_grant_facilitator_is_idempotent_at_the_same_scope(accounts_db: Path) -> None:
    accounts.grant_facilitator(account_id=1, slug="spring-2026")
    accounts.grant_facilitator(account_id=1, slug="spring-2026")  # must not raise

    assert accounts.is_facilitator(account_id=1, slug="spring-2026") is True


def test_is_facilitator_true_for_a_server_wide_grant_on_any_instance(accounts_db: Path) -> None:
    accounts.grant_facilitator(account_id=1, slug=None)

    assert accounts.is_facilitator(account_id=1, slug="any-instance") is True


def test_is_facilitator_false_for_an_unrelated_instance(accounts_db: Path) -> None:
    accounts.grant_facilitator(account_id=1, slug="spring-2026")

    assert accounts.is_facilitator(account_id=1, slug="autumn-2026") is False


def test_grant_facilitator_server_wide_twice_does_not_duplicate_the_row(accounts_db: Path) -> None:
    """SQLite treats every NULL as distinct in a unique index, so the (account_id, slug) primary
    key alone would let two server-wide grants for the same account both insert — a partial
    unique index (WHERE slug IS NULL) backstops what the app-level idempotency check in
    grant_facilitator races against under concurrent callers.
    """
    accounts.grant_facilitator(account_id=1, slug=None)
    accounts.grant_facilitator(account_id=1, slug=None)  # must not raise or duplicate

    with sqlite3.connect(accounts_db) as conn:
        rows = conn.execute("SELECT COUNT(*) FROM instance_membership WHERE account_id = 1 AND slug IS NULL").fetchone()
    assert rows[0] == 1


def test_concurrent_settle_and_grant_for_the_same_scope_never_corrupts_the_role(accounts_db: Path) -> None:
    """record_settlement and grant_facilitator are independent check-then-write operations on the
    same (account_id, slug) row — without a shared transaction lock, both could pass their
    conflict check before either writes, leaving a row whose role neither caller actually agreed
    to (or a caller believing it won when it didn't). Racing them for real (two threads, a
    barrier) must produce exactly one winner and one real MembershipRoleConflictError — never two
    silent successes or a row that doesn't match either caller's belief about the outcome.
    """
    import threading

    barrier = threading.Barrier(2)
    outcomes: dict[str, BaseException | None] = {}

    def settle() -> None:
        barrier.wait()
        try:
            accounts.record_settlement(account_id=1, slug="spring-2026", settled_at="2026-03-01T12:00:00+00:00")
            outcomes["settle"] = None
        except accounts.MembershipRoleConflictError as exc:
            outcomes["settle"] = exc

    def grant() -> None:
        barrier.wait()
        try:
            accounts.grant_facilitator(account_id=1, slug="spring-2026")
            outcomes["grant"] = None
        except accounts.MembershipRoleConflictError as exc:
            outcomes["grant"] = exc

    threads = [threading.Thread(target=settle), threading.Thread(target=grant)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    results = [outcomes["settle"], outcomes["grant"]]
    assert results.count(None) == 1, "exactly one of the two operations must win"
    assert sum(isinstance(r, accounts.MembershipRoleConflictError) for r in results) == 1

    is_facilitator = accounts.is_facilitator(account_id=1, slug="spring-2026")
    settled = len(accounts.get_memberships(account_id=1)) == 1
    # The persisted row must match whichever operation actually won — never both, never neither.
    assert is_facilitator != settled
    assert (outcomes["grant"] is None) == is_facilitator
    assert (outcomes["settle"] is None) == settled


def test_migrate_instance_membership_columns_backfills_pre_role_rows(accounts_db: Path) -> None:
    """A row written under the pre-role schema (slug/settled_at NOT NULL, no role column) must
    survive the rebuild migration as role='player' with created_at taken from the old settled_at.
    """
    with sqlite3.connect(accounts_db) as conn:
        conn.execute("DROP TABLE instance_membership")
        conn.execute(
            """
            CREATE TABLE instance_membership (
                account_id INTEGER NOT NULL,
                slug       TEXT    NOT NULL,
                settled_at TEXT    NOT NULL,
                PRIMARY KEY (account_id, slug)
            )
            """
        )
        conn.execute(
            "INSERT INTO instance_membership (account_id, slug, settled_at) VALUES (1, 'spring-2026', '2026-03-01T12:00:00+00:00')"
        )
        conn.commit()
    from energetica.accounts.db import _reset_initialised_paths

    _reset_initialised_paths()  # force the next _connect() to re-run schema/migration

    memberships = accounts.get_memberships(account_id=1)

    assert len(memberships) == 1
    assert memberships[0].role == "player"
    assert memberships[0].created_at == "2026-03-01T12:00:00+00:00"


def test_settling_records_membership_for_this_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    """Creating a Player (settle) writes a membership row keyed by the account's account_id and
    this instance's slug, stamped with the Player's settle time — this is what makes a run appear
    under 'your runs'.
    """
    from energetica import create_app
    from energetica.accounts import Account
    from energetica.database.map.hex_tile import HexTile
    from energetica.utils.auth import generate_password_hash
    from energetica.utils.map_helpers import confirm_location

    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    account = Account(account_id=7, username="alice", pwhash=generate_password_hash("pw"), email=None, created_at="")

    player = confirm_location(account, HexTile.getitem(1))

    memberships = accounts.get_memberships(account_id=7)
    assert len(memberships) == 1
    assert memberships[0].slug == "spring-2026"
    assert memberships[0].created_at == player.created_at.isoformat()


def test_settle_survives_a_membership_write_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """A failed membership write (e.g. SQLITE_BUSY on the shared accounts.db) must not break an
    otherwise-successful settle: the player is created in-memory regardless, and the row is
    recoverable via the backfill script. Best-effort, like instance_config.publish.
    """
    import sqlite3

    from energetica import create_app
    from energetica.accounts import Account
    from energetica.database.map.hex_tile import HexTile
    from energetica.database.player import Player
    from energetica.utils.auth import generate_password_hash
    from energetica.utils.map_helpers import confirm_location

    monkeypatch.setenv("ENERGETICA_INSTANCE_SLUG", "spring-2026")
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")

    def boom(**_kwargs: object) -> None:
        raise sqlite3.OperationalError("database is locked")

    monkeypatch.setattr(accounts, "record_settlement", boom)
    account = Account(account_id=9, username="carol", pwhash=generate_password_hash("pw"), email=None, created_at="")

    player = confirm_location(account, HexTile.getitem(1))  # must not raise

    assert next(Player.filter_by(account_id=9), None) is player  # settle completed in-memory despite the DB failure


def test_settling_records_no_membership_when_slug_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """In dev / unconfigured deployments there is no slug and no lobby; settle must not crash and
    writes no membership row (mirrors instance_config.publish's no-op-without-slug behaviour).
    """
    from energetica import create_app
    from energetica.accounts import Account
    from energetica.database.map.hex_tile import HexTile
    from energetica.utils.auth import generate_password_hash
    from energetica.utils.map_helpers import confirm_location

    monkeypatch.delenv("ENERGETICA_INSTANCE_SLUG", raising=False)
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    account = Account(account_id=8, username="bob", pwhash=generate_password_hash("pw"), email=None, created_at="")

    confirm_location(account, HexTile.getitem(1))

    assert accounts.get_memberships(account_id=8) == []
