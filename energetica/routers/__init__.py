import json
import logging
import urllib.parse
from datetime import datetime
from typing import Awaitable, Callable, cast

from fastapi import FastAPI, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from energetica.api.http import todo_router
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.routers.templates import router as templates_router
from energetica.schemas.common import ConfirmOut, GameErrorOut
from energetica.schemas.simulate import ApiAction, ApiActionRequest, ApiActionResponse, Method
from energetica.utils.auth import get_current_user_from_request

from .achievements import router as achievements_router
from .auth import router as auth_router
from .browser_notifications import router as browser_notifications_router
from .chats import router as chat_router
from .daily_quiz import router as daily_quiz_router
from .facilities import router as facilities_router
from .map import router as map_router
from .networks import router as network_router
from .notifications import router as notifications_router
from .players import router as player_router
from .power_priorities import router as power_priorities
from .projects import router as projects_router
from .resource_market import router as resource_market_router
from .scoreboard import router as scoreboard_router
from .shipments import router as shipments_router
from .templates import router as templates_router
from .weather import router as weather_router

__all__ = ["templates_router"]

api_routers = [
    achievements_router,
    auth_router,
    browser_notifications_router,
    chat_router,
    daily_quiz_router,
    facilities_router,
    map_router,
    network_router,
    notifications_router,
    player_router,
    power_priorities,
    projects_router,
    resource_market_router,
    shipments_router,
    scoreboard_router,
    weather_router,
]


class SocketIOFilter(logging.Filter):
    def filter(self, record: logging.LogRecord):
        return "/socket.io/" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(SocketIOFilter())


def setup_routes(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            content={
                "detail": jsonable_encoder(exc.errors()),
                "meta": {"error_type": "request_validation_error"},
            },
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(GameError)
    def global_exception_handler(request: Request, exc: GameError) -> JSONResponse:
        """Handle global game exceptions."""
        content = GameErrorOut.from_game_error(exc)
        return JSONResponse(content=content.model_dump(by_alias=True), status_code=status.HTTP_400_BAD_REQUEST)

    @app.exception_handler(Confirm)
    def global_confirm_handler(request: Request, confirm: Confirm):
        """Handle confirm 'errors'."""
        return JSONResponse(
            content=ConfirmOut.from_confirm(confirm).model_dump(),
            status_code=status.HTTP_300_MULTIPLE_CHOICES,
        )

    @app.middleware("log_action")
    async def log_action(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Restrict access to the API during the simulation.
        if (
            engine.serve_local
            and request.method != "GET"
            and request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "")
            != "127.0.0.1"
        ):
            return Response(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content="Service temporarily unavailable. Please try again in a few seconds",
            )

        # GET requests can be served immediately
        path = request.url.path
        auth_request = "/auth/" in path
        get_request = path == "/socket.io/" or request.method == "GET"
        if auth_request or get_request:
            try:
                response = await call_next(request)
            except Exception as e:
                print("There was an error when constructing the response for the following request:")
                print(f"{request.method} {request.url.path}")
                print(f"content-type: {request.headers.get('content-type')}")
                raise e
            if get_request and response.status_code == status.HTTP_401_UNAUTHORIZED:
                return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
            return response

        start = datetime.now()

        # Request body is read-once only - store it
        body_bytes = await request.body()

        # Reattach body for downstream consumers (endpoint handlers)
        async def receive() -> dict:
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request = Request(request.scope, receive=receive)

        # Try to decode the request and response
        if request.headers.get("content-type") == "application/x-www-form-urlencoded":
            request_payload = {
                k: v[0] if len(v) == 1 else v for k, v in urllib.parse.parse_qs(body_bytes.decode()).items()
            }
        else:
            try:
                request_payload = json.loads(body_bytes.decode())
            except Exception:
                request_payload = "unparsable or not JSON"

        with engine.lock:
            try:
                response = await call_next(request)
            except Exception as e:
                print("There was an error when constructing the response for the following request:")
                print(f"{request.method} {request.url.path}")
                print(f"content-type: {request.headers.get('content-type')}")
                print(f"payload: {request_payload}")
                raise e

        if request.url.path.startswith("/auth"):
            return response

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
            response_payload = json.loads(response_body.decode())
        except Exception:
            response_payload = "unparsable or not JSON"

        user = get_current_user_from_request(request)
        player_id = user.id if user is not None else None

        log_entry = ApiAction(
            timestamp=start,
            elapsed=(datetime.now() - start).total_seconds(),
            ip=request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "null"),
            action_type="request",
            player_id=player_id,
            request=ApiActionRequest(
                endpoint=request.url.path,
                method=cast(Method, request.method),
                content_type=request.headers.get("content-type"),
                payload=request_payload,
            ),
            response=ApiActionResponse(
                status_code=response.status_code,
                content_type=response.headers.get("content-type", "unknown"),
                payload=response_payload,
            ),
        )
        engine.log_action(log_entry)
        return new_response

    for router in api_routers:
        app.include_router(router, prefix="/api/v1")
    app.include_router(templates_router)
    app.include_router(todo_router, prefix="/api")
    app.mount("/static", StaticFiles(directory="energetica/static"), name="static")
