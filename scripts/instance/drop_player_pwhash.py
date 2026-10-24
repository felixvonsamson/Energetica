#!/usr/bin/env python3
"""One-off migration: drop the password hash from every saved ``Player`` (issue #1341).

``Player`` used to keep a copy of its account's ``pwhash``, which nothing read (ADR-0009). The
field is gone from the class, but a pickle saved before that still carries it in each player's
``__dict__``. That loads fine, since unpickling restores ``__dict__`` without checking it against
the class, so the hash would sit in the run's state for good. This script removes it.

Deploy the code that drops the field first, then run this. A migrated pickle is not safe to load
on older code: its ``Player`` dataclass still lists ``pwhash``, so comparing two players raises
``AttributeError``. To roll back past the deploy, restore the backup this script writes. Idempotent:
a second run finds nothing to drop and writes nothing.

Run this only while the instance is stopped. The instance saves its pickle every few ticks, so a
live one would overwrite the edit with the hash still in it, or race the write. The script refuses
to run if it finds a ``main.py`` process whose working directory matches the instance (same
best-effort check as ``shift_start_date.py``); pass ``--force`` to override.

Usage (run from the instance directory, e.g. /var/www/energetica-<slug>, where
deploy-instance.sh puts this file at scripts/drop_player_pwhash.py, as the service's user):
    sudo -u energetica .venv/bin/python scripts/drop_player_pwhash.py --pickle instance/engine_data.pck [--dry-run]

    A backup of the pickle (``<pickle>.bak-<timestamp>``) is written before overwriting it, unless
    --no-backup is passed. The backup still holds the hashes, so delete it once the instance runs.
"""

from __future__ import annotations

import argparse
import os
import pickle
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


def find_running_instance_pid(working_dir: Path, *, proc_root: Path = Path("/proc")) -> int | None:
    """Best-effort scan of /proc for a running ``main.py`` process whose cwd is ``working_dir``.

    Copied from ``shift_start_date.py``, so this one-off script stands alone and can be deleted
    without touching anything else. Returns None when it cannot see such a process, which includes
    non-Linux systems and processes owned by another user.
    """
    if not proc_root.is_dir():
        return None
    try:
        working_dir = working_dir.resolve()
    except OSError:
        return None
    for entry in proc_root.iterdir():
        if not entry.name.isdigit():
            continue
        try:
            cwd = (entry / "cwd").resolve()
            if cwd != working_dir:
                continue
            cmdline = (entry / "cmdline").read_bytes()
        except OSError:
            continue
        if b"main.py" in cmdline:
            return int(entry.name)
    return None


def drop_player_pwhash(engine_state: dict[str, Any]) -> tuple[int, int]:
    """Remove ``pwhash`` from every player in ``engine_state``, in place.

    Returns ``(dropped, already_clean)``: how many players had the field, and how many did not.
    """
    players = engine_state["db_model_instances"].get("Player", {})
    dropped = 0
    for player in players.values():
        if player.__dict__.pop("pwhash", None) is not None:
            dropped += 1
    return dropped, len(players) - dropped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pickle", required=True, type=Path, help="Path to engine_data.pck")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing.")
    parser.add_argument(
        "--force", action="store_true", help="Proceed even if the instance looks like it's still running."
    )
    parser.add_argument(
        "--no-backup", action="store_true", help="Skip writing a .bak copy of the pickle before overwriting it."
    )
    args = parser.parse_args(argv)

    if not args.pickle.exists():
        print(f"ERROR: pickle not found at {args.pickle}", file=sys.stderr)
        return 1

    # The engine saves to "instance/engine_data.pck" relative to the instance's working directory,
    # so the instance directory is two levels up from the pickle.
    working_dir = args.pickle.resolve().parent.parent
    pid = find_running_instance_pid(working_dir)
    if pid is not None and not args.force:
        print(
            f"ERROR: instance looks like it's still running (pid {pid}, cwd matches {working_dir}). "
            "Stop the service first: its next save would overwrite this edit. Pass --force if "
            "you're certain it's safe.",
            file=sys.stderr,
        )
        return 1

    # Loading the pickle rebuilds real energetica objects, so run this with the interpreter the
    # project is installed into (on a server, `.venv/bin/python`).
    from energetica.freeplay import legacy_pickle

    print(f"Loading pickle from {args.pickle}")
    with args.pickle.open("rb") as f:
        engine_state = legacy_pickle.load(f)

    dropped, already_clean = drop_player_pwhash(engine_state)
    print(f"Players with a pwhash: {dropped}, without: {already_clean}")

    if dropped == 0:
        print("Nothing to drop. Pickle untouched.")
        return 0
    if args.dry_run:
        print("DRY RUN: no changes written.")
        return 0

    if not args.no_backup:
        backup_path = args.pickle.with_name(f"{args.pickle.name}.bak-{datetime.now():%Y%m%d%H%M%S}")
        shutil.copy2(args.pickle, backup_path)
        print(f"Backed up original pickle to {backup_path}")

    # Write to a temp sibling and atomically replace the live pickle, so an interrupted dump
    # leaves the original intact rather than half-written.
    tmp_path = args.pickle.with_name(f"{args.pickle.name}.tmp-{os.getpid()}")
    with tmp_path.open("wb") as f:
        pickle.dump(engine_state, f)
    tmp_path.replace(args.pickle)
    print(f"Saved {args.pickle}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
