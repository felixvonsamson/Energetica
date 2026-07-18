"""Unit tests for the lifecycle self-enforcement seams (#861 T3 freeze, #862 T4 announced).

All keyed off ``instance_config.current_phase``:

- ``reject_when_frozen`` — the game-action write-gate (409 once the instance is frozen/ended).
- ``state_update`` — the sim tick halts once frozen (play over) *and* stays paused while announced,
  then self-starts once ``starts_at`` is crossed, re-anchoring the sim epoch to the start moment.

The phase is monkeypatched, so the freeze tests need neither a real on-disk config nor a running
engine; the self-start test uses a small fake engine to observe the epoch re-anchor.
"""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

from energetica import instance_config
from energetica.game_error import GameExceptionType
from energetica.utils import auth, tick_execution


@pytest.mark.parametrize("frozen_phase", ["freeze", "ended"])
def test_reject_when_frozen_raises_409(monkeypatch: pytest.MonkeyPatch, frozen_phase: str) -> None:
    """A game-action write is rejected with a 409 once the instance is frozen/ended.

    The detail is the honest read-only signal — distinct from the 403s that mean auth failures.
    """
    monkeypatch.setattr(instance_config, "current_phase", lambda: frozen_phase)
    with pytest.raises(HTTPException) as excinfo:
        auth.reject_when_frozen()
    assert excinfo.value.status_code == status.HTTP_409_CONFLICT
    assert excinfo.value.detail == GameExceptionType.INSTANCE_FROZEN


@pytest.mark.parametrize("live_phase", ["announced", "active"])
def test_reject_when_frozen_allows_live_game(monkeypatch: pytest.MonkeyPatch, live_phase: str) -> None:
    """While the game is live (announced/active), the write-gate is a no-op — writes pass through."""
    monkeypatch.setattr(instance_config, "current_phase", lambda: live_phase)
    assert auth.reject_when_frozen() is None


@pytest.mark.parametrize("frozen_phase", ["freeze", "ended"])
def test_state_update_halts_sim_when_frozen(monkeypatch: pytest.MonkeyPatch, frozen_phase: str) -> None:
    """The sim tick stops once the instance's own clock passes freeze_at.

    state_update returns without ticking. (Checked around the catch-up loop, not inside tick(), which
    would otherwise spin forever since a short-circuited tick never advances total_t.)
    """
    monkeypatch.setattr(tick_execution.instance_config, "current_phase", lambda: frozen_phase)

    def _fail_if_ticked() -> None:
        raise AssertionError("tick() must not run once the instance is frozen")

    monkeypatch.setattr(tick_execution, "tick", _fail_if_ticked)
    monkeypatch.setattr(tick_execution.recap, "mint_recap_if_needed", lambda: None)
    tick_execution.state_update()  # returns cleanly; the AssertionError above would fire if it ticked


@pytest.mark.parametrize("frozen_phase", ["freeze", "ended"])
def test_state_update_mints_recap_when_frozen(monkeypatch: pytest.MonkeyPatch, frozen_phase: str) -> None:
    """Entering freeze mints the recap (T5, #863) on the same halted-sim path that stops ticking."""
    monkeypatch.setattr(tick_execution.instance_config, "current_phase", lambda: frozen_phase)
    monkeypatch.setattr(tick_execution, "tick", lambda: None)

    minted: list[bool] = []
    monkeypatch.setattr(tick_execution.recap, "mint_recap_if_needed", lambda: minted.append(True))
    tick_execution.state_update()

    assert minted == [True]


def test_state_update_does_not_mint_while_live(monkeypatch: pytest.MonkeyPatch) -> None:
    """While the game is live (active), the recap hook never fires — nothing to snapshot yet."""
    monkeypatch.setattr(tick_execution.instance_config, "current_phase", lambda: "active")
    monkeypatch.setattr(tick_execution, "tick", lambda: None)
    monkeypatch.setattr(tick_execution.engine, "start_date", datetime.now(timezone.utc))
    monkeypatch.setattr(tick_execution.engine, "clock_time", 60)
    monkeypatch.setattr(tick_execution.engine, "total_t", 100)

    minted: list[bool] = []
    monkeypatch.setattr(tick_execution.recap, "mint_recap_if_needed", lambda: minted.append(True))
    tick_execution.state_update()

    assert minted == []


