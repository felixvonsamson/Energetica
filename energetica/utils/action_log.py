"""Streaming reader for ``instance/actions_history.log`` (issue #766).

On startup only the actions *after* the loaded tick need replaying, yet the whole
log used to be deserialised into Pydantic objects — allocating gigabytes of RSS for
a list that is immediately sliced down to its tail. These helpers read the log
without materialising the prefix: line 0 (``init_engine``) is validated on its own,
and the skipped prefix is scanned with a cheap top-level ``json.loads`` rather than
full validation.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import TypeAdapter

from energetica.schemas.simulate import Action, InitEngineAction

_action_adapter: TypeAdapter[Action] = TypeAdapter(Action)


def read_init_action(log_path: str | Path) -> InitEngineAction | None:
    """Validate and return log line 0 (the ``init_engine`` action), or None if the log is empty.

    Reads only the first line, so it is cheap regardless of log size. The caller uses the
    result for the uuid / game-version invariants and, on a fresh instance, to seed
    ``engine.init_instance``.
    """
    with open(log_path, encoding="utf-8") as file:
        first_line = file.readline()
    if not first_line.strip():
        return None
    action = _action_adapter.validate_json(first_line)
    assert isinstance(action, InitEngineAction), (
        f"First action in {log_path} is {action.action_type!r}, expected 'init_engine'."
    )
    return action


def stream_actions_after_tick(log_path: str | Path, loaded_tick: int) -> list[Action]:
    """Return the actions to replay: every action after the loaded tick's log line.

    Forward-scans the log a single time. Lines before the boundary are skipped via a
    top-level ``json.loads`` (never built into Pydantic objects); the boundary is the
    ``tick`` action whose ``total_t == loaded_tick``. Every action after it is validated
    and collected. When ``loaded_tick`` is falsy (fresh instance, no checkpoint) the tail
    is everything after line 0 (``init_engine``).
    """
    tail: list[Action] = []
    collecting = not loaded_tick
    with open(log_path, encoding="utf-8") as file:
        for line_no, line in enumerate(file):
            if line_no == 0:
                continue  # init_engine action — restored separately, never replayed
            if collecting:
                tail.append(_action_adapter.validate_json(line))
                continue
            entry = json.loads(line)
            if entry.get("action_type") == "tick" and entry.get("total_t") == loaded_tick:
                collecting = True  # boundary found; collect strictly after this line
    if not collecting:
        raise ValueError(
            f"No 'tick' action with total_t == {loaded_tick} found in {log_path}; "
            "the action log and the loaded state are out of sync — refusing to replay."
        )
    return tail
