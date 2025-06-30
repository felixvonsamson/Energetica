"""Schemas common to all API routes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

if TYPE_CHECKING:
    from energetica.game_engine import Confirm
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


class ConfirmOut(BaseApiModel):
    """Response model for confirm 'errors'."""

    type: str
    capacity: float | None = None
    construction_power: float | None = None
    refund: str | None = None

    @classmethod
    def from_confirm(cls, confirm: Confirm) -> ConfirmOut:
        return ConfirmOut(
            type=confirm.__dict__.__getitem__("type"),
            capacity=confirm.__dict__.get("capacity"),
            construction_power=confirm.__dict__.get("construction_power"),
            refund=confirm.__dict__.get("refund"),
        )
