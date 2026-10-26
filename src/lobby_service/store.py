"""
The SQL behind the lobby service's API: accounts, memberships, facilitator grants and runs in
``lobby.db``.

Each function opens its own connection. Connections use SQLite's write-ahead log (WAL), a journal
mode in which reads never wait for a write to finish. The schema is the one
:func:`lobby_service.schema.upgrade_database` brought the file to at start-up; this module never
creates or changes tables.
"""

from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, fields, replace
from datetime import datetime, timezone
from typing import Any, Literal

from lobby_service.config import db_path

Role = Literal["player", "facilitator"]


@dataclass(frozen=True)
class Account:
    account_id: int
    username: str
    pwhash: str
    email: str | None
    created_at: str


@dataclass(frozen=True)
class Membership:
    """
    A player membership or a run-scoped facilitator grant. ``created_at`` is when the account
    joined, or when the grant was made.
    """

    slug: str
    created_at: str


@dataclass(frozen=True)
class Member:
    account_id: int
    username: str
    joined_at: str


class UsernameTakenError(Exception):
    """Raised when a new account's username is already in use."""


class MembershipRoleConflictError(Exception):
    """
    Raised when a write would give one account two roles for the same run. Player and
    facilitator are mutually exclusive (ADR-0004); an account that wants both uses a second account.
    """


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        yield conn
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_account(row: sqlite3.Row) -> Account:
    return Account(
        account_id=row["account_id"],
        username=row["username"],
        pwhash=row["pwhash"],
        email=row["email"],
        created_at=row["created_at"],
    )


_ACCOUNT_COLUMNS = "account_id, username, pwhash, email, created_at"


def create_account(*, username: str, pwhash: str) -> int:
    """Insert a new account and return its ``account_id``."""
    with _connect() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO accounts (username, pwhash, created_at) VALUES (?, ?, ?)", (username, pwhash, _now())
            )
        except sqlite3.IntegrityError as exc:
            raise UsernameTakenError(username) from exc
        conn.commit()
        assert cursor.lastrowid is not None
        return cursor.lastrowid


