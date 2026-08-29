"""Server-wide accounts: SQLite-backed identity store shared across instances.

Credentials (username, pwhash, optional email) live in a single SQLite file on the VPS,
keyed by ``account_id``. Each instance's settled ``Player`` references this id as a foreign
key. See ``docs/architecture/static-serving-and-deployment.md`` § Server-Wide Accounts and
``docs/adr/0004-role-taxonomy-and-admin-authority.md`` for the ``role`` column on
``instance_membership`` that this module also exposes (``grant_facilitator``, ``is_facilitator``).
"""

from __future__ import annotations

from energetica.accounts.db import (
    Account,
    Membership,
    MembershipRoleConflictError,
    Role,
    UsernameTakenError,
    create_account,
    delete_account,
    get_account_by_id,
    get_account_by_username,
    get_memberships,
    get_or_create_account_id,
    grant_facilitator,
    init_db,
    is_facilitator,
    record_settlement,
    search_accounts,
    update_password,
    verify_password,
)

__all__ = [
    "Account",
    "Membership",
    "MembershipRoleConflictError",
    "Role",
    "UsernameTakenError",
    "create_account",
    "delete_account",
    "get_account_by_id",
    "get_account_by_username",
    "get_memberships",
    "get_or_create_account_id",
    "grant_facilitator",
    "init_db",
    "is_facilitator",
    "record_settlement",
    "search_accounts",
    "update_password",
    "verify_password",
]
