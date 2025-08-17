"""
Authentication setup for Energetica.

Defines utility functions for cookie based auth and endpoints for sign-in and sign-up.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from energetica.database.player import Player
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    SignupRequest,
)
from energetica.utils import misc
from energetica.utils.auth import (
    InvalidCredentialsException,
    add_session_cookie_to_response,
    check_password_hash,
    generate_password_hash,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", tags=["Authentication"], status_code=status.HTTP_200_OK)
def login(request_data: LoginRequest) -> Response:
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


@router.post("/signup", tags=["Authentication"], status_code=status.HTTP_201_CREATED)
def signup(request: Request, request_data: SignupRequest) -> Response:
    """Create a new account."""
    if engine.disable_signups:
        raise GameError(GameExceptionType.SIGNUP_DISABLED)
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


@router.post("/change-password", tags=["Authentication"], status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    player: Annotated[Player, Depends(get_current_user)],
    request_data: ChangePasswordRequest,
) -> None:
    """Change the password for the current user."""
    old_password = request_data.old_password
    new_password = request_data.new_password
    if not check_password_hash(plain_password=old_password, hashed_password=player.pwhash):
        raise GameError(GameExceptionType.OLD_PASSWORD_INCORRECT)
    player.pwhash = generate_password_hash(new_password)
    engine.log(f"{player.username} changed their password")
