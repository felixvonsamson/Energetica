import json
import logging
from datetime import datetime
from typing import Awaitable, Callable

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from energetica.api.http import todo_router
from energetica.auth import get_current_user
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.routers.templates import router as templates_router
from energetica.schemas.common import GameErrorResponse

from .templates import router as templates_router

__all__ = ["templates_router"]


class SocketIOFilter(logging.Filter):
    def filter(self, record: logging.LogRecord):
        return "/socket.io/" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(SocketIOFilter())


def setup_routes(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            content={
                "detail": jsonable_encoder(exc.errors()),
                "meta": {"error_type": "request_validation_error"},
            },
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(GameError)
    async def global_exception_handler(request: Request, exc: GameError) -> JSONResponse:
        """Handle global game exceptions."""
        content = GameErrorResponse(response=exc.exception_type)
        return JSONResponse(content=content.model_dump(), status_code=status.HTTP_403_FORBIDDEN)

    @app.middleware("log_action")
    async def log_action(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Restrict access to the API during the simulation.
        if (
            engine.serve_local
            and request.method == "POST"
            and request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "")
            != "127.0.0.1"
        ):
            return Response(
                status_code=503,
                content="Service temporarily unavailable. Please try again in a few seconds",
            )

        # GET requests can be served immediately
        if request.method != "POST" or request.url.path == "/socket.io/":
            response = await call_next(request)
            path = request.url.path
            if path.startswith("/api") or request.url.path == "/socket.io/":
                return response
            if response.status_code == status.HTTP_401_UNAUTHORIZED:
                return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
            return response

        start = datetime.now()

        # Request body is read-once only - store it
        body_bytes = await request.body()

        # Reattach body for downstream consumers (endpoint handlers)
        async def receive() -> dict:
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request = Request(request.scope, receive=receive)

        with engine.lock:
            response = await call_next(request)

        # Try to decode the request and response
        try:
            request_content = json.loads(body_bytes.decode())
        except Exception:
            request_content = "unparsable or not JSON"

        # Buffer the response body
        response_body = b""
        async for chunk in response.__dict__.get("body_iterator", []):
            response_body += chunk

        # Rebuild the response so FastAPI can send it
        new_response = Response(
            content=response_body,
            status_code=response.status_code,
            headers=response.headers,
            media_type=response.media_type,
        )

        try:
            response_content = json.loads(response_body.decode())
        except Exception:
            response_content = "unparsable"

        try:
            user = get_current_user(request)
            player_id = user.id
        except HTTPException:
            player_id = None

        log_entry = {
            "timestamp": start.isoformat(),
            "elapsed": (datetime.now() - start).total_seconds(),
            "ip": request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "null"),
            "action_type": "request",
            "player_id": player_id,
            "request": {
                "endpoint": request.url.path,
                "content_type": request.headers.get("content-type"),
                "content": request_content,
            },
            "response": {
                "status_code": response.status_code,
                "content_type": response.headers.get("content-type", "unknown"),
                "content": response_content,
            },
        }
        engine.log_action(log_entry)
        return new_response

    app.include_router(templates_router)
    app.include_router(todo_router, prefix="/api")
    app.mount("/static", StaticFiles(directory="energetica/static"), name="static")
