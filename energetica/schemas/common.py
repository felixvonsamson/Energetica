from pydantic import BaseModel


class GameErrorResponse(BaseModel):
    """Response model for game errors."""

    response: str
