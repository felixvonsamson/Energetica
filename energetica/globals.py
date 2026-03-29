"""Global variables used in the game."""
# TODO(mglst): Rename this module to something else, as it shadows the built-in `globals` function.

from __future__ import annotations

from asyncio import AbstractEventLoop
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine

engine: GameEngine = None  # type: ignore
MAIN_EVENT_LOOP: AbstractEventLoop
