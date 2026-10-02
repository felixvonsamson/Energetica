"""The error envelope: the JSON shape every error response takes, and the handlers that produce it.

The frontend decodes errors in one format, whichever app sent them. A :class:`GameError` becomes a
``400`` whose body is a :class:`GameErrorOut`. A request that fails schema validation becomes a
``422`` whose body lists the validation errors under ``detail`` and marks itself with
``meta.error_type == "request_validation_error"``. Each app calls :func:`install_error_handlers`
rather than defining its own handlers, so the format has one definition and a new app, such as
Workshop's, gets it by making the same call.
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from energetica.kernel.game_error import GameError


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


def install_error_handlers(app: FastAPI) -> None:
    """Register the handlers that turn :class:`GameError` and :class:`RequestValidationError` into
    the error envelope on ``app``.
    """

    @app.exception_handler(RequestValidationError)
    def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """If the validation of pydantic schemas fails (e.g. string too short), return a 422 with details."""
        return JSONResponse(
            content={
                "detail": jsonable_encoder(exc.errors()),
                "meta": {"error_type": "request_validation_error"},
            },
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(GameError)
    def game_error_handler(request: Request, exc: GameError) -> JSONResponse:
        """Turn a GameError raised anywhere in a route into a 400 carrying its type and kwargs."""
        content = GameErrorOut.from_game_error(exc)
        return JSONResponse(content=content.model_dump(by_alias=True), status_code=status.HTTP_400_BAD_REQUEST)
