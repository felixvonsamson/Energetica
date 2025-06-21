"""
Class for errors in the game.

These include game-level for API response like "not enough money".
"""

from typing import Any

from energetica.schemas.common import GameErrorResponse


class GameError(Exception):
    """Define the exception class for the game engine."""

    def __init__(self, exception_type: str, **kwargs: Any):
        self.exception_type = exception_type
        self.kwargs = kwargs
        Exception.__init__(self, exception_type)

    def to_schema(self) -> GameErrorResponse:
        return GameErrorResponse(game_exception_type=self.exception_type)
