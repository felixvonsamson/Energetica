"""Utility functions for authentication."""

import os
import secrets
from datetime import timedelta

import bcrypt
import requests
from fastapi import HTTPException, Request, Response, status
from itsdangerous import URLSafeTimedSerializer

from energetica.database.player import Player
from energetica.database.user import User
from energetica.game_error import GameExceptionType


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


def get_user_from_token(token: str) -> User | None:
    try:
        username = serializer.loads(token, max_age=COOKIE_MAX_AGE)
        return next(User.filter_by(username=username), None)
    except Exception:
        return None


def get_user(request: Request) -> User | None:
    token = request.cookies.get("session")
    if not token:
        return None
    return get_user_from_token(token)


def get_playing_user(request: Request) -> User:
    user = get_user(request)
    if user is None or user.role != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    return user


def get_settled_player(request: Request) -> Player:
    user = get_user(request)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GameExceptionType.NOT_AUTHENTICATED)
    if user.role != "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GameExceptionType.USER_IS_NOT_A_PLAYER)
    if user.player is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=GameExceptionType.PLAYER_NOT_SET_UP)
    return user.player


def add_session_cookie_to_response(response: Response, user: User, request: Request) -> Response:
    token = serializer.dumps(user.username)
    # Check if behind reverse proxy with HTTPS
    is_https = request.headers.get("X-Forwarded-Proto") == "https"
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
    )
    return response


def add_session_cookie_to_session(session: requests.Session, user: User) -> requests.Session:
    token = serializer.dumps(user.username)
    session.cookies.set(
        name="session",
        value=token,
        path="/",
        secure=False,
        rest={"HttpOnly": True, "SameSite": "Lax"},
    )
    return session
