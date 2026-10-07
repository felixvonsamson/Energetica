"""Unit tests for Workshop's phase timer (#996): how much time a phase has left, given its configured
duration, the time since it opened and the moderator's "+N minutes" extensions.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from energetica.workshop.phase_timer import PhaseTimer

OPENED = datetime(2026, 10, 4, 9, 0, tzinfo=timezone.utc)


def _timer(minutes: int = 5, *extensions: int) -> PhaseTimer:
    return PhaseTimer(
        started_at=OPENED,
        duration=timedelta(minutes=minutes),
        extensions=tuple(timedelta(minutes=extension) for extension in extensions),
    )


def test_a_phase_that_just_opened_has_its_whole_duration_left() -> None:
    timer = _timer(5)

    assert timer.remaining(OPENED) == timedelta(minutes=5)
    assert timer.is_active(OPENED)


def test_time_left_counts_down_with_elapsed_time() -> None:
    assert _timer(5).remaining(OPENED + timedelta(minutes=2, seconds=46)) == timedelta(minutes=2, seconds=14)


def test_a_phase_is_over_once_its_duration_has_elapsed() -> None:
    timer = _timer(5)
    end = OPENED + timedelta(minutes=5)

    assert timer.remaining(end) == timedelta(0)
    assert not timer.is_active(end)


def test_time_left_never_goes_below_zero() -> None:
    assert _timer(5).remaining(OPENED + timedelta(hours=5)) == timedelta(0)


def test_extensions_add_to_the_time_left() -> None:
    timer = _timer(5, 2, 1)

    assert timer.remaining(OPENED + timedelta(minutes=4)) == timedelta(minutes=4)
    assert timer.ends_at == OPENED + timedelta(minutes=8)


def test_extending_returns_a_new_timer_and_leaves_the_old_one_alone() -> None:
    timer = _timer(5)

    extended = timer.extended(timedelta(minutes=3))

    assert extended.remaining(OPENED) == timedelta(minutes=8)
    assert timer.remaining(OPENED) == timedelta(minutes=5)


def test_an_extension_keeps_a_phase_running_past_its_configured_end() -> None:
    later = OPENED + timedelta(minutes=6)

    assert not _timer(5).is_active(later)
    assert _timer(5, 2).is_active(later)


def test_an_extension_must_add_time() -> None:
    with pytest.raises(ValueError):
        _timer(5).extended(timedelta(0))


def test_the_open_time_must_carry_a_time_zone() -> None:
    with pytest.raises(ValueError):
        PhaseTimer(started_at=datetime(2026, 10, 4, 9, 0), duration=timedelta(minutes=5))


def test_a_timer_round_trips_through_json() -> None:
    timer = _timer(8, 1)

    assert PhaseTimer.model_validate_json(timer.model_dump_json()) == timer
