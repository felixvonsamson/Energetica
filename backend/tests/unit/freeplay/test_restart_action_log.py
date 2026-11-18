"""Regression test for #471: restarting a Run must not log the ``init_engine`` action again."""

from pathlib import Path

import pytest

from energetica.freeplay.app import create_app


def _init_engine_lines(log: Path) -> list[str]:
    return [line for line in log.read_text(encoding="utf-8").splitlines() if '"action_type":"init_engine"' in line]


def test_restart_before_the_first_save_keeps_one_init_engine_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The engine first saves instance/engine_data.pck on its first tick. A Run stopped before then
    # leaves only instance/actions_history.log, so the next start rebuilds the engine from the log's
    # line 0. It used to log that line again, so each such restart appended another init_engine
    # line, and the start after that replayed it as an ordinary action.
    # create_app(rm_instance=True) deletes ./instance, so run it in a scratch directory.
    monkeypatch.chdir(tmp_path)
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    log = tmp_path / "instance" / "actions_history.log"
    assert not (tmp_path / "instance" / "engine_data.pck").exists()
    first_start = _init_engine_lines(log)
    assert len(first_start) == 1

    create_app(skip_adding_handlers=True, env="prod")

    assert _init_engine_lines(log) == first_start
