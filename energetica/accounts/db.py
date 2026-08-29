"""SQLite-backed accounts store. Connection-per-call; WAL for concurrent readers."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Literal

from energetica.utils.session import check_password_hash

# The default targets local dev: a repo-relative path under instance/ (the per-instance
# working dir, alongside engine_data.pck and secret_key.txt), so `python main.py --env dev`
# runs with zero host configuration and `--rm_instance` wipes credentials and pickle in
# lockstep. Production never hits this default — the systemd unit sets
# ENERGETICA_ACCOUNTS_DB_PATH=/var/lib/energetica/accounts.db explicitly
# (scripts/infra/energetica.service). Keep the default dev-friendly; let prod be explicit.
_DEFAULT_DB_PATH = "instance/accounts.db"
_ENV_VAR = "ENERGETICA_ACCOUNTS_DB_PATH"

_initialised_paths: set[Path] = set()


@dataclass(frozen=True)
class Account:
    account_id: int
    username: str
    pwhash: str
    email: str | None
    created_at: str


Role = Literal["player", "facilitator"]


@dataclass(frozen=True)
class Membership:
    """One account's relationship to one run: either a joined-or-settled player or a granted
    facilitator, never both (see ADR-0004) — ``slug`` is ``None`` only for a server-wide
    facilitator grant, never for a player row.

    For a player row, ``created_at`` is when the account joined (from the lobby's two-click
    join, or straight from settling if it never went through that step — dev/legacy runs and
    private runs, see #1030); ``settled_at`` is ``None`` until they actually pick a tile.
    Always ``None`` for a facilitator row.
    """

    account_id: int
    slug: str | None
    role: Role
    created_at: str
    settled_at: str | None


class UsernameTakenError(Exception):
    """Raised when a signup or rename collides with an existing username."""


class MembershipRoleConflictError(Exception):
    """Raised when a membership write would give one account two roles for the same
    (account_id, slug) — player and facilitator are mutually exclusive (ADR-0004). An
    account that wants both uses a second account.
    """


def _db_path() -> Path:
    return Path(os.environ.get(_ENV_VAR, _DEFAULT_DB_PATH))


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        if path not in _initialised_paths:
            _create_schema(conn)
            _initialised_paths.add(path)
        yield conn
    finally:
        conn.close()


def _create_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS accounts (
            account_id INTEGER PRIMARY KEY,
            username   TEXT    NOT NULL UNIQUE,
            email      TEXT             UNIQUE,
            pwhash     TEXT    NOT NULL,
            created_at TEXT    NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS instance_membership (
            account_id INTEGER NOT NULL,
            slug       TEXT,                        -- NULL = server-wide (facilitator only)
            role       TEXT    NOT NULL DEFAULT 'player',
            created_at TEXT    NOT NULL,             -- ISO-8601 UTC; joined_at for a player,
                                                      -- granted_at for a facilitator
            settled_at TEXT,                         -- ISO-8601 UTC; when a player settled
                                                      -- (NULL until then); unused for facilitators
            PRIMARY KEY (account_id, slug)
        )
        """
    )
    _migrate_instance_membership_columns(conn)
    _migrate_instance_membership_settled_at(conn)
    # SQLite (like standard SQL) treats every NULL as distinct in a unique index, so the PRIMARY
    # KEY above does *not* stop two server-wide (slug IS NULL) rows for the same account — a
    # partial index is the only way to make "one server-wide grant per account" a real DB
    # constraint rather than just the app-level check-then-insert in grant_facilitator(). Created
    # *after* the migration: the migration rebuilds the table under the same name (DROP + RENAME),
    # which would silently drop this index too if it were created first.
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS instance_membership_one_server_wide_row_per_account "
        "ON instance_membership (account_id) WHERE slug IS NULL"
    )
    conn.commit()


