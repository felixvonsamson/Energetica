#!/usr/bin/env python3
"""One-time per-instance migration: drop the retired ``User`` object from an existing pickle (ADR-0004).

Run this BEFORE deploying the code that retires ``energetica.database.user.User`` in favour of
``Player`` carrying ``username``/``pwhash``/``account_id`` directly. Without it, an existing
``engine_data.pck`` still holding ``User``/``Player.user`` objects cannot be unpickled at all once
``energetica/database/user.py`` is gone — ``pickle.load`` needs the class to still be importable
at its original module path to reconstruct any instance of it. Idempotent — safe to re-run.

Flow:
1. Stop the instance service first (caller's responsibility) to prevent concurrent pickle mutation.
2. Load the existing engine pickle through a compatibility ``Unpickler`` that resolves the deleted
   ``energetica.database.user.User`` to a local structural stand-in (``_LegacyUser``) — the pickle
   bytes call for that exact class, so this is required just to get the file open, independent of
   whatever the *current* code's ``Player``/``User`` shapes are.
3. For each ``Player`` still carrying the old ``user`` attribute (i.e. not yet migrated): copy
   ``username``/``pwhash``/``account_id`` from it directly onto the ``Player``, then drop ``user``.
   A ``Player`` created after this migration already has these fields natively and has no ``user``
   attribute to find — this step is then a no-op for it.
4. Drop the now-orphaned ``"User"`` entry from ``db_model_instances`` (nothing in current code
   registers or reads a ``User`` table any more).
5. Save the modified pickle. Caller restarts the service.

Usage:
    python scripts/migrate-drop-user.py --pickle <path> [--dry-run]
"""

from __future__ import annotations

import argparse
import pickle
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class _LegacyUser:
    """Structural stand-in for the deleted ``energetica.database.user.User`` — just enough to
    read back the fields this migration needs (``username``, ``pwhash``, ``account_id``) from an
    old pickle. Never constructed directly; only ever produced by :class:`_CompatUnpickler`.
    """

    username: str
    pwhash: str
    role: str
    account_id: int
    player: Any = None


class _CompatUnpickler(pickle.Unpickler):
    """Resolves the deleted ``User`` class to :class:`_LegacyUser` so the pickle can load at all;
    every other class resolves normally against current code.
    """

    def find_class(self, module: str, name: str) -> Any:
        if module == "energetica.database.user" and name == "User":
            return _LegacyUser
        return super().find_class(module, name)


def migrate_players(player_table: dict[int, Any], *, dry_run: bool = False) -> tuple[int, int]:
    """Move username/pwhash/account_id from each Player's legacy ``.user`` onto the Player
    itself, dropping ``.user``. Returns ``(migrated, skipped)``.
    """
    migrated = 0
    skipped = 0
    for player in player_table.values():
        legacy_user = player.__dict__.get("user")
        if legacy_user is None:
            skipped += 1
            continue
        migrated += 1
        if dry_run:
            print(f"  [dry-run] would migrate player {legacy_user.username!r}")
            continue
        player.__dict__["username"] = legacy_user.username
        player.__dict__["pwhash"] = legacy_user.pwhash
        player.__dict__["account_id"] = legacy_user.account_id
        del player.__dict__["user"]
    return migrated, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pickle", required=True, type=Path, help="Path to engine_data.pck")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing.")
    args = parser.parse_args()

    if not args.pickle.exists():
        print(f"ERROR: pickle not found at {args.pickle}", file=sys.stderr)
        return 1

    print(f"Loading pickle from {args.pickle}")
    with args.pickle.open("rb") as f:
        engine_state = _CompatUnpickler(f).load()

    # Engine.save() pickles a plain dict of members (see game_engine.py), so engine_state is a
    # dict. db_model_instances["Player"]/["User"] are AutoIDDict instances (plain dict subclasses).
    db_model_instances = engine_state.get("db_model_instances", {})
    player_table = db_model_instances.get("Player", {})

    print(f"Found {len(player_table)} players in pickle")
    migrated, skipped = migrate_players(player_table, dry_run=args.dry_run)

    had_user_table = "User" in db_model_instances
    if args.dry_run:
        if had_user_table:
            print("  [dry-run] would drop the orphaned 'User' table")
        print(f"DRY RUN: would migrate {migrated} players, skip {skipped}. No changes written.")
        return 0

    if had_user_table:
        del db_model_instances["User"]

    if migrated == 0 and not had_user_table:
        print(f"No changes ({skipped} players already migrated). Pickle untouched.")
        return 0

    print(f"Saving pickle ({migrated} migrated, {skipped} already had username/pwhash/account_id)")
    with args.pickle.open("wb") as f:
        pickle.dump(engine_state, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
