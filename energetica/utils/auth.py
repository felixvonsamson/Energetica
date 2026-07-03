"""Utility functions for authentication."""

import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import requests
from fastapi import HTTPException, Request, Response, status
from itsdangerous import URLSafeTimedSerializer

from energetica.database.player import Player
from energetica.database.user import User
from energetica.game_error import GameExceptionType


def get_or_create_secret_key() -> str:
    """Load the cookie-signing SECRET_KEY, preferring the server-wide shared secret.

    Resolution order (lobby Phase A — shared-secret *support*, cookie scope unchanged):

    1. The server-wide shared secret ``/var/lib/energetica/secret_key.txt`` if present. It is
       provisioned by ``setup-base.sh`` and shared across every instance so a session minted by
       the lobby validates everywhere. Read-only here — the instance never creates it.
    2. Otherwise the per-instance ``instance/secret_key.txt`` (the pre-lobby behaviour),
       creating it on first run.

    Both paths are env-overridable for tests. An existing-but-empty file fails loud rather than
    signing cookies with a zero-entropy key (which ``URLSafeTimedSerializer`` would accept) — a
    truncated write or a cleared file must not silently make every session cookie forgeable.
    """
    shared_path = os.environ.get("ENERGETICA_SHARED_SECRET_PATH", "/var/lib/energetica/secret_key.txt")
    if os.path.exists(shared_path):
        return _read_nonempty_secret(shared_path)

    instance_path = os.environ.get("ENERGETICA_INSTANCE_SECRET_PATH", "instance/secret_key.txt")
    if os.path.exists(instance_path):
        return _read_nonempty_secret(instance_path)

    secret_key = secrets.token_hex()
    with open(instance_path, "w", encoding="utf-8") as f:
        f.write(secret_key)
    return secret_key


def _read_nonempty_secret(path: str) -> str:
    """Read a secret-key file, raising if it exists but is empty (guessable zero-entropy key)."""
    with open(path, "r", encoding="utf-8") as f:
        key = f.read().strip()
    if not key:
        raise RuntimeError(f"secret key file at {path} is empty — refusing to sign cookies with an empty key")
    return key


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
    if (
        user.player.last_connection is None
        or (datetime.now(timezone.utc) - user.player.last_connection).total_seconds() > 300
    ):
        user.player.last_connection = datetime.now(timezone.utc)
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