def _migrate_instance_membership_columns(conn: sqlite3.Connection) -> None:
    """One-time rebuild for an ``accounts.db`` created before the ``role`` column existed.

    The original schema had ``slug``/``settled_at`` as NOT NULL with no ``role`` column — every
    row was implicitly a player, since facilitators weren't DB rows yet, and every row was by
    construction an actual settlement (there was no "joined but not settled" state). SQLite can't
    relax a NOT NULL constraint or rename a column across versions this old, so this rebuilds the
    table: every existing row becomes ``role='player'`` with both ``created_at`` and the new
    ``settled_at`` taken from the old ``settled_at`` value, then the new table swaps in under the
    same name.
    """
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(instance_membership)")}
    if "role" in columns:
        return  # already past this generation (freshly created, or already migrated)
    conn.execute(
        """
        CREATE TABLE instance_membership_new (
            account_id INTEGER NOT NULL,
            slug       TEXT,
            role       TEXT    NOT NULL DEFAULT 'player',
            created_at TEXT    NOT NULL,
            settled_at TEXT,
            PRIMARY KEY (account_id, slug)
        )
        """
    )
    conn.execute(
        "INSERT INTO instance_membership_new (account_id, slug, role, created_at, settled_at) "
        "SELECT account_id, slug, 'player', settled_at, settled_at FROM instance_membership"
    )
    conn.execute("DROP TABLE instance_membership")
    conn.execute("ALTER TABLE instance_membership_new RENAME TO instance_membership")


def _migrate_instance_membership_settled_at(conn: sqlite3.Connection) -> None:
    """One-time column add for an ``accounts.db`` created after ``role`` existed but before the
    separate ``settled_at`` column did (#1030) — every row from that generation was, by
    construction, an actual settlement (``record_settlement`` was the only writer of a player
    row; there was no "joined but not settled" state yet). Backfill ``settled_at = created_at``
    for those rows so they don't silently read as unsettled; facilitator rows get no
    ``settled_at`` (not applicable to them). A plain ``ADD COLUMN`` suffices here — unlike
    :func:`_migrate_instance_membership_columns` above, the column is nullable so no rebuild is
    needed.
    """
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(instance_membership)")}
    if "settled_at" in columns:
        return  # already the current schema (freshly created, or already migrated)
    conn.execute("ALTER TABLE instance_membership ADD COLUMN settled_at TEXT")
    conn.execute("UPDATE instance_membership SET settled_at = created_at WHERE role = 'player'")


def init_db() -> None:
    """Eagerly create the accounts schema. Not strictly required — _connect() does this lazily."""
    with _connect() as _:
        pass


def _reset_initialised_paths() -> None:
    """Forget which DB paths have been schema-bootstrapped. For test teardown only.

    Schema creation is cached per path in ``_initialised_paths``. If a test reuses a path
    after its backing file has been deleted, the cache would skip schema creation and the
    next query would fail with an opaque "no such table". Clearing the cache between tests
    keeps lazy bootstrap honest.
    """
    _initialised_paths.clear()


def create_account(*, username: str, pwhash: str, email: str | None = None) -> int:
    """Insert a new account row and return its account_id."""
    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO accounts (username, pwhash, email, created_at) VALUES (?, ?, ?, ?)",
                (username, pwhash, email, created_at),
            )
        except sqlite3.IntegrityError as exc:
            raise UsernameTakenError(username) from exc
        conn.commit()
        assert cursor.lastrowid is not None
        return cursor.lastrowid


def get_or_create_account_id(*, username: str, pwhash: str, email: str | None = None) -> int:
    """Idempotent: insert if absent (INSERT OR IGNORE), then return account_id.

    Used by the migration script and any bootstrap caller (admin creation, players.txt).
    Does not update pwhash if the row already exists.
    """
    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO accounts (username, pwhash, email, created_at) VALUES (?, ?, ?, ?)",
            (username, pwhash, email, created_at),
        )
        conn.commit()
        row = conn.execute(
            "SELECT account_id FROM accounts WHERE username = ?",
            (username,),
        ).fetchone()
    assert row is not None
    return row["account_id"]


def delete_account(*, account_id: int) -> None:
    """Remove an account row by id. Used by signup rollback."""
    with _connect() as conn:
        conn.execute("DELETE FROM accounts WHERE account_id = ?", (account_id,))
        conn.commit()


def update_password(*, username: str, new_pwhash: str) -> None:
    """Write a new password hash for the given username. No-op if username does not exist."""
    with _connect() as conn:
        conn.execute("UPDATE accounts SET pwhash = ? WHERE username = ?", (new_pwhash, username))
        conn.commit()


def verify_password(*, username: str, password: str) -> bool:
    """Return True iff the username exists and the password matches its stored hash."""
    account = get_account_by_username(username)
    if account is None:
        return False
    return check_password_hash(plain_password=password, hashed_password=account.pwhash)


def _row_to_account(row: sqlite3.Row) -> Account:
    """Map one ``accounts`` row to an :class:`Account`. The shared row shape every read query
    below selects, so the column list and field-by-field construction live in exactly one place.
    """
    return Account(
        account_id=row["account_id"],
        username=row["username"],
        pwhash=row["pwhash"],
        email=row["email"],
        created_at=row["created_at"],
    )


