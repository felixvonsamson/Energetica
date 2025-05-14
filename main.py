#!/usr/bin/env -S python3 -u
"""Launch the game."""

import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncGenerator, Awaitable, Callable

import socketio
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.wsgi import WSGIMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from energetica import create_app
from energetica.auth import get_current_user
from energetica.flask_app import flask_app
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.routers import api_routers, templates_router, todo_router
from energetica.schemas.common import GameErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    create_app()
    for router in api_routers:
        app.include_router(router, prefix="/api/v1")
    app.include_router(templates_router)
    app.include_router(todo_router, prefix="/api")

    ssl_args = {"keyfile": None, "certfile": None}
    ssl_args = ssl_args if ssl_args["keyfile"] and ssl_args["certfile"] else {}

    print("Mounting Flask app to FastAPI")
    app.mount("/socket.io", socketio.ASGIApp(engine.socketio))
    app.mount("/", WSGIMiddleware(flask_app))
    yield


app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="energetica/static"), name="static")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    exc_str = f"{exc}".replace("\n", " ").replace("   ", " ")
    logging.error(f"{request}: {exc_str}")
    content = {"status_code": 10422, "message": exc_str, "data": None}
    return JSONResponse(content=content, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)


@app.exception_handler(GameError)
async def global_exception_handler(request: Request, exc: GameError) -> JSONResponse:
    """Handle global game exceptions."""
    content = GameErrorResponse(exception_type=exc.exception_type)
    return JSONResponse(content=content.model_dump(), status_code=status.HTTP_400_BAD_REQUEST)


@app.middleware("")
async def log_action(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    # Restrict access to the API during the simulation.
    if (
        engine.serve_local
        and request.method == "POST"
        and request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "")
        != "127.0.0.1"
    ):
        return Response(status_code=503, content="Service temporarily unavailable. Please try again in a few seconds")

    # GET requests can be served immediately
    if request.method != "POST" or request.url.path == "/socket.io/":
        response = await call_next(request)
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
            "content_type": request.headers["content-type"],
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


# if __name__ == "__main__":
#     parser = argparse.ArgumentParser()
#     parser.add_argument(
#         "--clock_time",
#         type=int,
#         choices=[60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1],
#         default=30,
#         help="Set the clock time interval in seconds (default: 60)",
#     )
#     parser.add_argument(
#         "--in_game_seconds_per_tick",
#         type=int,
#         choices=[3600, 1800, 1200, 900, 600, 540, 480, 420, 360, 300, 240, 180, 120, 60, 30],
#         default=240,
#         help="Set  how many in-game seconds are in a tick (default: 240)",
#     )
#     parser.add_argument(
#         "--run_init_test_players",
#         help="Run the init_test_players function",
#         action="store_true",
#     )
#     parser.add_argument(
#         "--rm_instance",
#         help="remove the instance folder",
#         action="store_true",
#     )
#     parser.add_argument(
#         "--random_seed",
#         type=int,
#         default=42,
#         help="Set the random seed",
#         choices=range(65536),
#         metavar="{0..65535}",
#     )
#     parser.add_argument(
#         "--port",
#         type=int,
#         default=5001,
#         help="Port on witch the server should run",
#         choices=range(65536),
#         metavar="{0..65535}",
#     )
#     parser.add_argument(
#         "--simulate_file",
#         type=argparse.FileType("r", encoding="UTF-8"),
#         default=None,
#         help="If given, the server simulates in fast-forward the game with the given action history log file.",
#         metavar="FILE",
#     )
#     parser.add_argument(
#         "--simulate_stop_on_mismatch",
#         action="store_true",
#         help="If game is simulated, stops the simulation if the request response does not match the expected response.",
#     )
#     parser.add_argument(
#         "--simulate_stop_on_server_error",
#         action="store_true",
#         help="If game is simulated, stops the simulation if the server returns an error.",
#     )
#     parser.add_argument(
#         "--simulate_stop_on_assertion_error",
#         action="store_true",
#         help="If game is simulated, stops the simulation if the verification raises an assertion error.",
#     )
#     parser.add_argument(
#         "--simulate_checkpoint_every_k_ticks",
#         type=int,
#         default=10000,
#         help="If game is simulated, save the engine for every tick that is a multiple of the given int.",
#     )
#     parser.add_argument(
#         "--simulate_checkpoint_ticks",
#         nargs="+",
#         type=int,
#         default=[],
#         help="If game is simulated, save the engine for every given tick.",
#     )
#     parser.add_argument(
#         "--simulate_till",
#         type=int,
#         default=None,
#         help="If game is simulated, and if a value is given, only simulates till the given tick, and saves the engine",
#     )
#     parser.add_argument(
#         "--simulate_profiling",
#         action="store_true",
#         help="If game is simulated, allows to run code profiling.",
#     )
#     parser.add_argument(
#         "--keyfile",
#         type=str,
#         default=None,
#         help="Path to the SSL key file",
#     )
#     parser.add_argument(
#         "--certfile",
#         type=str,
#         default=None,
#         help="Path to the SSL certificate file",
#     )

#     kwargs = vars(parser.parse_args())
#     ssl_args = {"keyfile": kwargs.pop("keyfile"), "certfile": kwargs.pop("certfile")}
#     ssl_args = ssl_args if ssl_args["keyfile"] and ssl_args["certfile"] else {}

#     """Initializes mock app."""
#     if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
#         from flask import Flask
#         from flask_socketio import SocketIO

#         app = Flask(__name__)
#         socketio = SocketIO(app, cors_allowed_origins="*")  # engineio_logger=True
#     else:
#         socketio, app = create_app(**kwargs)

#     socketio.run(app, debug=True, log_output=False, host="0.0.0.0", port=kwargs["port"], **ssl_args)
