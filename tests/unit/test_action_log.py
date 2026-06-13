"""Unit tests for the streaming action-log reader (issue #766).

These exercise the public interface of ``energetica.utils.action_log`` directly,
without spinning up ``create_app``: given a log file on disk and a loaded tick,
the reader must return exactly the actions that need replaying — and must do so
without Pydantic-validating the prefix it skips.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from energetica.schemas.simulate import (
    ApiAction,
    ApiActionRequest,
    ApiActionResponse,
    InitEngineAction,
    TickAction,
)
from energetica.utils.action_log import read_init_action, stream_actions_after_tick

_TS = datetime(2026, 1, 1)


def _init() -> InitEngineAction:
    return InitEngineAction(
        instance_uuid="11111111-1111-1111-1111-111111111111",
        env="dev",
        game_version="0.0.0",
        action_type="init_engine",
        clock_time=3,
        in_game_seconds_per_tick=1,
        random_seed=1,
        start_date=_TS,
        disable_signups=False,
    )


def _tick(total_t: int) -> TickAction:
    return TickAction(timestamp=_TS, action_type="tick", total_t=total_t, elapsed=0.1)


def _request(user_id: int = 1, payload: dict | None = None) -> ApiAction:
    return ApiAction(
        timestamp=_TS,
        elapsed=0.1,
        ip="127.0.0.1",
        action_type="request",
        user_id=user_id,
        request=ApiActionRequest(endpoint="/x", method="POST", content_type="application/json", payload=payload),
        response=ApiActionResponse(status_code=200, content_type="application/json", payload=None),
    )


def _write_log(path: Path, actions: list) -> Path:
    path.write_text("".join(a.model_dump_json() + "\n" for a in actions), encoding="utf-8")
    return path


def test_returns_actions_strictly_after_loaded_tick(tmp_path: Path) -> None:
    """The tail is every action after the loaded tick's line — including interleaved non-ticks."""
    req_after = _request(user_id=7)
    log = _write_log(
        tmp_path / "actions_history.log",
        [_init(), _tick(1), _request(user_id=2), _tick(2), req_after, _tick(3)],
    )

    tail = stream_actions_after_tick(log, loaded_tick=2)

    assert [a.action_type for a in tail] == ["request", "tick"]
    request_action, tick_action = tail
    assert isinstance(request_action, ApiAction)
    assert isinstance(tick_action, TickAction)
    assert request_action.user_id == 7
    assert tick_action.total_t == 3


def test_forged_tick_in_request_payload_does_not_fool_boundary(tmp_path: Path) -> None:
    """A request payload literally containing a 'tick' action must not be mistaken for the boundary.

    Guards against regressing the prefix scan to a substring match: request payloads are
    arbitrary user-controlled JSON and can contain the bytes ``"action_type":"tick"``.
    Only the *top-level* action_type/total_t may decide the boundary.
    """
    poison = _request(user_id=2, payload={"action_type": "tick", "total_t": 5})
    log = _write_log(
        tmp_path / "actions_history.log",
        [_init(), _tick(1), poison, _tick(5), _request(user_id=9), _tick(6)],
    )

    # The real boundary is the top-level tick(5); the forged total_t:5 in the payload
    # of an earlier *request* line must be ignored.
    tail = stream_actions_after_tick(log, loaded_tick=5)

    assert [a.action_type for a in tail] == ["request", "tick"]
    request_action, tick_action = tail
    assert isinstance(request_action, ApiAction)
    assert isinstance(tick_action, TickAction)
    assert request_action.user_id == 9
    assert tick_action.total_t == 6


def test_non_validating_prefix_line_is_skipped_not_parsed(tmp_path: Path) -> None:
    """A prefix line that no Action schema accepts must be skipped, proving it is never validated.

    The old code ``validate_json``-ed every line; it would have raised on this line. The
    streaming reader only ``json.loads`` the prefix to locate the boundary, so a
    schema-incompatible prefix line (e.g. left over from an older log format) is tolerated.
    """
    lines = [
        _init().model_dump_json(),
        _tick(1).model_dump_json(),
        '{"action_type":"request"}',  # valid JSON, invalid Action (missing required fields)
        _tick(2).model_dump_json(),
        _request(user_id=9).model_dump_json(),
    ]
    log = tmp_path / "actions_history.log"
    log.write_text("".join(line + "\n" for line in lines), encoding="utf-8")

    tail = stream_actions_after_tick(log, loaded_tick=2)

    assert [a.action_type for a in tail] == ["request"]
    (request_action,) = tail
    assert isinstance(request_action, ApiAction)
    assert request_action.user_id == 9


def test_missing_boundary_tick_raises(tmp_path: Path) -> None:
    """If no tick line matches the loaded tick, fail loud rather than silently replay nothing/wrong.

    A silent empty tail would skip real actions and let the game diverge from its history.
    """
    log = _write_log(
        tmp_path / "actions_history.log",
        [_init(), _tick(1), _request(user_id=2), _tick(2)],
    )

    with pytest.raises(ValueError, match="42"):
        stream_actions_after_tick(log, loaded_tick=42)


def test_read_init_action_returns_validated_line_zero(tmp_path: Path) -> None:
    """Line 0 is validated and returned as the init_engine action."""
    log = _write_log(tmp_path / "actions_history.log", [_init(), _tick(1)])

    init = read_init_action(log)

    assert init is not None
    assert init.action_type == "init_engine"
    assert init.instance_uuid == "11111111-1111-1111-1111-111111111111"


def test_read_init_action_returns_none_for_empty_log(tmp_path: Path) -> None:
    """An empty log yields None — the caller treats this as a fresh instance, not an error."""
    log = tmp_path / "actions_history.log"
    log.write_text("", encoding="utf-8")

    assert read_init_action(log) is None
