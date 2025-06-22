"""Schemas common to all API routes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

if TYPE_CHECKING:
    from energetica.game_error import GameError


# TODO: switch to this as a base model
class BaseApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class GameErrorOut(BaseModel):
    """Response model for game errors."""

    game_exception_type: str

    @classmethod
    def from_game_error(cls, game_error: GameError) -> GameErrorOut:
        return GameErrorOut(game_exception_type=game_error.exception_type)


class ConfirmResponse(BaseApiModel):
    """Response model for confirm 'errors'."""

    capacity: float | None = None
    construction_power: float | None = None
    refund: float | None = None
