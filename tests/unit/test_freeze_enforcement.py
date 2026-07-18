"""Unit tests for the active → freeze self-enforcement (#861, T3).

Two seams, both keyed off ``instance_config.current_phase``:

- ``reject_when_frozen`` — the game-action write-gate (409 once the instance is frozen/ended).
- ``state_update`` — the sim tick halts once frozen (play is over).

Both are exercised here by monkeypatching the phase, so the tests need neither a real on-disk
config nor a running engine.
"""

from __future__ import annotations

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
    tick_execution.state_update()  # returns cleanly; the AssertionError above would fire if it ticked