def get_account_by_id(account_id: int) -> Account | None:
    with _connect() as conn:
        row = conn.execute(f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE account_id = ?", (account_id,)).fetchone()
    return _row_to_account(row) if row is not None else None


def get_account_by_username(username: str) -> Account | None:
    with _connect() as conn:
        row = conn.execute(f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE username = ?", (username,)).fetchone()
    return _row_to_account(row) if row is not None else None


def search_accounts(*, prefix: str, limit: int) -> list[Account]:
    """
    Accounts whose username starts with ``prefix``, alphabetical, at most ``limit`` of them.

    Exact-case, like :func:`get_account_by_username`. The prefix's own ``%`` and ``_`` are escaped
    so they match literally.
    """
    escaped = prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    with _connect() as conn:
        # SQLite's LIKE ignores ASCII case by default.
        conn.execute("PRAGMA case_sensitive_like = ON")
        rows = conn.execute(
            f"SELECT {_ACCOUNT_COLUMNS} FROM accounts WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT ?",
            (f"{escaped}%", limit),
        ).fetchall()
    return [_row_to_account(row) for row in rows]


def update_password(*, account_id: int, pwhash: str) -> None:
    with _connect() as conn:
        conn.execute("UPDATE accounts SET pwhash = ? WHERE account_id = ?", (pwhash, account_id))
        conn.commit()


def _has_facilitator_grant(conn: sqlite3.Connection, *, account_id: int, slug: str | None) -> bool:
    """
    Whether a facilitator grant covers ``slug``: one scoped to it, or a server-wide one. With
    ``slug=None``, only a server-wide grant counts.
    """
    return (
        conn.execute(
            "SELECT 1 FROM instance_membership WHERE account_id = ? AND role = 'facilitator' "
            "AND (slug IS NULL OR slug = ?)",
            (account_id, slug),
        ).fetchone()
        is not None
    )


def is_facilitator(*, account_id: int, slug: str | None) -> bool:
    with _connect() as conn:
        return _has_facilitator_grant(conn, account_id=account_id, slug=slug)


def has_joined(*, account_id: int, slug: str) -> bool:
    """Whether ``account_id`` has joined run ``slug`` as a player. Facilitator grants do not count."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM instance_membership WHERE account_id = ? AND slug = ? AND role = 'player'",
            (account_id, slug),
        ).fetchone()
    return row is not None


def add_member(*, account_id: int, slug: str) -> None:
    """
    Record that ``account_id`` has joined run ``slug``. Idempotent: joining again leaves the
    existing row alone.

    Raises :class:`MembershipRoleConflictError` if a facilitator grant covers ``slug``. The check
    and the write share one ``BEGIN IMMEDIATE`` transaction, which takes the write lock up front, so
    a grant cannot land between them.
    """
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if _has_facilitator_grant(conn, account_id=account_id, slug=slug):
                raise MembershipRoleConflictError(
                    f"account {account_id} holds a facilitator grant covering {slug!r}; cannot join as a player"
                )
            conn.execute(
                "INSERT OR IGNORE INTO instance_membership (account_id, slug, role, created_at) "
                "VALUES (?, ?, 'player', ?)",
                (account_id, slug, _now()),
            )
        except BaseException:
            conn.rollback()
            raise
        conn.commit()


def remove_member(*, account_id: int, slug: str) -> None:
    """
    Remove ``account_id``'s player membership in run ``slug``. Idempotent. Never touches a
    facilitator grant.
    """
    with _connect() as conn:
        conn.execute(
            "DELETE FROM instance_membership WHERE account_id = ? AND slug = ? AND role = 'player'",
            (account_id, slug),
        )
        conn.commit()


def get_run_members(*, slug: str) -> list[Member]:
    """Every account that has joined run ``slug`` as a player, most recently joined first."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT a.account_id, a.username, m.created_at FROM instance_membership m "
            "JOIN accounts a ON a.account_id = m.account_id "
            "WHERE m.slug = ? AND m.role = 'player' ORDER BY m.created_at DESC",
            (slug,),
        ).fetchall()
    return [Member(account_id=row[0], username=row[1], joined_at=row[2]) for row in rows]


def grant_facilitator(*, account_id: int, slug: str | None) -> None:
    """
    Grant ``account_id`` facilitator authority over run ``slug``, or over every run if ``slug``
    is ``None``. Idempotent at the same scope.

    Raises :class:`MembershipRoleConflictError` if the account is a player in that run, or, for a
    server-wide grant, in any run. Atomic like :func:`add_member`. The partial unique index on
    ``slug IS NULL`` also stops two server-wide rows for one account at the database level.
    """
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if slug is None:
                conflict = conn.execute(
                    "SELECT 1 FROM instance_membership WHERE account_id = ? AND role = 'player'", (account_id,)
                ).fetchone()
            else:
                conflict = conn.execute(
                    "SELECT 1 FROM instance_membership WHERE account_id = ? AND slug = ? AND role = 'player'",
                    (account_id, slug),
                ).fetchone()
            if conflict:
                raise MembershipRoleConflictError(
                    f"account {account_id} is a player where a facilitator grant for {slug!r} would apply"
                )
            existing = conn.execute(
                "SELECT 1 FROM instance_membership WHERE account_id = ? AND slug IS ? AND role = 'facilitator'",
                (account_id, slug),
            ).fetchone()
            if existing is None:
                conn.execute(
                    "INSERT INTO instance_membership (account_id, slug, role, created_at) VALUES (?, ?, 'facilitator', ?)",
                    (account_id, slug, _now()),
                )
        except BaseException:
            conn.rollback()
            raise
        conn.commit()


def get_memberships(*, account_id: int, role: Role) -> list[Membership]:
    """
    The runs ``account_id`` has joined (``role="player"``) or holds a run-scoped grant for
    (``role="facilitator"``), most recent first. A server-wide grant is not tied to a run, so it is
    left out. Rows for runs since deleted are included; callers drop them.
    """
    with _connect() as conn:
        rows = conn.execute(
            "SELECT slug, created_at FROM instance_membership "
            "WHERE account_id = ? AND role = ? AND slug IS NOT NULL ORDER BY created_at DESC",
            (account_id, role),
        ).fetchall()
    return [Membership(slug=row["slug"], created_at=row["created_at"]) for row in rows]


# --- runs -------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Run:
    """A run's config: one row of ``runs``."""

    slug: str
    name: str
    mode: str
    advertised: bool
    access_policy: str
    join_token: str | None
    join_open: bool
    starts_at: datetime
    freeze_at: datetime | None
    ended_at: datetime | None
    created_at: str


EDITABLE_RUN_FIELDS = frozenset(
    {"name", "advertised", "access_policy", "join_token", "join_open", "starts_at", "freeze_at", "ended_at"}
)
"""The fields a run write may change. ``slug`` and ``mode`` are fixed when the run is created."""

_CLEARABLE_RUN_FIELDS = frozenset({"join_token", "freeze_at", "ended_at"})
"""The editable fields a write may set to ``None``. Every other one always has a value."""

# The rule ``setup-instance.sh`` applies. "landing" and "lobby" name the apex site and the lobby,
# which share the namespace of run subdomains and directories.
_SLUG_PATTERN = re.compile(r"[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?")
_RESERVED_SLUGS = frozenset({"landing", "lobby"})

_RUN_COLUMNS = (
    "slug, name, mode, advertised, access_policy, join_token, join_open, starts_at, freeze_at, ended_at, created_at"
)


class RunNotFoundError(Exception):
    """Raised when no run has the given slug."""


class RunExistsError(Exception):
    """Raised when creating a run whose slug is already taken."""


class InvalidRunError(Exception):
    """Raised when a write would store an invalid run. The message says what is wrong."""


class RunHasMembersError(Exception):
    """Raised when deleting a run that still has memberships, unless they are to be deleted too."""

    def __init__(self, slug: str, count: int) -> None:
        super().__init__(f"run {slug!r} still has {count} membership(s) or facilitator grant(s)")
        self.count = count


def format_timestamp(value: datetime) -> str:
    """
    A run timestamp as ``runs`` stores it: UTC, to the second, with a ``+00:00`` offset.

    Every run timestamp is written in this one format, so the table's ``CHECK``s can compare them
    as text.
    """
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


def _parse_timestamp(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value is not None else None


def _row_to_run(row: sqlite3.Row) -> Run:
    return Run(
        slug=row["slug"],
        name=row["name"],
        mode=row["mode"],
        advertised=bool(row["advertised"]),
        access_policy=row["access_policy"],
        join_token=row["join_token"],
        join_open=bool(row["join_open"]),
        starts_at=datetime.fromisoformat(row["starts_at"]),
        freeze_at=_parse_timestamp(row["freeze_at"]),
        ended_at=_parse_timestamp(row["ended_at"]),
        created_at=row["created_at"],
    )


def _normalised(run: Run) -> Run:
    """``run`` with its timestamps as they will read back once stored: UTC, to the second."""
    return replace(
        run,
        **{
            name: datetime.fromisoformat(format_timestamp(value))
            for name in ("starts_at", "freeze_at", "ended_at")
            if (value := getattr(run, name)) is not None
        },
    )


def _check_run(run: Run) -> None:
    """
    Raise :class:`InvalidRunError` if ``run`` must not be stored. The table's constraints back up
    some of these checks, but only these give a message an operator can act on.
    """
    if not run.name.strip():
        raise InvalidRunError("the name must not be empty")
    present = [
        (name, value)
        for name, value in (("starts_at", run.starts_at), ("freeze_at", run.freeze_at), ("ended_at", run.ended_at))
        if value is not None
    ]
    for (earlier_name, earlier), (later_name, later) in zip(present, present[1:]):
        if later < earlier:
            raise InvalidRunError(
                f"{later_name} ({later.isoformat()}) is before {earlier_name} ({earlier.isoformat()})"
            )
    if run.access_policy != "private" and (run.join_token is not None or run.join_open):
        raise InvalidRunError("only a private run can have a join token or an open join link")
    if run.join_token is not None and not run.join_token.strip():
        raise InvalidRunError("the join token must not be empty")


def _get_run(conn: sqlite3.Connection, slug: str) -> Run | None:
    row = conn.execute(f"SELECT {_RUN_COLUMNS} FROM runs WHERE slug = ?", (slug,)).fetchone()
    return _row_to_run(row) if row is not None else None


def _write_run(conn: sqlite3.Connection, run: Run, *, insert: bool) -> None:
    """
    Insert ``run``'s row, or update the existing row with its slug. A join token another run
    already uses is refused.

    Never ``INSERT OR REPLACE``: on a clash of join tokens, that deletes the other run's row.
    """
    editable = {
        "name": run.name,
        "advertised": int(run.advertised),
        "access_policy": run.access_policy,
        "join_token": run.join_token,
        "join_open": int(run.join_open),
        "starts_at": format_timestamp(run.starts_at),
        "freeze_at": format_timestamp(run.freeze_at) if run.freeze_at is not None else None,
        "ended_at": format_timestamp(run.ended_at) if run.ended_at is not None else None,
    }
    try:
        if insert:
            row = {"slug": run.slug, "mode": run.mode, "created_at": run.created_at, **editable}
            conn.execute(
                f"INSERT INTO runs ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", tuple(row.values())
            )
        else:
            conn.execute(
                f"UPDATE runs SET {', '.join(f'{column} = ?' for column in editable)} WHERE slug = ?",
                (*editable.values(), run.slug),
            )
    except sqlite3.IntegrityError as exc:
        if "runs.join_token" in str(exc):
            raise InvalidRunError("another run already uses this join token") from exc
        raise


def list_runs() -> list[Run]:
    """Every run, the latest to start first."""
    with _connect() as conn:
        rows = conn.execute(f"SELECT {_RUN_COLUMNS} FROM runs ORDER BY starts_at DESC, slug").fetchall()
    return [_row_to_run(row) for row in rows]


def get_run(slug: str) -> Run | None:
    with _connect() as conn:
        return _get_run(conn, slug)


def create_run(
    *,
    slug: str,
    name: str,
    mode: str,
    advertised: bool,
    access_policy: str,
    join_token: str | None,
    join_open: bool,
    starts_at: datetime,
    freeze_at: datetime | None,
    ended_at: datetime | None,
) -> Run:
    """
    Create a run and return it as stored. Raises :class:`RunExistsError` if the slug is taken,
    and :class:`InvalidRunError` if the run is invalid.
    """
    if _SLUG_PATTERN.fullmatch(slug) is None:
        raise InvalidRunError(
            f"{slug!r} is not a valid slug: use lowercase letters, digits and inner hyphens, at most 63 characters"
        )
    if slug in _RESERVED_SLUGS:
        raise InvalidRunError(f"{slug!r} is reserved")
    run = _normalised(
        Run(
            slug=slug,
            name=name,
            mode=mode,
            advertised=advertised,
            access_policy=access_policy,
            join_token=join_token,
            join_open=join_open,
            starts_at=starts_at,
            freeze_at=freeze_at,
            ended_at=ended_at,
            created_at=_now(),
        )
    )
    _check_run(run)
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if _get_run(conn, slug) is not None:
                raise RunExistsError(slug)
            _write_run(conn, run, insert=True)
        except BaseException:
            conn.rollback()
            raise
        conn.commit()
    return run


def update_run(slug: str, changes: Mapping[str, Any]) -> tuple[Run, Run]:
    """
    Apply ``changes`` (field name to new value) to a run, and return it before and after.

    The read, the check and the write share one ``BEGIN IMMEDIATE`` transaction, so the run is
    checked whole, as it will be stored. Raises :class:`RunNotFoundError` or
    :class:`InvalidRunError`.
    """
    unknown = set(changes) - EDITABLE_RUN_FIELDS
    if unknown:
        raise InvalidRunError(f"cannot change {', '.join(sorted(unknown))}")
    cleared = sorted(field for field, value in changes.items() if value is None and field not in _CLEARABLE_RUN_FIELDS)
    if cleared:
        raise InvalidRunError(f"cannot clear {', '.join(cleared)}")
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            before = _get_run(conn, slug)
            if before is None:
                raise RunNotFoundError(slug)
            after = _normalised(replace(before, **changes))
            _check_run(after)
            _write_run(conn, after, insert=False)
        except BaseException:
            conn.rollback()
            raise
        conn.commit()
    return before, after


def get_or_create_join_token(slug: str, new_token: str) -> tuple[Run, Run]:
    """
    Give a private run the join token ``new_token`` if it has none yet, and return the run before
    and after. A run that already has one keeps it, so before and after are the same. Raises
    :class:`RunNotFoundError`, or :class:`InvalidRunError` for a public run.
    """
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            before = _get_run(conn, slug)
            if before is None:
                raise RunNotFoundError(slug)
            after = before
            if before.join_token is None:
                after = replace(before, join_token=new_token)
                _check_run(after)
                _write_run(conn, after, insert=False)
        except BaseException:
            conn.rollback()
            raise
        conn.commit()
    return before, after


def delete_run(slug: str, *, with_members: bool) -> Run:
    """
    Delete a run and return it as it was.

    The run's memberships and run-scoped facilitator grants go in the same transaction if
    ``with_members``; otherwise any of them refuses the delete with :class:`RunHasMembersError`.
    Raises :class:`RunNotFoundError`.
    """
    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            run = _get_run(conn, slug)
            if run is None:
                raise RunNotFoundError(slug)
            count = conn.execute("SELECT COUNT(*) FROM instance_membership WHERE slug = ?", (slug,)).fetchone()[0]
            if count and not with_members:
                raise RunHasMembersError(slug, count)
            conn.execute("DELETE FROM instance_membership WHERE slug = ?", (slug,))
            conn.execute("DELETE FROM runs WHERE slug = ?", (slug,))
        except BaseException:
            conn.rollback()
            raise
        conn.commit()
    return run


def changed_run_fields(before: Run | None, after: Run | None) -> dict[str, tuple[Any, Any]]:
    """Each field that differs between two versions of a run, as ``(old, new)``. ``None`` is no run."""
    changes = {}
    for field in fields(Run):
        old = getattr(before, field.name) if before is not None else None
        new = getattr(after, field.name) if after is not None else None
        if old != new and field.name != "created_at":
            changes[field.name] = (old, new)
    return changes
