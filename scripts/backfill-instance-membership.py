#!/usr/bin/env python3
"""One-time per-instance migration: backfill instance_membership from already-settled Players.

Players who settled before the instance_membership table existed have no membership row, so the
lobby would show them zero runs. This writes one row per settled Player in the instance pickle.
Idempotent (INSERT OR IGNORE) — safe to re-run.

Deploy order (docs/architecture/lobby.md § Phasing): run this AFTER the code that ships the
instance_membership table is live, and BEFORE the lobby serves my-runs. Stop the instance service
first (caller's responsibility) to prevent concurrent pickle mutation; this tool only reads the
pickle, so it does not rewrite it.

Flow:
1. Load the instance engine pickle (read-only).
2. For each Player: INSERT OR IGNORE a membership (account_id from player.user, settled_at from
   player.created_at, slug from --slug / ENERGETICA_INSTANCE_SLUG).

Usage:
    python scripts/backfill-instance-membership.py --pickle <path> --slug <slug> \
        [--accounts-db <path>] [--dry-run]

If --slug is omitted it falls back to ENERGETICA_INSTANCE_SLUG. If --accounts-db is omitted it
defaults to the production path /var/lib/energetica/accounts.db (this is a production-only tool, so
it pins the prod path rather than inheriting db.py's dev default).
"""

from __future__ import annotations

import argparse
import os
import pickle
import sys
from pathlib import Path
from typing import Iterable


def backfill_memberships(players: Iterable[object], *, slug: str, dry_run: bool = False) -> int:
    """Write one membership per settled player. Returns the number of rows written (or, in
    ``dry_run``, that would be written). Idempotent via accounts.record_membership.
    """
    from energetica import accounts

    written = 0
    for player in players:
        account_id = player.user.account_id  # type: ignore[attr-defined]
        settled_at = player.created_at.isoformat()  # type: ignore[attr-defined]
        if not dry_run:
            accounts.record_membership(account_id=account_id, slug=slug, settled_at=settled_at)
        written += 1
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pickle", required=True, type=Path, help="Path to engine_data.pck")
    parser.add_argument(
        "--slug",
        default=os.environ.get("ENERGETICA_INSTANCE_SLUG"),
        help="Instance slug these players belong to (default: $ENERGETICA_INSTANCE_SLUG).",
    )
    parser.add_argument(
        "--accounts-db",
        type=Path,
        default=Path("/var/lib/energetica/accounts.db"),
        help="Path to accounts.db (default: the production path /var/lib/energetica/accounts.db).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing.")
    args = parser.parse_args()

    if not args.slug:
        print("ERROR: --slug is required (or set ENERGETICA_INSTANCE_SLUG)", file=sys.stderr)
        return 2

    # Pin the resolved path into the env the accounts library reads, so this prod tool never
    # inherits db.py's dev-oriented default.
    os.environ["ENERGETICA_ACCOUNTS_DB_PATH"] = str(args.accounts_db)

    if not args.pickle.exists():
        print(f"ERROR: pickle not found at {args.pickle}", file=sys.stderr)
        return 1

    print(f"Loading pickle from {args.pickle}")
    with args.pickle.open("rb") as f:
        engine_state = pickle.load(f)

    # Engine.save() pickles a plain dict of members (see game_engine.py), so engine_state is a
    # dict. db_model_instances["Player"] is an AutoIDDict[Player].
    player_table = engine_state.get("db_model_instances", {}).get("Player")
    if player_table is None:
        print("No Player table found in pickle — nothing to migrate.")
        return 0

    players = list(player_table.values())
    print(f"Found {len(players)} settled players")
    written = backfill_memberships(players, slug=args.slug, dry_run=args.dry_run)

    if args.dry_run:
        print(f"DRY RUN: would write {written} membership rows for slug {args.slug!r}. No changes written.")
    else:
        print(f"Wrote {written} membership rows for slug {args.slug!r} (INSERT OR IGNORE — re-runs are no-ops).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
