"""All endpoints for the websocket API."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.game_engine import GameEngine


def login(engine: GameEngine, player: Player) -> None:
    pass
