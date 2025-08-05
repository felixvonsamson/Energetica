"""
Authentication setup for Energetica.

Defines utility functions for cookie based auth and endpoints for sign-in and sign-up.
"""

import os
import secrets
from datetime import timedelta
from typing import Annotated

import bcrypt
from fastapi import Depends, FastAPI, Form, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from itsdangerous import URLSafeTimedSerializer

from energetica.database.player import Player
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.schemas.auth import ChangePasswordRequest, LoginRequest, RootSignupRequest, SignupRequest
from energetica.utils import misc

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


def check_password_hash(*, plain_password: str, hashed_password: str) -> bool:
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
        secure=False,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
    )
    return response


def setup_auth(app: FastAPI) -> None:
    @app.post("/login", tags=["Authentication"])
    def login(request_data: LoginRequest):
        username = request_data.username
        password = request_data.password

        player = next(Player.filter_by(username=username), None)

        if player is None:
            raise InvalidCredentialsException

        if not check_password_hash(plain_password=password, hashed_password=player.pwhash):
            raise InvalidCredentialsException

        engine.log(f"{username} logged in")

        response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK)
        return add_session_cookie_to_response(response, player)

        # TODO: manage nice messages about old accounts
        # flash(
        #     f"Username does not exist.<br><b>All accounts created before the {energetica.__release_date__} "
        #     f"have been<br>deleted due to a server reset for the {energetica.__version__} update.<br>"
        #     "If your account has been deleted, please create a new one.</b>",
        #     category="error",
        # )

    # TODO: relocate endpoint to sign-up as this is standard
    @app.post("/sign-up", tags=["Authentication"])
    def signup(request: Request, request_data: SignupRequest):
        """Create a new account."""
        if engine.disable_signups:
            raise GameError("Sign-ups are disabled.")
        username = request_data.username
        password = request_data.password
        existing_player = next(Player.filter_by(username=username), None)
        if existing_player:
            raise HTTPException(status.HTTP_409_CONFLICT, "username is taken")
        pwhash = generate_password_hash(password)
        new_player = misc.signup_player(request, username, pwhash)
        return add_session_cookie_to_response(
            JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED),
            new_player,
        )

    @app.post("/root/login")
    def root_login(request: Request, user_id: Annotated[int, Form()]):
        addr = request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else None)
        if addr is None or addr != "127.0.0.1":
            return Response(status_code=status.HTTP_401_UNAUTHORIZED)
        player = Player.get(int(user_id))
        if player is None:
            return Response(status_code=status.HTTP_404_NOT_FOUND)
        engine.log(f"{player.username} logged in")
        response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK)
        return add_session_cookie_to_response(response, player)

    @app.post("/root/sign-up")
    def root_signup(request: Request, request_data: RootSignupRequest):
        """Create a new account."""
        username = request_data.username
        pwhash = request_data.pwhash
        existing_player = next(Player.filter_by(username=username), None)
        if existing_player:
            raise HTTPException(status.HTTP_409_CONFLICT, "username is taken")
        new_player = misc.signup_player(request, username, pwhash)
        return add_session_cookie_to_response(
            JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED),
            new_player,
        )

    @app.post("/change-password", tags=["Authentication"])
    def change_password(player: Annotated[Player, Depends(get_current_user)], request_data: ChangePasswordRequest):
        """Change the password for the current user."""
        old_password = request_data.old_password
        new_password = request_data.new_password
        if not check_password_hash(plain_password=old_password, hashed_password=player.pwhash):
            raise GameError("Old password is incorrect.")
        player.pwhash = generate_password_hash(new_password)
        engine.log(f"{player.username} changed their password")
        return RedirectResponse("/settings", status_code=status.HTTP_303_SEE_OTHER)
