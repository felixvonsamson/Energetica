"""Lobby HTTP routes: credentials + session (``/auth/*``) and the picker read (``/lobby/*``).

Mounted under ``/api/v1`` by :func:`lobby.app.create_lobby_app`. Request/response schemas are the
identity layer's (``energetica.identity.schemas.auth`` / ``energetica.identity.schemas.lobby``) so the
frontend's generated types cover the lobby unchanged. Unlike the instance, signup here is
**account-only** — one account, no ``User``/``Player``/instance (ADR-0003) — and is gated by the
server-wide ``server.json`` toggle, not any per-instance policy.

Every account, password and membership operation is a call to the lobby service, which owns
``lobby.db`` and mints session tokens (ADR-0009). These routes translate its answers into the
responses the lobby frontend expects.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from energetica.identity import instance_config, server_config
from energetica.identity.lobby_service_client import LobbyServiceRefusal
from energetica.identity.my_runs import build_my_runs
from energetica.identity.schemas.auth import LoginRequest, SignupRequest
from energetica.identity.schemas.lobby import MyRunsResponse
from energetica.identity.schemas.lobby_service import LobbyServiceErrorCode, SessionOut
from energetica.kernel.game_error import GameError, SharedErrorCode
from lobby.deps import LobbyService, require_current_account
from lobby.game_error import LobbyErrorCode
from lobby.session import clear_lobby_session_cookie, set_lobby_session_cookie

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
lobby_router = APIRouter(prefix="/lobby", tags=["Lobby"])

CurrentAccount = Annotated[SessionOut, Depends(require_current_account)]


@auth_router.post("/login", status_code=status.HTTP_200_OK)
def login(request: Request, request_data: LoginRequest, service: LobbyService) -> Response:
    """Have the lobby service check the credentials and mint a session, then set it as the
    parent-domain session cookie.
    """
    try:
        token = service.create_session(username=request_data.username, password=request_data.password)
    except LobbyServiceRefusal as refusal:
        if refusal.code == LobbyServiceErrorCode.USER_NOT_FOUND:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, SharedErrorCode.USER_NOT_FOUND)
        if refusal.code == LobbyServiceErrorCode.INVALID_PASSWORD:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, LobbyErrorCode.INVALID_PASSWORD)
        raise

    response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_200_OK)
    return set_lobby_session_cookie(response, token, request)


@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(request: Request, request_data: SignupRequest, service: LobbyService) -> Response:
    """Create a server-wide account (only) and auto-log-in. Gated by the server-wide signup toggle;
    joining a run is a later, separate act gated at the instance's entry gate (ADR-0003).
    """
    if not server_config.signups_enabled():
        raise GameError(LobbyErrorCode.SIGNUP_DISABLED)

    try:
        created = service.create_account(username=request_data.username, password=request_data.password)
    except LobbyServiceRefusal as refusal:
        if refusal.code == LobbyServiceErrorCode.USERNAME_TAKEN:
            raise HTTPException(status.HTTP_409_CONFLICT, LobbyErrorCode.USERNAME_TAKEN)
        raise

    response = JSONResponse(content={"response": "success"}, status_code=status.HTTP_201_CREATED)
    return set_lobby_session_cookie(response, created.token, request)


@auth_router.post("/change-password-form", include_in_schema=False)
def change_password_form(
    account: CurrentAccount,
    old_password: Annotated[str, Form()],
    new_password: Annotated[str, Form()],
    service: LobbyService,
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
    normal flow; ``too-short`` is a defensive fallback for a submit that bypassed the client. The
    lobby service makes both checks, in that order.
    """
    try:
        service.change_password(account.account_id, old_password=old_password, new_password=new_password)
    except LobbyServiceRefusal as refusal:
        if refusal.code == LobbyServiceErrorCode.OLD_PASSWORD_INCORRECT:
            return RedirectResponse("/account?pw=old-incorrect", status_code=status.HTTP_303_SEE_OTHER)
        if refusal.code == LobbyServiceErrorCode.PASSWORD_TOO_SHORT:
            return RedirectResponse("/account?pw=too-short", status_code=status.HTTP_303_SEE_OTHER)
        raise
    return RedirectResponse("/account?pw=changed", status_code=status.HTTP_303_SEE_OTHER)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(account: CurrentAccount) -> Response:
    """Global logout: clear the single parent-domain cookie → logged out of every run."""
    return clear_lobby_session_cookie(Response(status_code=status.HTTP_204_NO_CONTENT))


@lobby_router.get("/my-runs")
def get_my_runs(account: CurrentAccount, service: LobbyService) -> MyRunsResponse:
    """The authenticated account's joined runs (same read the instance serves in-run)."""
    return build_my_runs(account.username, service.get_memberships(account.account_id), expires_at=account.expires_at)


@lobby_router.post("/runs/{slug}/join", status_code=status.HTTP_204_NO_CONTENT)
def join_run(slug: str, account: CurrentAccount, service: LobbyService) -> Response:
    """The picker's explicit two-click join (#1030): record that ``account`` has joined the
    public run ``slug``, straight from the lobby, before it ever visits that run's own origin.
    Idempotent — joining twice is a no-op.

    This is the public-run join path only. A private run's admission stays entirely
    instance-owned (the facilitator roster / join-link flow, #1019-#1022) — the lobby only ever
    sees a private instance's stripped fragment (``InstanceFragment.private``), never its
    allowlist, so it cannot decide who may join one.
    """
    fragment = instance_config.load_fragment(slug)
    if fragment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, LobbyErrorCode.RUN_NOT_FOUND)
    if fragment.private:
        raise HTTPException(status.HTTP_403_FORBIDDEN, SharedErrorCode.INSTANCE_ACCESS_DENIED)
    if fragment.mode == "freeplay" and account.expires_at is not None:
        # The run's entry gate refuses a temporary account too. Refusing here keeps the join from
        # listing a run under "your runs" that the account can never enter (#1383).
        raise HTTPException(status.HTTP_403_FORBIDDEN, SharedErrorCode.TEMPORARY_ACCOUNT_IN_FREEPLAY)
    try:
        service.add_run_member(slug, account.account_id)
    except LobbyServiceRefusal as refusal:
        if refusal.code == LobbyServiceErrorCode.ROLE_CONFLICT:
            # account is this run's facilitator (or server-wide) — a facilitator administers a run,
            # it doesn't also join one as a player (ADR-0004).
            raise HTTPException(status.HTTP_403_FORBIDDEN, SharedErrorCode.INSTANCE_ACCESS_DENIED)
        raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)
