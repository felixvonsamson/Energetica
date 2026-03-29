"""Schemas common to all API routes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from energetica.game_error import GameError


class GameErrorOut(BaseModel):
    """Response model for game errors."""

    game_exception_type: str
    kwargs: dict | None = None

    @classmethod
    def from_game_error(cls, game_error: GameError) -> GameErrorOut:
        return GameErrorOut(
            game_exception_type=game_error.exception_type,
            kwargs=game_error.kwargs if hasattr(game_error, "kwargs") else None,
        )