def get_account_by_id(account_id: int) -> Account | None:
    """Look up an account by its immutable id. The lobby resolves the session cookie's
    ``account_id`` payload through here (ADR-0002).
    """
    with _connect() as conn:
        row = conn.execute(
            "SELECT account_id, username, pwhash, email, created_at FROM accounts WHERE account_id = ?",
            (account_id,),
        ).fetchone()
    return _row_to_account(row) if row is not None else None


def search_accounts(*, prefix: str, limit: int = 20) -> list[Account]:
    """Accounts whose username starts with ``prefix``, alphabetical, capped at ``limit``.

    Backs the facilitator roster's add control (#1022): the facilitator can only add an account
    that actually exists, so the frontend looks one up by prefix here rather than accepting a
    freeform username string. Matching is an exact-case prefix, same as :func:`get_account_by_username`'s
    exact-case equality — neither normalises case. ``prefix``'s own ``%``/``_`` characters are
    escaped so a username containing either can't accidentally act as a wildcard.
    """
    escaped = prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    with _connect() as conn:
        # SQLite's LIKE is case-insensitive for ASCII by default; case_sensitive_like matches
        # get_account_by_username's exact-case equality instead of surprising callers with
        # case-folded matches nowhere else in this module.
        conn.execute("PRAGMA case_sensitive_like = ON")
        rows = conn.execute(
            "SELECT account_id, username, pwhash, email, created_at FROM accounts "
            "WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT ?",
            (f"{escaped}%", limit),
        ).fetchall()
    return [_row_to_account(row) for row in rows]


def get_account_by_username(username: str) -> Account | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT account_id, username, pwhash, email, created_at FROM accounts WHERE username = ?",
            (username,),
        ).fetchone()
    return _row_to_account(row) if row is not None else None


def _normalise_timestamp(value: str, *, field_name: str) -> str:
    """Parse and re-render ``value`` as canonical UTC ISO-8601, so a lexicographic ``ORDER BY`` on
    the TEXT column is always chronological regardless of the offset/spelling a caller passes. A
    naive (tz-less) timestamp is a bug and fails loud rather than sorting unpredictably.
    """
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError(f"{field_name} must be timezone-aware, got naive {value!r}")
    return parsed.astimezone(timezone.utc).isoformat()


def _membership_role(conn: sqlite3.Connection, *, account_id: int, slug: str | None) -> Role | None:
    row = conn.execute(
        "SELECT role FROM instance_membership WHERE account_id = ? AND slug IS ?",
        (account_id, slug),
    ).fetchone()
    return row["role"] if row is not None else None


def _has_facilitator_conflict(conn: sqlite3.Connection, *, account_id: int, slug: str) -> bool:
    """Whether ``account_id`` already holds a facilitator grant covering ``slug`` — scoped to it
    directly, or server-wide (``slug IS NULL``). Used by :func:`record_join` and
    :func:`record_settlement`, both of which must reject a facilitator the same way
    :func:`is_facilitator` would recognise one — unlike :func:`_membership_role`'s exact-scope
    lookup, a server-wide grant has no row at this specific ``slug`` to find.
    """
    return (
        conn.execute(
            "SELECT 1 FROM instance_membership WHERE account_id = ? AND role = 'facilitator' "
            "AND (slug = ? OR slug IS NULL)",
            (account_id, slug),
        ).fetchone()
        is not None
    )


def record_join(*, account_id: int, slug: str, joined_at: str) -> None:
    """Record that ``account_id`` has joined run ``slug`` — the lobby's explicit two-click join
    (#1030), *before* settling. Idempotent (INSERT OR IGNORE): joining twice, or joining a run
    already settled in, leaves the existing row (and its ``settled_at``) untouched.

    Raises :class:`MembershipRoleConflictError` if ``account_id`` already holds a facilitator
    grant covering ``slug`` (scoped to it, or server-wide) — player and facilitator are mutually
    exclusive (ADR-0004).

    Atomic for the same reason as :func:`record_settlement` — see its docstring.
    """
    joined_at = _normalise_timestamp(joined_at, field_name="joined_at")
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if _has_facilitator_conflict(conn, account_id=account_id, slug=slug):
                raise MembershipRoleConflictError(
                    f"account {account_id} already holds a facilitator grant covering {slug!r}; cannot join as a player"
                )
            conn.execute(
                "INSERT OR IGNORE INTO instance_membership (account_id, slug, role, created_at, settled_at) "
                "VALUES (?, ?, 'player', ?, NULL)",
                (account_id, slug, joined_at),
            )
        except BaseException:
            conn.rollback()
            raise
        conn.commit()


