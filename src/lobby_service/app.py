"""
The lobby service's internal API, ``/internal/v1`` (ADR-0009).

Reached only over a Unix socket, so access to the socket file is the only check. Callers name
themselves in ``X-Energetica-Caller``, which is logged with every request so the deployed-versions
table can tell which callers still use which API version. It is never used for trust.

Sessions are minted and checked here only. A token is the signed ``account_id`` the session
cookie carries (:mod:`lobby_service.session`).

Every write to a run logs one structured line on the ``lobby_service.runs`` logger: who made it and
each field it changed, old and new. The join token's value is never logged.
"""

from __future__ import annotations

import json
import logging
import re
import secrets
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from energetica.identity.instance_config import derive_phase
from energetica.identity.schemas.lobby_service import (
    ACTING_ACCOUNT_HEADER,
    API_PREFIX,
    API_VERSIONS,
    CALLER_HEADER,
    MIN_PASSWORD_LENGTH,
    AccountOut,
    CreatedAccount,
    Credentials,
    GrantedRun,
    FacilitatorGrantRequest,
    HealthOut,
    JoinedRun,
    JoinTokenOut,
    LobbyServiceErrorCode,
    MembershipsOut,
    PasswordChange,
    RunCreate,
    RunMember,
    RunOut,
    RunUpdate,
    SessionOut,
    SessionToken,
)
from lobby_service.session import (
    account_id_from_token,
    check_password_hash,
    generate_password_hash,
    mint_session_token,
)
from lobby_service import store
from lobby_service.schema import SCHEMA_VERSION

logger = logging.getLogger(__name__)
run_journal = logging.getLogger("lobby_service.runs")

router = APIRouter(prefix=API_PREFIX)


