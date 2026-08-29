#!/usr/bin/env python3
"""Grant an existing account facilitator authority (ADR-0004).

There is no in-app path to becoming a facilitator: this is the *only* way, run by a sysadmin
over SSH. Grant-only by design — no revoke command yet (YAGNI: a deployment has roughly one
long-lived facilitator per short-lived instance; add revoke the day it's actually needed).

Usage:
    python scripts/grant-facilitator.py --username <username> [--slug <slug>] \
        [--accounts-db <path>]

If --slug is omitted, the grant is server-wide (facilitator over every instance) — see
docs/architecture/roles.md § How elevated access is granted. If --accounts-db is omitted it
defaults to the production path /var/lib/energetica/accounts.db (this is a production-only
tool, so it pins the prod path rather than inheriting db.py's dev default).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--username", required=True, help="Username of the account to grant facilitator authority to.")
    parser.add_argument(
        "--slug",
        default=None,
        help="Instance slug to scope the grant to. Omit for a server-wide grant (every instance).",
    )
    parser.add_argument(
        "--accounts-db",
        type=Path,
        default=Path("/var/lib/energetica/accounts.db"),
        help="Path to accounts.db (default: the production path /var/lib/energetica/accounts.db).",
    )
    args = parser.parse_args()

    # Pin the resolved path into the env the accounts library reads, so this prod tool never
    # inherits db.py's dev-oriented default.
    os.environ["ENERGETICA_ACCOUNTS_DB_PATH"] = str(args.accounts_db)

    # This script lives in scripts/, not the repo root, so the interpreter's default sys.path
    # (the script's own directory) never includes the repo root — `energetica` isn't installed
    # into the venv as a package, so importing it needs the repo root added explicitly.
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from energetica import accounts

    account = accounts.get_account_by_username(args.username)
    if account is None:
        print(f"ERROR: no account found for username {args.username!r}", file=sys.stderr)
        return 1

    try:
        accounts.grant_facilitator(account_id=account.account_id, slug=args.slug)
    except accounts.MembershipRoleConflictError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    scope = "server-wide (every instance)" if args.slug is None else f"instance {args.slug!r}"
    print(f"Granted {args.username!r} facilitator authority, {scope}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
