"""Schemas common to all API routes."""

from __future__ import annotations

from pydantic import BaseModel

from energetica.game_error import GameError


class GameErrorOut(BaseModel):
    """Response model for game errors."""

    game_exception_type: str

    @classmethod
    def from_game_error(cls, game_error: GameError) -> GameErrorOut:
        return GameErrorOut(game_exception_type=game_error.exception_type)