class Refusal(Exception):
    """
    An error answered as ``{"detail": code, "message": message}``: the code for the client to
    act on, as with any refusal, and a message saying what to fix, for a person to read.
    """

    def __init__(self, status_code: int, code: LobbyServiceErrorCode, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


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
    """
    The account a session token belongs to, and its standing in ``run`` if one is given.

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


@router.get("/accounts/by-username/{username:path}")
def get_account_by_username(username: str) -> AccountOut:
    """
    Look up an account by its exact username.

    ``:path`` lets the username contain ``/``, which signup allows. The client percent-encodes the
    username, and the server decodes it before matching the route.
    """
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
            GrantedRun(slug=m.slug, granted_at=m.created_at)
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
    """Remove ``account_id`` from ``slug``. Removing an account that is not a member does nothing."""
    _require_account(account_id)
    store.remove_member(account_id=account_id, slug=slug)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/facilitator-grants/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def grant_facilitator(account_id: int, grant: FacilitatorGrantRequest) -> Response:
    """
    Grant facilitator authority over one run, or every run if no slug is given. Idempotent. A 409
    if the account is a player where the grant would apply.
    """
    _require_account(account_id)
    try:
        store.grant_facilitator(account_id=account_id, slug=grant.slug)
    except store.MembershipRoleConflictError:
        raise HTTPException(status.HTTP_409_CONFLICT, LobbyServiceErrorCode.ROLE_CONFLICT)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- runs -------------------------------------------------------------------------------------


# The run endpoints whose bad bodies or parameters are answered as INVALID_RUN.
_RUN_WRITE_PATH = re.compile(rf"{re.escape(API_PREFIX)}/runs/[^/]+(/join-token)?")


def _run_out(run: store.Run) -> RunOut:
    return RunOut(
        slug=run.slug,
        name=run.name,
        mode=run.mode,  # type: ignore[arg-type]  # the table's CHECK holds it to RunModeTag
        advertised=run.advertised,
        access_policy=run.access_policy,  # type: ignore[arg-type]  # likewise
        join_token=run.join_token,
        join_open=run.join_open,
        starts_at=run.starts_at,
        freeze_at=run.freeze_at,
        ended_at=run.ended_at,
        created_at=run.created_at,
        phase=derive_phase(
            datetime.now(timezone.utc), starts_at=run.starts_at, freeze_at=run.freeze_at, ended_at=run.ended_at
        ),
    )


def _run_not_found(slug: str) -> Refusal:
    return Refusal(status.HTTP_404_NOT_FOUND, LobbyServiceErrorCode.RUN_NOT_FOUND, f"no run is called {slug!r}")


def _invalid_run(exc: store.InvalidRunError) -> Refusal:
    return Refusal(status.HTTP_422_UNPROCESSABLE_ENTITY, LobbyServiceErrorCode.INVALID_RUN, str(exc))


def _journal_value(field: str, value: Any) -> Any:
    if field == "join_token" and value is not None:
        return "(redacted)"
    if isinstance(value, datetime):
        return store.format_timestamp(value)
    return value


def _journal_run_write(
    request: Request, action: str, slug: str, before: store.Run | None, after: store.Run | None
) -> None:
    """
    Log one line for a write to ``slug``, naming its caller, the acting account and each field
    that changed. An update that changed nothing is not logged.
    """
    changes = {
        field: [_journal_value(field, old), _journal_value(field, new)]
        for field, (old, new) in store.changed_run_fields(before, after).items()
    }
    if action == "update" and not changes:
        return
    run_journal.info(
        "run %s %s",
        action,
        json.dumps(
            {
                "slug": slug,
                "caller": request.headers.get(CALLER_HEADER, "unnamed"),
                "acting_account": request.headers.get(ACTING_ACCOUNT_HEADER),
                "changes": changes,
            }
        ),
    )


@router.get("/runs")
def list_runs() -> list[RunOut]:
    """Every run, the latest to start first."""
    return [_run_out(run) for run in store.list_runs()]


@router.get("/runs/{slug}")
def get_run(slug: str) -> RunOut:
    run = store.get_run(slug)
    if run is None:
        raise _run_not_found(slug)
    return _run_out(run)


@router.put("/runs/{slug}", status_code=status.HTTP_201_CREATED)
def create_run(slug: str, body: RunCreate, request: Request) -> RunOut:
    """Create a run. A 409 if the slug is taken: a run is changed with ``PATCH``, never replaced."""
    try:
        run = store.create_run(slug=slug, **body.model_dump())
    except store.RunExistsError:
        raise Refusal(status.HTTP_409_CONFLICT, LobbyServiceErrorCode.RUN_EXISTS, f"a run is already called {slug!r}")
    except store.InvalidRunError as exc:
        raise _invalid_run(exc)
    _journal_run_write(request, "create", slug, None, run)
    return _run_out(run)


@router.patch("/runs/{slug}")
def update_run(slug: str, body: RunUpdate, request: Request) -> RunOut:
    """Change the fields the body names, and only those. A field sent as ``null`` is cleared."""
    try:
        before, after = store.update_run(slug, body.model_dump(exclude_unset=True))
    except store.RunNotFoundError:
        raise _run_not_found(slug)
    except store.InvalidRunError as exc:
        raise _invalid_run(exc)
    _journal_run_write(request, "update", slug, before, after)
    return _run_out(after)


@router.post("/runs/{slug}/join-token")
def get_or_create_join_token(slug: str, request: Request) -> JoinTokenOut:
    """
    A private run's join token, created on the first call and never rotated after. Refused for a
    public run.
    """
    try:
        before, after = store.get_or_create_join_token(slug, secrets.token_urlsafe(24))
    except store.RunNotFoundError:
        raise _run_not_found(slug)
    except store.InvalidRunError as exc:
        raise _invalid_run(exc)
    _journal_run_write(request, "update", slug, before, after)
    assert after.join_token is not None
    return JoinTokenOut(join_token=after.join_token)


@router.delete("/runs/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(slug: str, request: Request, with_members: bool = False) -> Response:
    """
    Delete a run. A 409 if anyone has joined it or holds a grant for it, unless ``with_members``,
    which deletes those rows in the same transaction.
    """
    try:
        run = store.delete_run(slug, with_members=with_members)
    except store.RunNotFoundError:
        raise _run_not_found(slug)
    except store.RunHasMembersError as exc:
        raise Refusal(
            status.HTTP_409_CONFLICT,
            LobbyServiceErrorCode.RUN_HAS_MEMBERS,
            f"{exc}; delete them with the run by asking for that explicitly",
        )
    _journal_run_write(request, "delete", slug, run, None)
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

    @app.exception_handler(Refusal)
    def refuse(request: Request, exc: Refusal) -> JSONResponse:
        return JSONResponse({"detail": exc.code, "message": exc.message}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def refuse_invalid_run(request: Request, exc: RequestValidationError) -> Response:
        """
        Answer a run write whose body does not parse, such as a time with no time zone or a
        ``PATCH`` naming ``mode``, as ``INVALID_RUN`` with a message, like any other invalid run.
        Other endpoints keep FastAPI's own answer.
        """
        if _RUN_WRITE_PATH.fullmatch(request.url.path) is None:
            return await request_validation_exception_handler(request, exc)
        problems = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'][1:]) or 'body'}: {error['msg']}" for error in exc.errors()
        )
        return refuse(
            request, Refusal(status.HTTP_422_UNPROCESSABLE_ENTITY, LobbyServiceErrorCode.INVALID_RUN, problems)
        )

    app.include_router(router)
    return app
