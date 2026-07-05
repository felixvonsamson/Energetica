"""Server-wide accounts: SQLite-backed identity store shared across instances.

Credentials (username, pwhash, optional email) live in a single SQLite file on the VPS,
keyed by ``account_id``. Each instance's pickle ``User`` references this id as a foreign
key. See ``docs/architecture/static-serving-and-deployment.md`` § Server-Wide Accounts.
"""

from __future__ import annotations

from energetica.accounts.db import (
    Account,
    Membership,
    UsernameTakenError,
    create_account,
    delete_account,
    get_account_by_id,
    get_account_by_username,
    get_memberships,
    get_or_create_account_id,
    init_db,
    record_membership,
    update_password,
    verify_password,
)

__all__ = [
    "Account",
    "Membership",
    "UsernameTakenError",
    "create_account",
    "delete_account",
    "get_account_by_id",
    "get_account_by_username",
    "get_memberships",
    "get_or_create_account_id",
    "init_db",
    "record_membership",
    "update_password",
    "verify_password",
]
