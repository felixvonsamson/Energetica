"""Global variables used in the game."""
# TODO(mglst): Rename this module to something else, as it shadows the built-in `globals` function.

from __future__ import annotations

from asyncio import AbstractEventLoop
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine

engine: GameEngine = None  # type: ignore
# Bound to the serving event loop in the app lifespan (energetica.__init__). None until then, so
# only read it at call time (emit sites late-import it) — never snapshot it at module import, which
# would capture this None / a pre-serving loop. See the lifespan comment for the full rationale.
MAIN_EVENT_LOOP: AbstractEventLoop = None  # type: ignore[assignment]