def record_settlement(*, account_id: int, slug: str, settled_at: str) -> None:
    """Record that ``account_id`` has settled (become a player) in run ``slug``. Idempotent —
    re-settling is impossible, but the write is on the settle path so it must never raise on a
    duplicate, and a re-run of the backfill migration leaves the original ``settled_at``
    untouched. Fills in ``settled_at`` on the existing row from :func:`record_join` if there is
    one; otherwise inserts a fresh, already-settled row (the path a private run or a dev/legacy
    instance without a lobby join step still takes).

    Raises :class:`MembershipRoleConflictError` if ``account_id`` already holds a facilitator
    grant covering ``slug`` (scoped to it, or server-wide) — player and facilitator are mutually
    exclusive (ADR-0004).

    Atomic: the conflict check and the write run inside one ``BEGIN IMMEDIATE`` transaction, which
    takes SQLite's write lock upfront. Without this, a concurrent :func:`grant_facilitator` call
    could land between this function's check and its write (or vice versa) — two independent
    check-then-insert operations racing on the same row, each seeing the pre-race state as clean.
    ``BEGIN IMMEDIATE`` serializes every writer through this module, closing that window entirely
    rather than narrowing it.
    """
    settled_at = _normalise_timestamp(settled_at, field_name="settled_at")
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if _has_facilitator_conflict(conn, account_id=account_id, slug=slug):
                raise MembershipRoleConflictError(
                    f"account {account_id} already holds a facilitator grant covering {slug!r}; cannot settle as a player"
                )
            existing_role = _membership_role(conn, account_id=account_id, slug=slug)
            if existing_role == "player":
                # Already has a row — either joined-not-settled (fill in settled_at) or already
                # settled (COALESCE leaves the original timestamp untouched, matching the old
                # INSERT OR IGNORE's idempotence).
                conn.execute(
                    "UPDATE instance_membership SET settled_at = COALESCE(settled_at, ?) "
                    "WHERE account_id = ? AND slug = ?",
                    (settled_at, account_id, slug),
                )
            else:
                conn.execute(
                    "INSERT INTO instance_membership (account_id, slug, role, created_at, settled_at) "
                    "VALUES (?, ?, 'player', ?, ?)",
                    (account_id, slug, settled_at, settled_at),
                )
        except BaseException:
            conn.rollback()
            raise
        conn.commit()


def grant_facilitator(*, account_id: int, slug: str | None, granted_at: str | None = None) -> None:
    """Grant ``account_id`` facilitator authority — server-wide if ``slug`` is ``None``, else
    scoped to that one instance. The only path to becoming a facilitator (``scripts/grant-
    facilitator.py``, run by a sysadmin from the shell); there is no in-app grant flow.

    Idempotent if the account is already a facilitator at this exact scope. Raises
    :class:`MembershipRoleConflictError` if the account already has a player membership that
    this grant would conflict with — the same-slug row for an instance grant, or any player row
    at all for a server-wide grant.

    Atomic like :func:`record_settlement` — see its docstring for why the whole check + insert
    runs inside one ``BEGIN IMMEDIATE`` transaction rather than a plain check-then-insert. The
    partial unique index on ``slug IS NULL`` (``_create_schema``) is a second, DB-level backstop
    specifically for two concurrent server-wide grants for the same account, in case anything
    ever writes to this table outside these two functions.
    """
    granted_at = _normalise_timestamp(granted_at or datetime.now(timezone.utc).isoformat(), field_name="granted_at")
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            conflict_query = (
                "SELECT 1 FROM instance_membership WHERE account_id = ? AND role = 'player'"
                if slug is None
                else "SELECT 1 FROM instance_membership WHERE account_id = ? AND slug = ? AND role = 'player'"
            )
            conflict_params = (account_id,) if slug is None else (account_id, slug)
            if conn.execute(conflict_query, conflict_params).fetchone():
                raise MembershipRoleConflictError(
                    f"account {account_id} already has a player membership conflicting with a facilitator grant for {slug!r}"
                )
            existing = _membership_role(conn, account_id=account_id, slug=slug)
            if existing != "facilitator":
                conn.execute(
                    "INSERT INTO instance_membership (account_id, slug, role, created_at) VALUES (?, ?, 'facilitator', ?)",
                    (account_id, slug, granted_at),
                )
        except BaseException:
            conn.rollback()
            raise
        conn.commit()


