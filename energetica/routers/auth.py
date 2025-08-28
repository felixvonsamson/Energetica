"""
Authentication setup for Energetica.

Defines utility functions for cookie based auth and endpoints for sign-in and sign-up.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from energetica.database.user import User
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
    get_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", tags=["Authentication"], status_code=status.HTTP_200_OK)
def login(request_data: LoginRequest) -> Response:
    username = request_data.username
    password = request_data.password

    user = next(User.filter_by(username=username), None)

    if user is None:
        raise InvalidCredentialsException

    if not check_password_hash(plain_password=password, hashed_password=user.pwhash):
        raise InvalidCredentialsException

    engine.log(f"{username} logged in")

    response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK)
    return add_session_cookie_to_response(response, user)

    # TODO: manage nice messages about old accounts
    # flash(
    #     f"Username does not exist.<br><b>All accounts created before the {energetica.__release_date__} "
    #     f"have been<br>deleted due to a server reset for the {energetica.__version__} update.<br>"
    #     "If your account has been deleted, please create a new one.</b>",
    #     category="error",
    # )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(request: Request, request_data: SignupRequest) -> Response:
    """Create a new account."""
    if engine.disable_signups:
        raise GameError(GameExceptionType.SIGNUP_DISABLED)
    username = request_data.username
    password = request_data.password
    existing_user = next(User.filter_by(username=username), None)
    if existing_user:
        raise HTTPException(status.HTTP_409_CONFLICT, "username is taken")
    pwhash = generate_password_hash(password)
    user = misc.signup_playing_user(request, username, pwhash)
    return add_session_cookie_to_response(
        JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED),
        user,
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(  # noqa: ANN201
    request_data: ChangePasswordRequest,
    user: Annotated[User | None, Depends(get_user)],
):
    """Change the password for the current user."""
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not authenticated")
    old_password = request_data.old_password
    new_password = request_data.new_password
    if not check_password_hash(plain_password=old_password, hashed_password=user.pwhash):
        raise GameError(GameExceptionType.OLD_PASSWORD_INCORRECT)
    user.pwhash = generate_password_hash(new_password)
    engine.log(f"{user.username} changed their password")
