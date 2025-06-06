from pydantic import BaseModel


class GameErrorResponse(BaseModel):
    """Response model for game errors."""

    exception_type: str
