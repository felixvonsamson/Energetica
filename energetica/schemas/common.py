from pydantic import BaseModel


class GameErrorResponse(BaseModel):
    """Response model for game errors."""

    game_exception_type: str
