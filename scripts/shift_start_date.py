#!/usr/bin/env python3
"""Shift a stopped instance's simulated epoch so a real-world gap isn't simulated as elapsed
game time (issue #1024).

The sim's "epoch" is ``engine.start_date``, persisted in ``instance/engine_data.pck``. Every
tick, the scheduler computes how many ticks *should* have run by now as
``(time.time() - engine.start_date.timestamp()) / engine.clock_time``. If an instance is simply
stopped and restarted after a break (holiday, maintenance window, ...) with nothing else changed,
it sees the full real-world gap since ``start_date`` and rapid-fires every missed tick to catch
up — i.e. it simulates the whole break. Editing ``start_date`` in the instance's *config* file
does not help: config's ``start_date`` is only ever read by ``init_instance()``, which runs once
for a brand-new instance. An instance already in progress always restores ``start_date`` straight
from the pickle on restart (``GameEngine.load()``), ignoring the config entirely.

This script shifts the persisted ``start_date`` forward (or back) by a whole number of days, so
the instance resumes as if no time had passed — no catch-up burst. Shifting by a whole day (or
any other multiple of the instance's ``clock_time``) keeps tick alignment intact — in particular
the daily-quiz trigger (``utils/tick_execution.py``, ``% 86400 == 9*3600``), which depends on
``start_date`` landing on the same second-of-day it did before the shift.

Only affects tick catch-up pacing, nothing else — see issue #1024 for the full trace of every
``total_t``/wall-clock consumer. All gameplay state is keyed off simulated ticks, not
``start_date``; wall-clock-anchored things (chat timestamps, account bookkeeping) are meant to
keep advancing through the gap and are untouched by this edit.

Run this only while the instance is fully stopped: ``engine.load()`` raises if any file under
``instance/data/**`` looks newer than ``engine_data.pck``, and editing the pickle bumps its mtime
(which is what we want — it must stay the newest file), but concurrent writes from a live
``engine.save()`` could otherwise race this script's own read-modify-write. The script refuses to
run if it finds a ``main.py`` process whose working directory matches the instance (best-effort:
only works on Linux, and only when run as the same user as the service — e.g. via
``sudo -u energetica``, matching ``docs/backend/incident-recovery.md``); pass ``--force`` to
override.

Usage:
    python scripts/shift_start_date.py --pickle instance/engine_data.pck --days <N> [--dry-run]

    N is the number of whole days to shift start_date forward; pass a negative number to shift
    it back. A backup of the pickle (``<pickle>.bak-<timestamp>``) is written before overwriting
    it, unless --no-backup is passed.
"""

from __future__ import annotations

import argparse
import pickle
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


def find_running_instance_pid(working_dir: Path, *, proc_root: Path = Path("/proc")) -> int | None:
    """Best-effort scan of /proc for a running ``main.py`` process whose cwd is ``working_dir``.

    Returns the PID if one is found, else None. This is a safety net, not a guarantee: it
    silently returns None if ``proc_root`` doesn't exist (non-Linux) or a process's /proc entries
    aren't readable (different user) — callers should still treat "stop the service first" as
    the real contract and offer --force for when the check can't see a process it should.
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


def shift_start_date(engine_state: dict[str, Any], days: int) -> tuple[datetime, datetime]:
    """Shift ``engine_state["start_date"]`` by ``days`` whole days, in place.

    Returns (old_start_date, new_start_date). Raises ValueError if ``days`` is zero, or if the
    resulting shift isn't a whole multiple of this instance's clock_time — that would desync the
    daily-quiz trigger's tick alignment (see module docstring).
    """
    if days == 0:
        raise ValueError("--days must be nonzero")
    clock_time = engine_state["clock_time"]
    shift = timedelta(days=days)
    shift_seconds = shift.total_seconds()
    if shift_seconds % clock_time != 0:
        raise ValueError(
            f"a {days}-day shift ({shift_seconds:.0f}s) is not a whole multiple of this "
            f"instance's clock_time ({clock_time}s) — would desync tick alignment"
        )
    old_start_date = engine_state["start_date"]
    new_start_date = old_start_date + shift
    engine_state["start_date"] = new_start_date
    return old_start_date, new_start_date


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pickle", required=True, type=Path, help="Path to engine_data.pck")
    parser.add_argument(
        "--days", required=True, type=int, help="Whole days to shift start_date forward (negative to shift back)."
    )
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing.")
    parser.add_argument(
        "--force", action="store_true", help="Proceed even if the instance looks like it's still running."
    )
    parser.add_argument(
        "--no-backup", action="store_true", help="Skip writing a .bak copy of the pickle before overwriting it."
    )
    args = parser.parse_args()

    if not args.pickle.exists():
        print(f"ERROR: pickle not found at {args.pickle}", file=sys.stderr)
        return 1

    # game_engine.py's save()/load() always use the path "instance/engine_data.pck" relative to
    # the instance's working directory — walk back up from the pickle to that directory to look
    # for a live process there.
    working_dir = args.pickle.resolve().parent.parent
    pid = find_running_instance_pid(working_dir)
    if pid is not None and not args.force:
        print(
            f"ERROR: instance looks like it's still running (pid {pid}, cwd matches {working_dir}). "
            "Stop the service first — editing the pickle while it's live races the next "
            "engine.save() and can corrupt it. Pass --force if you're certain it's safe.",
            file=sys.stderr,
        )
        return 1

    print(f"Loading pickle from {args.pickle}")
    with args.pickle.open("rb") as f:
        engine_state = pickle.load(f)

    try:
        old_start_date, new_start_date = shift_start_date(engine_state, args.days)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print(f"start_date: {old_start_date.isoformat()} -> {new_start_date.isoformat()} ({args.days:+d} day(s))")

    if args.dry_run:
        print("DRY RUN: no changes written.")
        return 0

    if not args.no_backup:
        backup_path = args.pickle.with_name(f"{args.pickle.name}.bak-{datetime.now():%Y%m%d%H%M%S}")
        shutil.copy2(args.pickle, backup_path)
        print(f"Backed up original pickle to {backup_path}")

    with args.pickle.open("wb") as f:
        pickle.dump(engine_state, f)
    print(f"Saved {args.pickle}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
