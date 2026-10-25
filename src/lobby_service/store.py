"""
The SQL behind the lobby service's API: accounts, memberships and facilitator grants in ``lobby.db``.

Each function opens its own connection. Connections use SQLite's write-ahead log (WAL), a journal
mode in which reads never wait for a write to finish. The schema is the one
:func:`lobby_service.schema.upgrade_database` brought the file to at start-up; this module never
creates or changes tables.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

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
