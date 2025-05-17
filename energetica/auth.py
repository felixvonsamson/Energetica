"""
Authentication setup for Energetica.

Defines utility functions for cookie based auth and endpoints for sign-in and sign-up.
"""

import os
import secrets
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_login.exceptions import InvalidCredentialsException
from itsdangerous import URLSafeTimedSerializer
from passlib.context import CryptContext

from energetica.database.player import Player
from energetica.globals import engine


def get_or_create_flask_secret_key() -> str:
    """Load or create SECRET_KEY for Flask."""
    filepath = "instance/flask_secret_key.txt"
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    else:
        secret_key = secrets.token_hex()
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(secret_key)
        return secret_key


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = get_or_create_flask_secret_key()
serializer = URLSafeTimedSerializer(SECRET_KEY)


def check_password_hash(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def generate_password_hash(password: str) -> str:
    return pwd_context.hash(password)


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
        username = serializer.loads(token, max_age=3600)
        return next(Player.filter_by(username=username), None)
    except Exception:
        return None


def setup_auth(app: FastAPI) -> None:
    @app.post("/login")
    def login(data: OAuth2PasswordRequestForm = Depends()):
        username = data.username
        password = data.password

        if not username or not password:
            raise InvalidCredentialsException

        player = next(Player.filter_by(username=username), None)

        if player is None:
            raise InvalidCredentialsException

        if not check_password_hash(password, player.pwhash):
            raise InvalidCredentialsException

        engine.log(f"{username} logged in")

        token = serializer.dumps(username)

        response = RedirectResponse(url="/home", status_code=302)
        response.set_cookie(
            key="session",
            value=token,
            httponly=True,
            secure=False,  # TODO: MAKE THIS TRUE FOR PRODUCTION
            samesite="lax",
            max_age=3600,
        )
        return response

        # TODO: manage nice messages about old accounts
        # flash(
        #     f"Username does not exist.<br><b>All accounts created before the {energetica.__release_date__} "
        #     f"have been<br>deleted due to a server reset for the {energetica.__version__} update.<br>"
        #     "If your account has been deleted, please create a new one.</b>",
        #     category="error",
        # )

    @app.post("/sign-up")
    def sign_up(request: Request, data: OAuth2PasswordRequestForm = Depends()):
        """Create a new account."""
        # TODO: rework signup
        return status.HTTP_501_NOT_IMPLEMENTED
        # username = data.username
        # password = data.password

        # existing_player = next(Player.filter_by(username=username), None)
        # if existing_player:
        #     raise HTTPException(status.HTTP_409_CONFLICT, "username is taken")
        # # elif len(username) < 3 or len(username) > 18:
        # #     flash("Username must be between 3 and 18 characters.", category="error")
        # # elif not pw_hash and len(password1) < 7:
        # #     flash("Password must be at least 7 characters.", category="error")
        # pwhash = generate_password_hash(password)
        # new_player = Player(username=username, pwhash=pwhash)
        # # flash("Account created!", category="message")
        # log_entry = {
        #     "timestamp": datetime.now().isoformat(),
        #     "ip": request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "null"),
        #     "action_type": "create_user",
        #     "player_id": new_player.id,
        #     "username": new_player.username,
        #     "pw_hash": new_player.pwhash,
        # }
        # engine.log_action(log_entry)
        # engine.log(f"{username} created an account")
        # return RedirectResponse("/home")


# TODO
# @auth.route("/root_login", methods=["POST"])
# def root_login() -> Any:
#     if request.headers.get("X-Forwarded-For", request.remote_addr) != "127.0.0.1":
#         abort(404)
#     user_id = request.form.get("user_id")
#     if not user_id:
#         abort(400, description="User ID is required.")
#     player = Player.get(int(user_id))
#     if player is None:
#         abort(404, description="User not found.")
#     login_user(player, remember=True)
#     engine.log(f"{player.username} logged in")
#     return "Authenticated", 200
