"""Lobby HTTP routes: credentials + session (``/auth/*``) and the picker read (``/lobby/*``).

Mounted under ``/api/v1`` by :func:`lobby.app.create_lobby_app`. Request/response schemas are the
game's own (``energetica.schemas.auth`` / ``energetica.schemas.lobby``) so the frontend's generated
types cover the lobby unchanged. Unlike the instance, signup here is **account-only** — one
``accounts`` row, no ``User``/``Player``/instance (ADR-0003) — and is gated by the server-wide
``server.json`` toggle, not any per-instance policy.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from energetica import accounts, server_config
from energetica.accounts import Account
from energetica.game_error import GameError, GameExceptionType
from energetica.my_runs import resolve_my_runs
from energetica.schemas.auth import LoginRequest, SignupRequest
from energetica.schemas.lobby import MyRunsResponse
from energetica.utils.session import check_password_hash, generate_password_hash
from lobby.deps import require_current_account
from lobby.session import clear_lobby_session_cookie, set_lobby_session_cookie

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
lobby_router = APIRouter(prefix="/lobby", tags=["Lobby"])

# Mirrors SignupRequest.password's floor — kept in sync by hand since the form endpoint below
# validates raw Form fields, not the pydantic model.
MIN_PASSWORD_LENGTH = 7


@auth_router.post("/login", status_code=status.HTTP_200_OK)
def login(request: Request, request_data: LoginRequest) -> Response:
    """Verify credentials against the server-wide accounts store and mint the parent-domain
    session cookie (signed with the shared secret, carrying the account_id).
    """
    account = accounts.get_account_by_username(request_data.username)
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.USER_NOT_FOUND)
    if not check_password_hash(plain_password=request_data.password, hashed_password=account.pwhash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GameExceptionType.INVALID_PASSWORD)

    response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK)
    return set_lobby_session_cookie(response, account.account_id, request)


@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(request: Request, request_data: SignupRequest) -> Response:
    """Create a server-wide account (only) and auto-log-in. Gated by the server-wide signup toggle;
    joining a run is a later, separate act gated at the instance's entry gate (ADR-0003).
    """
    if not server_config.signups_enabled():
        raise GameError(GameExceptionType.SIGNUP_DISABLED)

    pwhash = generate_password_hash(request_data.password)
    try:
        account_id = accounts.create_account(username=request_data.username, pwhash=pwhash)
    except accounts.UsernameTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, GameExceptionType.USERNAME_TAKEN)

    response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED)
    return set_lobby_session_cookie(response, account_id, request)


@auth_router.post("/change-password-form", include_in_schema=False)
def change_password_form(
    account: Annotated[Account, Depends(require_current_account)],
    old_password: Annotated[str, Form()],
    new_password: Annotated[str, Form()],
) -> Response:
    """Change the authenticated account's password via a **native form submission** (Post/Redirect/Get).

    Submitted as a real ``<form method=POST>`` — deliberately not the JSON fetch the rest of the SPA
    uses — because that is what makes Safari / Apple Passwords offer to *update* the saved credential:
    WebKit hooks the form-submit navigation and the submitted current-/new-password fields, whereas an
    intercepted ``fetch`` (``preventDefault``) gives it nothing to detect. So every outcome here is a
    303 redirect back into the lobby SPA (``/account?pw=…``) — never a JSON body a native submit would
    render as raw text — and the account page turns ``?pw`` into a banner. ``include_in_schema=False``
    keeps this redirect route out of the generated typed client (the frontend posts it natively).

    Password-manager detection needs the *navigation*, so client-side validation (match, min length)
    runs first and only the server-only check — is the old password correct — can reach here in the
    normal flow; ``too-short`` is a defensive fallback for a submit that bypassed the client.
    """
    if not check_password_hash(plain_password=old_password, hashed_password=account.pwhash):
        return RedirectResponse("/account?pw=old-incorrect", status_code=status.HTTP_303_SEE_OTHER)
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return RedirectResponse("/account?pw=too-short", status_code=status.HTTP_303_SEE_OTHER)
    accounts.update_password(username=account.username, new_pwhash=generate_password_hash(new_password))
    return RedirectResponse("/account?pw=changed", status_code=status.HTTP_303_SEE_OTHER)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(account: Annotated[Account, Depends(require_current_account)]) -> Response:
    """Global logout: clear the single parent-domain cookie → logged out of every run."""
    return clear_lobby_session_cookie(Response(status_code=status.HTTP_204_NO_CONTENT))


@lobby_router.get("/my-runs")
def get_my_runs(account: Annotated[Account, Depends(require_current_account)]) -> MyRunsResponse:
    """The authenticated account's settled runs (same read the instance serves in-run)."""
    return resolve_my_runs(account.account_id, account.username)
