"""Atomic file writes: a write that fails partway leaves the previous file whole (#1319)."""

from __future__ import annotations

import os
import pickle
from pathlib import Path
from types import SimpleNamespace

import pytest

from energetica.kernel.atomic_file import open_atomically, write_atomically


def test_write_atomically_replaces_the_file(tmp_path: Path) -> None:
    target = tmp_path / "file.txt"
    target.write_text("old")

    write_atomically(target, "new")

    assert target.read_text() == "new"
    assert list(tmp_path.iterdir()) == [target]


def test_a_write_that_raises_leaves_the_previous_file_and_no_temporary_file(tmp_path: Path) -> None:
    target = tmp_path / "file.bin"
    target.write_bytes(b"previous good save")

    with pytest.raises(RuntimeError), open_atomically(target) as file:
        file.write(b"half a ")
        raise RuntimeError("killed partway")

    assert target.read_bytes() == b"previous good save"
    assert list(tmp_path.iterdir()) == [target]


def test_the_data_is_synced_to_disk_before_it_replaces_the_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    target = tmp_path / "file.bin"
    calls: list[str] = []
    real_fsync, real_replace = os.fsync, os.replace

    def recording_fsync(fd: int) -> None:
        calls.append("fsync")
        real_fsync(fd)

    def recording_replace(src: str, dst: Path) -> None:
        calls.append("replace")
        real_replace(src, dst)

    monkeypatch.setattr(os, "fsync", recording_fsync)
    monkeypatch.setattr(os, "replace", recording_replace)

    with open_atomically(target) as file:
        file.write(b"data")

    assert calls == ["fsync", "replace"]


class _SaveKilled(Exception):
    pass


class _KillsTheSave:
    """Raises while being pickled, after the members before it have been written."""

    def __reduce__(self) -> tuple:
        raise _SaveKilled


class _StubEngine(SimpleNamespace):
    """Stands in for ``GameEngine`` in ``save``: every saved member not set explicitly is ``None``."""

    def __getattr__(self, name: str) -> None:
        return None


def test_a_save_that_fails_partway_keeps_the_last_good_save(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """``GameEngine.save`` must not empty ``engine_data.pck`` before the new save is complete."""
    from energetica.freeplay.game_engine import GameEngine

    monkeypatch.chdir(tmp_path)
    (tmp_path / "instance").mkdir()
    save = tmp_path / "instance" / "engine_data.pck"
    save.write_bytes(pickle.dumps({"total_t": 1}))
    engine = _StubEngine(total_t=2, general_chat_id=_KillsTheSave())

    with pytest.raises(_SaveKilled):
        GameEngine.save(engine)  # type: ignore[arg-type]

    assert pickle.loads(save.read_bytes()) == {"total_t": 1}
    assert list(save.parent.iterdir()) == [save]
