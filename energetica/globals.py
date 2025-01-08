"""Global variables used in the game."""
# TODO(mglst): Rename this module to something else, as it shadows the built-in `globals` function.

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine

engine: GameEngine = None  # type: ignore
