"""The lobby service's internal API, ``/internal/v1`` (ADR-0009).

Reached only over a Unix socket, so access to the socket file is the only check. Callers name
themselves in ``X-Energetica-Caller``, which is logged with every request so the deployed-versions
table can tell which callers still use which API version. It is never used for trust.

Sessions are minted and checked here only. A token is the same signed ``account_id`` the session
cookie has always carried (:mod:`energetica.kernel.session`), so runs that still check cookies
themselves accept the tokens this service issues.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import APIRouter, FastAPI, Header, HTTPException, Request, Response, status

from energetica.identity.schemas.lobby_service import (
    API_VERSIONS,
    MIN_PASSWORD_LENGTH,
    AccountOut,
    CreatedAccount,
    Credentials,
    FacilitatedRun,
    FacilitatorGrant,
    HealthOut,
    JoinedRun,
    LobbyServiceErrorCode,
    MembershipsOut,
    PasswordChange,
    RunMember,
    SessionOut,
    SessionToken,
)
from energetica.kernel.session import (
    account_id_from_token,
    check_password_hash,
    generate_password_hash,
    mint_session_token,
)
from lobby_service import store
from lobby_service.schema import SCHEMA_VERSION

logger = logging.getLogger(__name__)

CALLER_HEADER = "X-Energetica-Caller"

router = APIRouter(prefix="/internal/v1")


def _account_out(account: store.Account) -> AccountOut:
    return AccountOut(
        account_id=account.account_id, username=account.username, email=account.email, created_at=account.created_at
    )


def _require_account(account_id: int) -> store.Account:
    account = store.get_account_by_id(account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, LobbyServiceErrorCode.ACCOUNT_NOT_FOUND)
    return account


def _check_password_length(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, LobbyServiceErrorCode.PASSWORD_TOO_SHORT)


# --- sessions ---------------------------------------------------------------------------------


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_session(credentials: Credentials) -> SessionToken:
    """Log in: check the password and mint a session token."""
    account = store.get_account_by_username(credentials.username)
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, LobbyServiceErrorCode.USER_NOT_FOUND)
    if not check_password_hash(plain_password=credentials.password, hashed_password=account.pwhash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, LobbyServiceErrorCode.INVALID_PASSWORD)
    return SessionToken(token=mint_session_token(account.account_id))


@router.get("/session")
def resolve_session(authorization: Annotated[str | None, Header()] = None, run: str | None = None) -> SessionOut:
    """The account a session token belongs to, and its standing in ``run`` if one is given.

    A missing, tampered or expired token, or one for an account that no longer exists, is a 401.
    """
    scheme, _, token = (authorization or "").partition(" ")
    account_id = account_id_from_token(token) if scheme == "Bearer" and token else None
    account = store.get_account_by_id(account_id) if account_id is not None else None
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, LobbyServiceErrorCode.INVALID_SESSION)
    is_facilitator = store.is_facilitator(account_id=account.account_id, slug=run)
    return SessionOut(
        **_account_out(account).model_dump(),
        role="facilitator" if is_facilitator else "player",
        joined=store.has_joined(account_id=account.account_id, slug=run) if run is not None else None,
    )


# --- accounts ---------------------------------------------------------------------------------


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
def create_account(credentials: Credentials) -> CreatedAccount:
    """Sign up: create an account and a session for it."""
    _check_password_length(credentials.password)
    try:
        account_id = store.create_account(
            username=credentials.username, pwhash=generate_password_hash(credentials.password)
        )
    except store.UsernameTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, LobbyServiceErrorCode.USERNAME_TAKEN)
    return CreatedAccount(account_id=account_id, token=mint_session_token(account_id))


@router.get("/accounts/by-username/{username}")
def get_account_by_username(username: str) -> AccountOut:
    account = store.get_account_by_username(username)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, LobbyServiceErrorCode.ACCOUNT_NOT_FOUND)
    return _account_out(account)


@router.get("/accounts/{account_id}")
def get_account(account_id: int) -> AccountOut:
    return _account_out(_require_account(account_id))


@router.get("/accounts")
def search_accounts(prefix: str = "", limit: int = 20) -> list[AccountOut]:
    """Accounts whose username starts with ``prefix`` (exact case), alphabetical."""
    return [_account_out(account) for account in store.search_accounts(prefix=prefix, limit=limit)]


@router.put("/accounts/{account_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(account_id: int, change: PasswordChange) -> Response:
    account = _require_account(account_id)
    if not check_password_hash(plain_password=change.old_password, hashed_password=account.pwhash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, LobbyServiceErrorCode.OLD_PASSWORD_INCORRECT)
    _check_password_length(change.new_password)
    store.update_password(account_id=account_id, pwhash=generate_password_hash(change.new_password))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/accounts/{account_id}/memberships")
def get_memberships(account_id: int) -> MembershipsOut:
    _require_account(account_id)
    return MembershipsOut(
        runs=[
            JoinedRun(slug=m.slug, joined_at=m.created_at)
            for m in store.get_memberships(account_id=account_id, role="player")
        ],
        facilitated_runs=[
            FacilitatedRun(slug=m.slug, granted_at=m.created_at)
            for m in store.get_memberships(account_id=account_id, role="facilitator")
        ],
    )


# --- run members and facilitator grants -------------------------------------------------------


@router.get("/runs/{slug}/members")
def get_run_members(slug: str) -> list[RunMember]:
    """Every account that has joined ``slug`` as a player, most recently joined first."""
    return [
        RunMember(account_id=m.account_id, username=m.username, joined_at=m.joined_at)
        for m in store.get_run_members(slug=slug)
    ]


@router.put("/runs/{slug}/members/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_run_member(slug: str, account_id: int) -> Response:
    """Join ``account_id`` to ``slug``. Idempotent. A 409 if a facilitator grant covers the run."""
    _require_account(account_id)
    try:
        store.add_member(account_id=account_id, slug=slug)
    except store.MembershipRoleConflictError:
        raise HTTPException(status.HTTP_409_CONFLICT, LobbyServiceErrorCode.ROLE_CONFLICT)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/runs/{slug}/members/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_run_member(slug: str, account_id: int) -> Response:
    """Remove ``account_id`` from ``slug``. Idempotent."""
    store.remove_member(account_id=account_id, slug=slug)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/facilitator-grants/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def grant_facilitator(account_id: int, grant: FacilitatorGrant) -> Response:
    """Grant facilitator authority over one run, or every run if no slug is given. Idempotent. A 409
    if the account is a player where the grant would apply.
    """
    _require_account(account_id)
    try:
        store.grant_facilitator(account_id=account_id, slug=grant.slug)
    except store.MembershipRoleConflictError:
        raise HTTPException(status.HTTP_409_CONFLICT, LobbyServiceErrorCode.ROLE_CONFLICT)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- health -----------------------------------------------------------------------------------


@router.get("/healthz")
def healthz() -> HealthOut:
    return HealthOut(status="ok", schema_version=SCHEMA_VERSION, api_versions=API_VERSIONS)


def create_service_app() -> FastAPI:
    """Build the lobby service app. Run :func:`lobby_service.schema.upgrade_database` first."""
    app = FastAPI(title="Energetica lobby service", openapi_url=None, docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def log_caller(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        logger.info(
            "%s %s %s -> %s",
            request.headers.get(CALLER_HEADER, "unnamed"),
            request.method,
            request.url.path,
            response.status_code,
        )
        return response

    app.include_router(router)
    return app
