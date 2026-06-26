#!/usr/bin/env python3
"""One-time per-VPS migration: backfill the SQLite accounts store from the existing pickle.

Run this BEFORE deploying the code that ships server-wide accounts (auth refactor).
Idempotent — safe to re-run after a partial failure.

Flow (per docs/architecture/static-serving-and-deployment.md):
1. Stop the instance service first (caller's responsibility) to prevent concurrent pickle mutation.
2. Load the existing engine pickle.
3. For each User in the pickle missing account_id:
   - INSERT OR IGNORE into accounts (username, pwhash, NULL, created_at)
   - SELECT account_id WHERE username = ?
   - Write account_id back into the pickle User
4. Save the modified pickle.
5. Caller restarts the service.

The combination of INSERT OR IGNORE + SELECT guarantees recovery from both partial-failure modes
(crash before pickle save, crash after pickle save).

Usage:
    python scripts/migrate-to-server-accounts.py --pickle <path> [--accounts-db <path>]

If --accounts-db is omitted, defaults to /var/lib/energetica/accounts.db (matching the production
path read by the running backend via ENERGETICA_ACCOUNTS_DB_PATH).
"""

from __future__ import annotations

import argparse
import os
import pickle
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pickle", required=True, type=Path, help="Path to engine_data.pck")
    parser.add_argument(
        "--accounts-db",
        type=Path,
        default=None,
        help="Path to accounts.db (default: /var/lib/energetica/accounts.db or $ENERGETICA_ACCOUNTS_DB_PATH)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing.")
    args = parser.parse_args()

    if args.accounts_db is not None:
        os.environ["ENERGETICA_ACCOUNTS_DB_PATH"] = str(args.accounts_db)

    # This is the one tool that must read a pre-migration pickle, whose User objects have no
    # account_id yet. User.__setstate__ hard-fails on that by default (to stop the backend ever
    # starting un-migrated); this flag lets it load here so we can backfill. Must be set before
    # pickle.load runs __setstate__.
    os.environ["ENERGETICA_ALLOW_UNMIGRATED_USERS"] = "1"

    # Import lazily so the env vars above take effect.
    from energetica import accounts

    if not args.pickle.exists():
        print(f"ERROR: pickle not found at {args.pickle}", file=sys.stderr)
        return 1

    print(f"Loading pickle from {args.pickle}")
    with args.pickle.open("rb") as f:
        engine_state = pickle.load(f)

    # Engine.save() pickles a plain dict of members (see game_engine.py), so engine_state is a
    # dict, not the Engine object. db_model_instances["User"] is an AutoIDDict[User].
    user_table = engine_state.get("db_model_instances", {}).get("User")
    if user_table is None:
        print("No User table found in pickle — nothing to migrate.")
        return 0

    print(f"Found {len(user_table)} users in pickle")
    migrated = 0
    skipped = 0
    for user in user_table.values():
        existing = getattr(user, "account_id", None)
        if existing not in (None, 0):
            skipped += 1
            continue
        if args.dry_run:
            migrated += 1
            print(f"  [dry-run] would migrate user {user.username!r}")
            continue
        account_id = accounts.get_or_create_account_id(username=user.username, pwhash=user.pwhash)
        user.account_id = account_id
        migrated += 1
        print(f"  user {user.username!r} -> account_id={account_id}")

    if args.dry_run:
        print(f"DRY RUN: would migrate {migrated} users, skip {skipped}. No changes written.")
        return 0

    if migrated > 0:
        print(f"Saving pickle ({migrated} migrated, {skipped} already had account_id)")
        with args.pickle.open("wb") as f:
            pickle.dump(engine_state, f)
    else:
        print(f"No changes ({skipped} users already migrated). Pickle untouched.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
