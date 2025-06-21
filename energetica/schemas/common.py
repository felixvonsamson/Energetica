"""Schemas common to all API routes."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


# TODO: switch to this as a base model
class BaseApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class GameErrorResponse(BaseModel):
    """Response model for game errors."""

    game_exception_type: str
