#!/usr/bin/env python3
"""One-time per-instance migration: backfill accounts.db from a private run's deprecated
instance.json allowlist (#1030 follow-up, ADR-0006).

Who may access a private run now lives in accounts.db's instance_membership table
(accounts.record_join), the same place a settled Player's membership and a facilitator grant
already live — not instance.json's allowed_usernames, which the backend no longer reads. Any
instance whose instance.json still carries allowed_usernames from before this change needs this
run once so its existing invitees keep their access. Idempotent (record_join is INSERT OR
IGNORE) — safe to re-run, and a no-op for an instance with nothing on its old allowlist.

An allowlisted username with no matching server-wide account (a typo, or an account since
deleted) is reported and skipped rather than failing the whole run — there is nothing to grant
without an account to grant it to.

Deploy order: run this once, after the code that reads accounts.db instead of allowed_usernames
is live, against each already-deployed *private* instance. A freshly-provisioned instance has
nothing to migrate. Does not touch or clear instance.json — the deprecated field is inert once
this has run; a sysadmin may strip it by hand later, or leave it (see
instance_config.PrivateAccess's docstring).

Usage:
    python scripts/migrate-allowed-usernames.py --slug <slug> \
        [--config-dir <dir>] [--accounts-db <path>] [--dry-run]

If --config-dir is omitted it defaults to /etc/energetica (the production instance-config root).
If --accounts-db is omitted it defaults to the production path /var/lib/energetica/accounts.db
(this is a production-only tool, so it pins the prod path rather than inheriting db.py's dev
default).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def migrate(usernames: list[str], *, slug: str, dry_run: bool = False) -> tuple[int, list[str]]:
    """Record a join for every username with a matching account. Returns (written, skipped) —
    the count actually written (or that would be, in dry_run) and the usernames skipped for
    having no matching account.
    """
    from energetica import accounts

    joined_at = datetime.now(timezone.utc).isoformat()
    written = 0
    skipped: list[str] = []
    for username in usernames:
        account = accounts.get_account_by_username(username)
        if account is None:
            skipped.append(username)
            continue
        if not dry_run:
            try:
                accounts.record_join(account_id=account.account_id, slug=slug, joined_at=joined_at)
            except accounts.MembershipRoleConflictError as exc:
                # username already holds a facilitator grant covering this run — leave it alone
                # rather than fail the whole migration over one pre-existing conflict.
                print(f"  skipping {username!r}: {exc}", file=sys.stderr)
                skipped.append(username)
                continue
        written += 1
    return written, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", required=True, help="The private instance's slug.")
    parser.add_argument(
        "--config-dir",
        type=Path,
        default=Path("/etc/energetica"),
        help="Instance-config root (default: the production path /etc/energetica).",
    )
    parser.add_argument(
        "--accounts-db",
        type=Path,
        default=Path("/var/lib/energetica/accounts.db"),
        help="Path to accounts.db (default: the production path /var/lib/energetica/accounts.db).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing.")
    args = parser.parse_args()

    # Pin both resolved paths into the env the libraries read, so this prod tool never inherits
    # either module's dev-oriented default.
    os.environ["ENERGETICA_INSTANCE_SLUG"] = args.slug
    os.environ["ENERGETICA_INSTANCE_CONFIG_DIR"] = str(args.config_dir)
    os.environ["ENERGETICA_ACCOUNTS_DB_PATH"] = str(args.accounts_db)

    from energetica import instance_config

    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        print(f"ERROR: could not read instance.json for {args.slug!r}: {exc}", file=sys.stderr)
        return 1
    if config is None:
        print(f"ERROR: no instance.json found for {args.slug!r} under {args.config_dir}", file=sys.stderr)
        return 1
    if not isinstance(config.access, instance_config.PrivateAccess):
        print(f"Instance {args.slug!r} is not private — nothing to migrate.")
        return 0

    usernames = config.access.allowed_usernames
    if not usernames:
        print(f"Instance {args.slug!r}'s allowlist is empty — nothing to migrate.")
        return 0

    print(f"Found {len(usernames)} allowlisted username(s) for {args.slug!r}: {', '.join(usernames)}")
    written, skipped = migrate(usernames, slug=args.slug, dry_run=args.dry_run)

    verb = "would record" if args.dry_run else "recorded"
    print(f"{verb.capitalize()} {written} join(s) for {args.slug!r} (record_join — re-runs are no-ops).")
    if skipped:
        print(
            f"Skipped {len(skipped)} username(s) with no matching account or a conflicting grant: {', '.join(skipped)}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
