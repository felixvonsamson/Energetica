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
    """One account's relationship to one run: either a settled player or a granted
    facilitator, never both (see ADR-0004) — ``slug`` is ``None`` only for a server-wide
    facilitator grant, never for a player row.
    """

    account_id: int
    slug: str | None
    role: Role
    created_at: str


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
            created_at TEXT    NOT NULL,             -- ISO-8601 UTC; settled_at for a player,
                                                      -- granted_at for a facilitator
            PRIMARY KEY (account_id, slug)
        )
        """
    )
    # SQLite (like standard SQL) treats every NULL as distinct in a unique index, so the PRIMARY
    # KEY above does *not* stop two server-wide (slug IS NULL) rows for the same account — a
    # partial index is the only way to make "one server-wide grant per account" a real DB
    # constraint rather than just the app-level check-then-insert in grant_facilitator().
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS instance_membership_one_server_wide_row_per_account "
        "ON instance_membership (account_id) WHERE slug IS NULL"
    )
    _migrate_instance_membership_columns(conn)
    conn.commit()


def _migrate_instance_membership_columns(conn: sqlite3.Connection) -> None:
    """One-time rebuild for an ``accounts.db`` created before the ``role`` column existed.

    The original schema had ``slug``/``settled_at`` as NOT NULL with no ``role`` column — every
    row was implicitly a player, since facilitators weren't DB rows yet. SQLite can't relax a
    NOT NULL constraint or rename a column across versions this old, so this rebuilds the table:
    every existing row becomes ``role='player'`` with ``created_at`` taken from the old
    ``settled_at``, then the new table swaps in under the same name.
    """
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(instance_membership)")}
    if "role" in columns:
        return  # already the current schema (freshly created, or already migrated)
    conn.execute(
        """
        CREATE TABLE instance_membership_new (
            account_id INTEGER NOT NULL,
            slug       TEXT,
            role       TEXT    NOT NULL DEFAULT 'player',
            created_at TEXT    NOT NULL,
            PRIMARY KEY (account_id, slug)
        )
        """
    )
    conn.execute(
        "INSERT INTO instance_membership_new (account_id, slug, role, created_at) "
        "SELECT account_id, slug, 'player', settled_at FROM instance_membership"
    )
    conn.execute("DROP TABLE instance_membership")
    conn.execute("ALTER TABLE instance_membership_new RENAME TO instance_membership")


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


def record_settlement(*, account_id: int, slug: str, settled_at: str) -> None:
    """Record that ``account_id`` has settled (become a player) in run ``slug``. Idempotent
    (INSERT OR IGNORE) — re-settling is impossible, but the write is on the settle path so it must
    never raise on a duplicate, and a re-run of the backfill migration leaves the original
    ``settled_at`` untouched.

    Raises :class:`MembershipRoleConflictError` if ``account_id`` already holds a facilitator
    grant covering ``slug`` (scoped to it, or server-wide) — player and facilitator are mutually
    exclusive (ADR-0004).
    """
    settled_at = _normalise_timestamp(settled_at, field_name="settled_at")
    with _connect() as conn:
        if conn.execute(
            "SELECT 1 FROM instance_membership WHERE account_id = ? AND role = 'facilitator' "
            "AND (slug = ? OR slug IS NULL)",
            (account_id, slug),
        ).fetchone():
            raise MembershipRoleConflictError(
                f"account {account_id} already holds a facilitator grant covering {slug!r}; cannot settle as a player"
            )
        conn.execute(
            "INSERT OR IGNORE INTO instance_membership (account_id, slug, role, created_at) VALUES (?, ?, 'player', ?)",
            (account_id, slug, settled_at),
        )
        conn.commit()


def grant_facilitator(*, account_id: int, slug: str | None, granted_at: str | None = None) -> None:
    """Grant ``account_id`` facilitator authority — server-wide if ``slug`` is ``None``, else
    scoped to that one instance. The only path to becoming a facilitator (``scripts/grant-
    facilitator.py``, run by a sysadmin from the shell); there is no in-app grant flow.

    Idempotent if the account is already a facilitator at this exact scope. Raises
    :class:`MembershipRoleConflictError` if the account already has a player membership that
    this grant would conflict with — the same-slug row for an instance grant, or any player row
    at all for a server-wide grant.
    """
    granted_at = _normalise_timestamp(granted_at or datetime.now(timezone.utc).isoformat(), field_name="granted_at")
    with _connect() as conn:
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
        if existing == "facilitator":
            return  # already granted at this exact scope
        try:
            conn.execute(
                "INSERT INTO instance_membership (account_id, slug, role, created_at) VALUES (?, ?, 'facilitator', ?)",
                (account_id, slug, granted_at),
            )
        except sqlite3.IntegrityError:
            # Lost a race with a concurrent grant for the same account (the partial unique index
            # on slug IS NULL catches what the (account_id, slug) primary key can't, since SQLite
            # treats every NULL as distinct there) — the other grant already won, so this is a
            # no-op, not a failure.
            return
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
    """Return the runs ``account_id`` has settled in as a player, most recently settled first.

    Facilitator grants are excluded — this backs the lobby's "your runs" list, which is about
    play, not administration. Rows for runs later deleted are tolerated here (stale rows) — the
    caller filters them against the on-disk fragments, matching the RFC's stale-fragment stance.
    """
    with _connect() as conn:
        rows = conn.execute(
            "SELECT account_id, slug, role, created_at FROM instance_membership "
            "WHERE account_id = ? AND role = 'player' ORDER BY created_at DESC",
            (account_id,),
        ).fetchall()
    return [
        Membership(account_id=row["account_id"], slug=row["slug"], role=row["role"], created_at=row["created_at"])
        for row in rows
    ]
