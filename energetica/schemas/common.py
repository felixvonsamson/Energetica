from pydantic import BaseModel


class GameErrorResponse(BaseModel):
    """Response model for game errors."""

    # TODO: rename from response to exception_type
    response: str
