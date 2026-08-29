#!/usr/bin/env python3
"""Grow (or trim) a private run's roster from the shell (#1030 follow-up, ADR-0007).

Replaces ``scripts/infra/whitelist-instance.sh``, which edited ``instance.json``'s
``allowed_usernames`` directly — the backend no longer reads that field. This is the same write
path the in-app facilitator roster page (#1022) uses (``accounts.record_join`` /
``remove_membership`` / ``get_run_roster``), just reachable from the shell for a sysadmin who
would rather not (or cannot yet) go through the facilitator UI. Unlike the retired shell script,
this does not touch or require a private ``access.policy`` — the roster itself lives in
``accounts.db`` regardless of what a run's ``instance.json`` currently says, though it is only
*consulted* by the entry gate for a privately-configured run.

Caveat on 'add': the in-app roster page and the join-link's confirm additionally reconcile
``settled_at`` when re-adding a previously-settled, then-banned account (they can see the run's
live ``Player`` table; see ``energetica.utils.misc.record_join_reconciling_settlement``). This
script only touches ``accounts.db`` — it has no connection to the running instance's engine — so
it cannot do that reconciliation itself. Re-adding such an account here brings back a joined-but-
unsettled row (the entry gate still lets them straight back in, since that reads the engine's
``Player`` directly; only the lobby's "Settle" vs "Continue" label is briefly wrong). Run
``scripts/backfill-instance-membership.py`` against a stopped instance afterward if that display
needs to be exact right away, or use the facilitator roster page for this re-add instead.

Usage:
    python scripts/whitelist-run.py <slug> list
    python scripts/whitelist-run.py <slug> add    <username> [<username> ...]
    python scripts/whitelist-run.py <slug> remove <username> [<username> ...]

    [--accounts-db <path>]

If --accounts-db is omitted it defaults to the production path /var/lib/energetica/accounts.db
(this is a production-only tool, so it pins the prod path rather than inheriting db.py's dev
default). Edits take effect on the next entry attempt — no restart, no redeploy (the entry gate
reads accounts.db fresh on every request, same as it always re-read instance.json).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("slug", help="The run's instance slug.")
    parser.add_argument("action", choices=["list", "add", "remove"])
    parser.add_argument("usernames", nargs="*", help="Usernames to add/remove (ignored for 'list').")
    parser.add_argument(
        "--accounts-db",
        type=Path,
        default=Path("/var/lib/energetica/accounts.db"),
        help="Path to accounts.db (default: the production path /var/lib/energetica/accounts.db).",
    )
    args = parser.parse_args()

    if args.action in ("add", "remove") and not args.usernames:
        print(f"ERROR: '{args.action}' requires at least one username", file=sys.stderr)
        return 2

    # Pin the resolved path into the env the accounts library reads, so this prod tool never
    # inherits db.py's dev-oriented default.
    os.environ["ENERGETICA_ACCOUNTS_DB_PATH"] = str(args.accounts_db)

    # This script lives in scripts/, not the repo root, so the interpreter's default sys.path
    # (the script's own directory) never includes the repo root — `energetica` isn't installed
    # into the venv as a package, so importing it needs the repo root added explicitly.
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from energetica import accounts

    if args.action == "list":
        roster = accounts.get_run_roster(slug=args.slug)
        if not roster:
            print(f"No one on {args.slug!r}'s roster.")
            return 0
        for entry in roster:
            state = "settled" if entry.settled_at is not None else "invited, not settled"
            print(f"  {entry.username} ({state}, joined {entry.joined_at})")
        return 0

    if args.action == "add":
        added = 0
        for username in args.usernames:
            account = accounts.get_account_by_username(username)
            if account is None:
                print(f"ERROR: no account found for username {username!r} — skipped", file=sys.stderr)
                continue
            try:
                accounts.record_join(
                    account_id=account.account_id, slug=args.slug, joined_at=datetime.now(timezone.utc).isoformat()
                )
            except accounts.MembershipRoleConflictError as exc:
                print(f"ERROR: {exc} — skipped", file=sys.stderr)
                continue
            print(f"Added {username!r} to {args.slug!r}'s roster.")
            added += 1
        if added:
            # See the module docstring's "Caveat on 'add'": this script can't see the run's live
            # Player table, so a re-add of a previously-settled, then-banned account comes back
            # unsettled in the lobby's display even though nothing about their in-run state changed.
            print(
                "Note: if any of the above previously settled in this run and were removed, their "
                "lobby 'settled' status won't be restored automatically — see this script's --help.",
                file=sys.stderr,
            )
        return 0

    # remove
    for username in args.usernames:
        account = accounts.get_account_by_username(username)
        if account is None:
            print(f"{username!r} has no account — nothing to remove.")
            continue
        accounts.remove_membership(account_id=account.account_id, slug=args.slug)
        print(f"Removed {username!r} from {args.slug!r}'s roster.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
