"""The lobby FastAPI application factory.

Kept tiny and engine-free: it wires the two routers under ``/api/v1`` and reuses the game's error
envelope so error responses match ``api.generated.ts`` and the frontend's error handling.
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from energetica.game_error import GameError
from energetica.schemas.common import GameErrorOut
from lobby.routers import auth_router, lobby_router


def create_lobby_app(*, schema_only: bool = False) -> FastAPI:
    """Build the lobby app. ``schema_only`` is accepted for symmetry with the game's ``create_app``
    (unused today: the lobby reuses the game's generated types, so it needs no schema export).
    """
    app = FastAPI(title="Energetica Lobby")

    @app.exception_handler(RequestValidationError)
    def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Mirror the game's 422 envelope for schema validation failures (e.g. password too short)."""
        return JSONResponse(
            content={
                "detail": jsonable_encoder(exc.errors()),
                "meta": {"error_type": "request_validation_error"},
            },
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(GameError)
    def game_error_handler(request: Request, exc: GameError) -> JSONResponse:
        """Mirror the game's 400 GameError envelope so the frontend decodes lobby errors identically."""
        content = GameErrorOut.from_game_error(exc)
        return JSONResponse(content=content.model_dump(by_alias=True), status_code=status.HTTP_400_BAD_REQUEST)

    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(lobby_router, prefix="/api/v1")

    return app
