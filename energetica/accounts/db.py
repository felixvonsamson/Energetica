"""SQLite-backed accounts store. Connection-per-call; WAL for concurrent readers."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from energetica.utils.auth import check_password_hash

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


class UsernameTakenError(Exception):
    """Raised when a signup or rename collides with an existing username."""


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
    conn.commit()


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


def get_account_by_username(username: str) -> Account | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT account_id, username, pwhash, email, created_at FROM accounts WHERE username = ?",
            (username,),
        ).fetchone()
    if row is None:
        return None
    return Account(
        account_id=row["account_id"],
        username=row["username"],
        pwhash=row["pwhash"],
        email=row["email"],
        created_at=row["created_at"],
    )
