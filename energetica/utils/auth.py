"""Utility functions for authentication."""

import os
import secrets
from datetime import timedelta

import bcrypt
from fastapi import HTTPException, Request, Response, status
from itsdangerous import URLSafeTimedSerializer

from energetica.database.player import Player
from energetica.globals import engine


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


COOKIE_MAX_AGE = int(timedelta(days=60).total_seconds())  # NOTE: could be a command line argument in the future


def get_current_user_from_token(token: str) -> Player | None:
    try:
        username = serializer.loads(token, max_age=COOKIE_MAX_AGE)
        return next(Player.filter_by(username=username), None)
    except Exception:
        return None


def get_current_user_from_request(request: Request) -> Player | None:
    token = request.cookies.get("session")
    if not token:
        return None
    return get_current_user_from_token(token)


def get_current_user(request: Request) -> Player:
    player = get_current_user_from_request(request)
    if player is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return player


InvalidCredentialsException = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


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