def is_facilitator(*, account_id: int, slug: str | None) -> bool:
    """Whether ``account_id`` holds a facilitator grant covering ``slug`` — either scoped to it
    directly, or server-wide (``slug IS NULL`` in the stored row). This is the single source of
    truth every facilitator-only route checks; there is no per-instance object to consult.
    """
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM instance_membership WHERE account_id = ? AND role = 'facilitator' "
            "AND (slug IS NULL OR slug = ?)",
            (account_id, slug),
        ).fetchone()
    return row is not None


def get_memberships(*, account_id: int) -> list[Membership]:
    """Return the runs ``account_id`` has joined as a player — settled or not — most recently
    joined first.

    Facilitator grants are excluded — this backs the lobby's "your runs" list, which is about
    play, not administration. A joined-but-not-yet-settled run is included (``settled_at is
    None``): joining is the deliberate act that puts a run under "your runs" (#1030), settling is
    a later, separate step. Rows for runs later deleted are tolerated here (stale rows) — the
    caller filters them against the on-disk fragments, matching the RFC's stale-fragment stance.
    """
    with _connect() as conn:
        rows = conn.execute(
            "SELECT account_id, slug, role, created_at, settled_at FROM instance_membership "
            "WHERE account_id = ? AND role = 'player' ORDER BY created_at DESC",
            (account_id,),
        ).fetchall()
    return [
        Membership(
            account_id=row["account_id"],
            slug=row["slug"],
            role=row["role"],
            created_at=row["created_at"],
            settled_at=row["settled_at"],
        )
        for row in rows
    ]


def has_joined(*, account_id: int, slug: str) -> bool:
    """Whether ``account_id`` has joined run ``slug`` as a player — settled or not.

    The private-run entry gate's access check (#1030 follow-up): a private instance's
    ``access`` policy no longer carries its own allowlist (``instance.json``'s
    ``allowed_usernames`` is deprecated), this table is the sole source of truth for who may
    enter. Does not consider facilitator grants — a facilitator bypasses this check entirely at
    the call site (:func:`is_facilitator`), it doesn't need to appear "joined".
    """
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM instance_membership WHERE account_id = ? AND slug = ? AND role = 'player'",
            (account_id, slug),
        ).fetchone()
    return row is not None


def remove_membership(*, account_id: int, slug: str) -> None:
    """Remove ``account_id``'s player membership in run ``slug`` outright — the roster's
    ban/remove. Idempotent: a no-op if there was no row. Never touches a facilitator row
    (scoped to ``role = 'player'``).

    Deletes the row entirely rather than marking it revoked: a banned account's next entry
    attempt is denied by :func:`has_joined` finding no row, but this does not touch any
    ``Player`` already created in that run's engine — an already-settled, later-banned account
    keeps its game state (tile, resources, facilities — none of it lives in this table, or is
    affected by this delete), it just can't re-enter (matching the roster's documented
    "revocation is eventual" behaviour). A plain :func:`record_join` on re-add would otherwise
    come back with ``settled_at`` null again even though the ``Player`` never went anywhere —
    every caller that can re-add a possibly-already-settled account uses
    :func:`energetica.utils.misc.record_join_reconciling_settlement` instead, which backfills
    ``settled_at`` from the engine's ``Player`` right after the join write.
    """
    with _connect() as conn:
        conn.execute(
            "DELETE FROM instance_membership WHERE account_id = ? AND slug = ? AND role = 'player'",
            (account_id, slug),
        )
        conn.commit()


@dataclass(frozen=True)
class RosterEntry:
    """One player's row on a run's roster, with the account's username resolved — the shape the
    facilitator roster page reads (:func:`get_run_roster`).
    """

    username: str
    joined_at: str
    settled_at: str | None


def get_run_roster(*, slug: str) -> list[RosterEntry]:
    """Every player membership for run ``slug``, with each account's username resolved —
    most recently joined first. Backs the facilitator roster page's Joined/Invited split
    (``settled_at is None`` ⟺ invited-not-yet-settled).
    """
    with _connect() as conn:
        rows = conn.execute(
            "SELECT a.username, m.created_at, m.settled_at FROM instance_membership m "
            "JOIN accounts a ON a.account_id = m.account_id "
            "WHERE m.slug = ? AND m.role = 'player' ORDER BY m.created_at DESC",
            (slug,),
        ).fetchall()
    return [
        RosterEntry(username=row["username"], joined_at=row["created_at"], settled_at=row["settled_at"]) for row in rows
    ]