def test_state_update_pauses_sim_while_announced(monkeypatch: pytest.MonkeyPatch) -> None:
    """Before ``starts_at`` the sim is paused: ``state_update`` returns without ticking (#862, T4).

    This is the load-bearing half of self-start — without it the ``total_t == 0`` clause of the
    catch-up loop would fire tick 0 the instant the announced process comes up.
    """
    monkeypatch.setattr(tick_execution.instance_config, "current_phase", lambda: "announced")

    def _fail_if_ticked() -> None:
        raise AssertionError("tick() must not run while the instance is announced")

    monkeypatch.setattr(tick_execution, "tick", _fail_if_ticked)
    tick_execution.state_update()  # returns cleanly; announced is a paused sim


def test_state_update_self_starts_and_reanchors_epoch(monkeypatch: pytest.MonkeyPatch) -> None:
    """Crossing ``starts_at`` self-starts the sim and re-anchors the epoch to the start moment (#862).

    A fresh instance (``total_t == 0``) that has become ``active`` re-pins ``start_date`` to ~now
    (clock-aligned) so the catch-up loop begins at tick 0 rather than fast-forwarding across the
    whole announced window, then ticks. The re-anchor happens exactly once — a running game keeps
    its epoch, covered by ``test_state_update_reanchor_skipped_for_running_game`` below.
    """
    monkeypatch.setattr(tick_execution.instance_config, "current_phase", lambda: "active")
    # Epoch left over from the announced window: process-start, well before now.
    stale_epoch = datetime(2000, 1, 1, tzinfo=timezone.utc)
    fake = SimpleNamespace(
        total_t=0,
        clock_time=60,
        start_date=stale_epoch,
        first_tick_time=stale_epoch,
        lock=RLock(),
        save=lambda: None,
    )
    monkeypatch.setattr(tick_execution, "engine", fake)
    # A tick that just advances the counter, so the catch-up loop terminates after one iteration.
    monkeypatch.setattr(tick_execution, "tick", lambda: setattr(fake, "total_t", fake.total_t + 1))

    tick_execution.state_update()

    assert fake.total_t == 1, "the sim should have self-started (ticked once)"
    assert fake.start_date > stale_epoch, "the epoch must be re-anchored off the stale announced value"
    assert fake.start_date.tzinfo is not None, "the re-anchored epoch stays tz-aware"
    assert fake.start_date.timestamp() % fake.clock_time == 0, "the epoch stays clock-aligned"
    assert fake.first_tick_time == fake.start_date, "the 'first tick not yet defined' sentinel is preserved"


def test_state_update_reanchor_skipped_for_running_game(monkeypatch: pytest.MonkeyPatch) -> None:
    """A running game (``total_t > 0``) keeps its epoch — post-downtime catch-up is untouched (#862)."""
    monkeypatch.setattr(tick_execution.instance_config, "current_phase", lambda: "active")
    original_epoch = datetime(2020, 6, 1, tzinfo=timezone.utc)
    fake = SimpleNamespace(
        total_t=500,
        clock_time=60,
        start_date=original_epoch,
        first_tick_time=datetime(2020, 6, 1, 0, 1, tzinfo=timezone.utc),
        lock=RLock(),
        save=lambda: None,
    )
    monkeypatch.setattr(tick_execution, "engine", fake)
    # Stop the catch-up loop immediately: total_t is already past the wall-clock target for this old
    # epoch only if we bump it high enough, so make tick a no-op-terminator by driving total_t up.
    monkeypatch.setattr(tick_execution, "tick", lambda: setattr(fake, "total_t", 10**12))

    tick_execution.state_update()

    assert fake.start_date == original_epoch, "a running game must not re-anchor its epoch"
