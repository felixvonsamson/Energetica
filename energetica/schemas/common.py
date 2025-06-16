from pydantic import BaseModel


class GameErrorResponse(BaseModel):
    """Response model for game errors."""

    # TODO: Rename this game_exception_type
    response: str
