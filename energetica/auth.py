"""
Authentication setup for Energetica.

Defines utility functions for cookie based auth and endpoints for sign-in and sign-up.
"""

import os
import secrets
from datetime import datetime, timedelta
from typing import Annotated

import bcrypt
from fastapi import FastAPI, Form, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from itsdangerous import URLSafeTimedSerializer

from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.auth import LoginData, SignupData

COOKIE_MAX_AGE = int(timedelta(days=60).total_seconds())  # NOTE: could be a command line argument in the future

InvalidCredentialsException = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


def get_or_create_secret_key() -> str:
    """Load or create SECRET_KEY for signing cookies."""
    filepath = "instance/secret_key.txt"
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    else:
        secret_key = secrets.token_hex()
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(secret_key)
        return secret_key


SECRET_KEY = get_or_create_secret_key()
serializer = URLSafeTimedSerializer(SECRET_KEY)


def generate_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt)
    return hashed.decode()


def check_password_hash(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_current_user(request: Request) -> Player:
    player = get_current_user_from_request(request)
    if player is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return player


def get_current_user_from_request(request: Request) -> Player | None:
    token = request.cookies.get("session")
    if not token:
        return None
    return get_current_user_from_token(token)


def get_current_user_from_token(token: str) -> Player | None:
    try:
        username = serializer.loads(token, max_age=COOKIE_MAX_AGE)
        return next(Player.filter_by(username=username), None)
    except Exception:
        return None


def add_session_cookie_to_response(response: Response, player: Player) -> Response:
    token = serializer.dumps(player.username)
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=engine.env != "dev",
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
    )
    return response


def setup_auth(app: FastAPI) -> None:
    @app.post("/login", tags=["Authentication"])
    def login(request_data: LoginData):
        username = request_data.username
        password = request_data.password

        if not username or not password:
            raise InvalidCredentialsException

        player = next(Player.filter_by(username=username), None)

        if player is None:
            raise InvalidCredentialsException

        if not check_password_hash(password, player.pwhash):
            raise InvalidCredentialsException

        engine.log(f"{username} logged in")

        return add_session_cookie_to_response(
            JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK),
            player,
        )

        # TODO: manage nice messages about old accounts
        # flash(
        #     f"Username does not exist.<br><b>All accounts created before the {energetica.__release_date__} "
        #     f"have been<br>deleted due to a server reset for the {energetica.__version__} update.<br>"
        #     "If your account has been deleted, please create a new one.</b>",
        #     category="error",
        # )

    # TODO: relocate endpoint to sign-up as this is standard
    @app.post("/sign-up", tags=["Authentication"])
    def signup(request: Request, request_data: SignupData):
        """Create a new account."""
        username = request_data.username
        password = request_data.password
        existing_player = next(Player.filter_by(username=username), None)
        if existing_player:
            raise HTTPException(status.HTTP_409_CONFLICT, "username is taken")
        pwhash = generate_password_hash(password)
        new_player = Player(username=username, pwhash=pwhash)
        # TODO: Migrate flash message maybe
        # flash("Account created!", category="message")
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "ip": request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "null"),
            "action_type": "create_user",
            "player_id": new_player.id,
            "username": new_player.username,
            "pw_hash": new_player.pwhash,
        }
        engine.log_action(log_entry)
        engine.log(f"{username} created an account")
        return add_session_cookie_to_response(
            JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED),
            new_player,
        )

    @app.post("/root_login")
    def root_login(request: Request, user_id: Annotated[int, Form()]):
        addr = request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else None)
        if addr is None or addr != "127.0.0.1":
            return Response(status_code=status.HTTP_401_UNAUTHORIZED)
        player = Player.get(int(user_id))
        if player is None:
            return Response(status_code=status.HTTP_404_NOT_FOUND)
        engine.log(f"{player.username} logged in")
        JSONResponse("Authenticated", status_code=status.HTTP_200_OK)
        return add_session_cookie_to_response(JSONResponse("Authenticated", status_code=status.HTTP_200_OK), player)
