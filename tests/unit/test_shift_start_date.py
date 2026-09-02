"""Unit tests for the start_date shift script (issue #1024).

Covers the two pure-logic seams `main()` wires together: `shift_start_date` (the actual pickle
field edit and its tick-alignment validation) and `find_running_instance_pid` (the best-effort
"instance is still running" guard). Pickle I/O and CLI parsing live in `main()` and aren't
exercised here, matching the other scripts/*.py tests in this suite.
"""

from __future__ import annotations

import importlib.util
import os
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType

import pytest

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "shift_start_date.py"


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("shift_start_date", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _engine_state(*, clock_time: int = 30, start_date: datetime | None = None) -> dict:
    return {
        "clock_time": clock_time,
        "start_date": start_date or datetime(2026, 1, 1, tzinfo=timezone.utc),
        "total_t": 1234,
    }


def test_shift_start_date_moves_it_forward_by_whole_days() -> None:
    module = _load_script()
    engine_state = _engine_state(start_date=datetime(2026, 1, 1, tzinfo=timezone.utc))

    old, new = module.shift_start_date(engine_state, 14)

    assert old == datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert new == datetime(2026, 1, 15, tzinfo=timezone.utc)
    assert engine_state["start_date"] == new


def test_shift_start_date_accepts_negative_days() -> None:
    module = _load_script()
    engine_state = _engine_state(start_date=datetime(2026, 1, 15, tzinfo=timezone.utc))

    old, new = module.shift_start_date(engine_state, -14)

    assert old == datetime(2026, 1, 15, tzinfo=timezone.utc)
    assert new == datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_shift_start_date_rejects_a_zero_shift() -> None:
    module = _load_script()
    engine_state = _engine_state()
    original_start_date = engine_state["start_date"]

    with pytest.raises(ValueError, match="nonzero"):
        module.shift_start_date(engine_state, 0)

    assert engine_state["start_date"] == original_start_date  # untouched on rejection


def test_shift_start_date_rejects_a_shift_not_aligned_to_clock_time() -> None:
    module = _load_script()
    # 7 doesn't divide 86400 evenly, so a whole-day shift wouldn't land back on the same
    # second-of-day — this clock_time isn't one game_engine.py actually allows, but the
    # validation is generic (keyed off the pickle's own clock_time, not a hardcoded list).
    engine_state = _engine_state(clock_time=7)

    with pytest.raises(ValueError, match="clock_time"):
        module.shift_start_date(engine_state, 1)


@pytest.mark.parametrize("clock_time", [60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1])
def test_shift_start_date_accepts_every_supported_clock_time(clock_time: int) -> None:
    """Every clock_time game_engine.py's init_instance() allows divides 86400 evenly, so a
    whole-day shift must always validate clean for all of them.
    """
    module = _load_script()
    engine_state = _engine_state(clock_time=clock_time)

    module.shift_start_date(engine_state, 3)  # must not raise


def test_find_running_instance_pid_returns_none_without_a_proc_dir(tmp_path: Path) -> None:
    module = _load_script()

    pid = module.find_running_instance_pid(tmp_path, proc_root=tmp_path / "no-such-proc")

    assert pid is None


def _make_fake_proc(proc_root: Path, pid: int, cwd_target: Path, cmdline: bytes) -> None:
    pid_dir = proc_root / str(pid)
    pid_dir.mkdir(parents=True)
    os.symlink(cwd_target, pid_dir / "cwd")
    (pid_dir / "cmdline").write_bytes(cmdline)


def test_find_running_instance_pid_finds_a_matching_main_py_process(tmp_path: Path) -> None:
    module = _load_script()
    working_dir = tmp_path / "var-www-energetica-zhaw"
    working_dir.mkdir()
    proc_root = tmp_path / "proc"
    _make_fake_proc(proc_root, 4242, working_dir, b"/venv/bin/python\x00main.py\x00--env\x00prod\x00")

    pid = module.find_running_instance_pid(working_dir, proc_root=proc_root)

    assert pid == 4242


def test_find_running_instance_pid_ignores_processes_with_a_different_cwd(tmp_path: Path) -> None:
    module = _load_script()
    working_dir = tmp_path / "target"
    working_dir.mkdir()
    other_dir = tmp_path / "unrelated"
    other_dir.mkdir()
    proc_root = tmp_path / "proc"
    _make_fake_proc(proc_root, 111, other_dir, b"/venv/bin/python\x00main.py\x00")

    pid = module.find_running_instance_pid(working_dir, proc_root=proc_root)

    assert pid is None


def test_find_running_instance_pid_ignores_non_main_py_processes_in_the_same_dir(tmp_path: Path) -> None:
    module = _load_script()
    working_dir = tmp_path / "target"
    working_dir.mkdir()
    proc_root = tmp_path / "proc"
    _make_fake_proc(proc_root, 222, working_dir, b"/bin/bash\x00")

    pid = module.find_running_instance_pid(working_dir, proc_root=proc_root)

    assert pid is None


def test_find_running_instance_pid_ignores_non_pid_entries(tmp_path: Path) -> None:
    module = _load_script()
    working_dir = tmp_path / "target"
    working_dir.mkdir()
    proc_root = tmp_path / "proc"
    proc_root.mkdir()
    (proc_root / "self").mkdir()  # /proc has non-numeric entries too

    pid = module.find_running_instance_pid(working_dir, proc_root=proc_root)

    assert pid is None
