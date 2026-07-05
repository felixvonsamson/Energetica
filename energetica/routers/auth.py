"""
Authentication setup for Energetica.

Defines utility functions for cookie based auth and endpoints for sign-in and sign-up.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from energetica import __release_date__, __version__, accounts, instance_config
from energetica.database.user import User
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    SignupRequest,
    UserOut,
)
from energetica.schemas.capabilities import PlayerCapabilities
from energetica.utils import misc
from energetica.utils.auth import (
    add_session_cookie_to_response,
    check_password_hash,
    generate_password_hash,
    get_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _enforce_instance_access(username: str) -> None:
    """Gate login/signup on this instance's access policy.

    Reads ``instance.json`` fresh (no cache) so admin edits take effect on the next attempt.
    An unconfigured instance (no slug / no file) is treated as ``public``. A present-but-broken
    config fails closed. On a successful, allowed read, the public-facing fragment is re-published
    if its fields have changed since this process last wrote them.
    """
    try:
        config = instance_config.load_instance_config()
    except instance_config.InstanceConfigError as exc:
        engine.log(f"login/signup blocked: {exc}")
        raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED) from exc
    if config is not None and not instance_config.is_access_allowed(config, username):
        raise HTTPException(status.HTTP_403_FORBIDDEN, GameExceptionType.INSTANCE_ACCESS_DENIED)
    instance_config.publish(config)


@router.get("/me")
def get_current_user(user: Annotated[User | None, Depends(get_user)]) -> UserOut:
    """Get the current authenticated user's information."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GameExceptionType.NOT_AUTHENTICATED,
        )

    # Get capabilities if user is a settled player
    capabilities = None
    if user.player is not None:
        capabilities = PlayerCapabilities.from_player(user.player)

    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        player_id=user.player.id if user.player is not None else None,
        is_settled=user.player is not None,
        capabilities=capabilities,
    )


@router.post("/login", tags=["Authentication"], status_code=status.HTTP_200_OK)
def login(request: Request, request_data: LoginRequest) -> Response:
    username = request_data.username
    password = request_data.password

    account = accounts.get_account_by_username(username)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=GameExceptionType.USER_NOT_FOUND,
            headers={"release-date": __release_date__, "version": __version__},
        )

    if not check_password_hash(plain_password=password, hashed_password=account.pwhash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GameExceptionType.INVALID_PASSWORD)

    # Credentials are valid server-wide; this instance's access policy decides whether they may
    # log in here. Enforced for existing and first-time users alike (private instances may have
    # been locked down after a user was provisioned).
    _enforce_instance_access(username)

    user = next(User.filter_by(account_id=account.account_id), None)
    if user is None:
        # First visit to this instance: provision a pickle User for the server-wide account.
        # Player creation still happens at the settle page.
        user = User(username=account.username, pwhash=account.pwhash, role="player", account_id=account.account_id)
        engine.log(f"{username} auto-provisioned on this instance from server-wide account")

    engine.log(f"{username} logged in")

    response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK)
    return add_session_cookie_to_response(response, user.username, request)


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(request: Request, request_data: SignupRequest) -> Response:
    """Create a new account."""
    if engine.disable_signups:
        raise GameError(GameExceptionType.SIGNUP_DISABLED)
    username = request_data.username
    password = request_data.password
    # A private instance must not let an unlisted username create a (server-wide) account here.
    _enforce_instance_access(username)
    pwhash = generate_password_hash(password)
    try:
        user = misc.signup_playing_user(request, username, pwhash)
    except accounts.UsernameTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, GameExceptionType.USERNAME_TAKEN)
    return add_session_cookie_to_response(
        JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED), user.username, request
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(  # noqa: ANN201
    request_data: ChangePasswordRequest,
    user: Annotated[User | None, Depends(get_user)],
):
    """Change the password for the current user. The new hash is written to the server-wide
    SQLite accounts store; the pickle ``pwhash`` is kept in sync as a non-load-bearing mirror.
    """
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)
    old_password = request_data.old_password
    new_password = request_data.new_password

    account = accounts.get_account_by_username(user.username)
    if account is None or not check_password_hash(plain_password=old_password, hashed_password=account.pwhash):
        raise GameError(GameExceptionType.OLD_PASSWORD_INCORRECT)

    new_pwhash = generate_password_hash(new_password)
    accounts.update_password(username=user.username, new_pwhash=new_pwhash)
    user.pwhash = new_pwhash
    engine.log(f"{user.username} changed their password")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: Annotated[User | None, Depends(get_user)]) -> Response:
    """Logout the current user."""
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.NOT_AUTHENTICATED)

    engine.log(f"{user.username} logged out")
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie("session", path="/")
    return response
