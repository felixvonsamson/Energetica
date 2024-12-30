"""Global variables used in the game."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine

engine: GameEngine = None
