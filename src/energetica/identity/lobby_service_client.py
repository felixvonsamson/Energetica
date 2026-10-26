"""
The client for the lobby service's internal API (``/internal/v1``, ADR-0009).

Shared by the lobby backend, runs and the operator scripts. It talks HTTP over the service's Unix
socket, names its caller in ``X-Energetica-Caller``, and gives up after about 5 seconds. A service
it cannot reach, or one that answers with something unexpected, raises
:class:`LobbyServiceUnavailable`, a 503 that FastAPI turns into a response by itself.

An answer the API documents, such as a wrong password or a taken username, raises
:class:`LobbyServiceRefusal` with the service's error code, for the caller to translate into its
own response. A lookup of something that does not exist returns ``None`` instead.
"""

from __future__ import annotations

import logging
import os
from urllib.parse import quote
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, TypeAdapter, ValidationError

from energetica.identity.schemas.lobby_service import (
    ACTING_ACCOUNT_HEADER,
    API_PREFIX,
    CALLER_HEADER,
    AccountOut,
    CreatedAccount,
    HealthOut,
    JoinTokenOut,
    LobbyServiceErrorCode,
    MembershipsOut,
    RunCreate,
    RunMember,
    RunOut,
    RunUpdate,
    SessionOut,
    SessionToken,
)
from energetica.kernel.game_error import SharedErrorCode
from energetica.kernel.version import backend_version

logger = logging.getLogger(__name__)

# The default suits local development. Production sets the path in each systemd unit.
_DEFAULT_SOCKET_PATH = "instance/lobby-service.sock"
_SOCKET_ENV_VAR = "ENERGETICA_LOBBY_SERVICE_SOCKET"
_DEFAULT_TIMEOUT_SECONDS = 5.0
# The host part of the URL means nothing over a Unix socket, but HTTP needs one.
BASE_URL = f"http://lobby-service{API_PREFIX}"


def default_socket_path() -> Path:
    """Where the lobby service listens, unless a caller says otherwise."""
    return Path(os.environ.get(_SOCKET_ENV_VAR, _DEFAULT_SOCKET_PATH))


class LobbyServiceUnavailable(HTTPException):
    """The lobby service could not be reached, timed out, or failed. Answered as a 503."""

    def __init__(self, reason: str) -> None:
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, SharedErrorCode.LOBBY_SERVICE_UNAVAILABLE)
        self.reason = reason


class LobbyServiceRefusal(Exception):
    """
    The lobby service refused the request with one of its documented error codes, and with a
    message for a person if it sent one, as for an invalid run.
    """

    def __init__(self, code: LobbyServiceErrorCode, message: str | None = None) -> None:
        super().__init__(code if message is None else f"{code}: {message}")
        self.code = code
        self.message = message


def install_refusal_handler(app: FastAPI) -> None:
    """
    Answer a :class:`LobbyServiceRefusal` that no route handled with a 503, like any other
    failure of the lobby service.

    A route catches the refusals it expects, such as a wrong password, and re-raises the rest. A
    refusal it did not expect means the service and the route disagree about the API, which is a
    fault on this server, not something the player did.
    """

    @app.exception_handler(LobbyServiceRefusal)
    def unexpected_refusal(request: Request, exc: LobbyServiceRefusal) -> JSONResponse:
        logger.error("unexpected lobby service refusal %s for %s %s", exc.code, request.method, request.url.path)
        return JSONResponse(
            {"detail": SharedErrorCode.LOBBY_SERVICE_UNAVAILABLE}, status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )


def _parse[T](response: httpx.Response, shape: type[T]) -> T:
    """Read a successful reply as ``shape``. A body that does not match is a 503, like any other failure."""
    try:
        return TypeAdapter(shape).validate_json(response.content)
    except ValidationError as exc:
        logger.error("lobby service sent a malformed reply to %s: %s", response.request.url.path, exc)
        raise LobbyServiceUnavailable(f"malformed reply: {exc}") from exc


def _error_body(response: httpx.Response) -> dict[str, object]:
    """
    The body of an error response, or an empty one if it is not the JSON object the service
    sends, such as an error page from uvicorn itself.
    """
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _acting_account_headers(account_id: int | None) -> dict[str, str]:
    return {ACTING_ACCOUNT_HEADER: str(account_id)} if account_id is not None else {}


class LobbyServiceClient:
    """One method per endpoint of the internal API."""

    def __init__(self, http: httpx.Client) -> None:
        """
        Wrap ``http``, whose base URL must point at ``/internal/v1``. Tests pass a FastAPI
        ``TestClient`` over the service app; everything else uses :meth:`connect`.
        """
        self._http = http

    @classmethod
    def connect(
        cls, caller: str, *, socket_path: Path | None = None, timeout: float = _DEFAULT_TIMEOUT_SECONDS
    ) -> LobbyServiceClient:
        """
        A client for the service on its Unix socket. ``caller`` names the calling program, such
        as ``lobby-backend``; the deployed commit is appended to it.
        """
        path = socket_path if socket_path is not None else default_socket_path()
        version = backend_version() or {}
        http = httpx.Client(
            transport=httpx.HTTPTransport(uds=str(path)),
            base_url=BASE_URL,
            timeout=timeout,
            headers={CALLER_HEADER: f"{caller}@{version.get('commit_short', 'unknown')}"},
        )
        return cls(http)

    def _request(self, method: str, path: str, *, expected: tuple[int, ...], **kwargs: Any) -> httpx.Response:
        """
        Send a request. A documented refusal raises :class:`LobbyServiceRefusal`; anything else
        that is not in ``expected`` raises :class:`LobbyServiceUnavailable`.
        """
        try:
            response = self._http.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            logger.error("lobby service unreachable: %s %s: %r", method, path, exc)
            raise LobbyServiceUnavailable(repr(exc)) from exc
        if response.status_code in expected:
            return response
        if 400 <= response.status_code < 500:
            body = _error_body(response)
            detail, message = body.get("detail"), body.get("message")
            if detail in LobbyServiceErrorCode.__members__.values():
                raise LobbyServiceRefusal(LobbyServiceErrorCode(detail), message if isinstance(message, str) else None)
        logger.error("lobby service answered %s %s with %s: %s", method, path, response.status_code, response.text)
        raise LobbyServiceUnavailable(f"unexpected status {response.status_code}")

    def _get_or_none[T: BaseModel](
        self, path: str, model: type[T], *, not_found: LobbyServiceErrorCode = LobbyServiceErrorCode.ACCOUNT_NOT_FOUND
    ) -> T | None:
        try:
            response = self._request("GET", path, expected=(200,))
        except LobbyServiceRefusal as refusal:
            if refusal.code == not_found:
                return None
            raise
        return _parse(response, model)

    # --- sessions --------------------------------------------------------------------------------

    def create_session(self, *, username: str, password: str) -> str:
        """Log in and return a session token. Refusals: ``USER_NOT_FOUND``, ``INVALID_PASSWORD``."""
        response = self._request(
            "POST", "/sessions", expected=(201,), json={"username": username, "password": password}
        )
        return _parse(response, SessionToken).token

    def resolve_session(self, token: str, *, run: str | None = None) -> SessionOut | None:
        """
        The account behind ``token`` and its standing in ``run``, or ``None`` if the token is
        missing, invalid, expired, or for an account that no longer exists.
        """
        try:
            response = self._request(
                "GET",
                "/session",
                expected=(200,),
                params={"run": run} if run is not None else None,
                headers={"Authorization": f"Bearer {token}"},
            )
        except LobbyServiceRefusal as refusal:
            if refusal.code == LobbyServiceErrorCode.INVALID_SESSION:
                return None
            raise
        return _parse(response, SessionOut)

    # --- accounts --------------------------------------------------------------------------------

    def create_account(self, *, username: str, password: str) -> CreatedAccount:
        """Sign up. Refusals: ``USERNAME_TAKEN``, ``PASSWORD_TOO_SHORT``."""
        response = self._request(
            "POST", "/accounts", expected=(201,), json={"username": username, "password": password}
        )
        return _parse(response, CreatedAccount)

    def get_account(self, account_id: int) -> AccountOut | None:
        return self._get_or_none(f"/accounts/{account_id}", AccountOut)

    def get_account_by_username(self, username: str) -> AccountOut | None:
        # Signup accepts any characters, so encode them all, "/" included: "alice?team" must not
        # be read as "alice" followed by a query string.
        return self._get_or_none(f"/accounts/by-username/{quote(username, safe='')}", AccountOut)

    def search_accounts(self, *, prefix: str, limit: int = 20) -> list[AccountOut]:
        response = self._request("GET", "/accounts", expected=(200,), params={"prefix": prefix, "limit": limit})
        return _parse(response, list[AccountOut])

    def change_password(self, account_id: int, *, old_password: str, new_password: str) -> None:
        """Refusals: ``OLD_PASSWORD_INCORRECT``, ``PASSWORD_TOO_SHORT``, ``ACCOUNT_NOT_FOUND``."""
        self._request(
            "PUT",
            f"/accounts/{account_id}/password",
            expected=(204,),
            json={"old_password": old_password, "new_password": new_password},
        )

    def get_memberships(self, account_id: int) -> MembershipsOut:
        """Refusal: ``ACCOUNT_NOT_FOUND``."""
        response = self._request("GET", f"/accounts/{account_id}/memberships", expected=(200,))
        return _parse(response, MembershipsOut)

    # --- run members and facilitator grants ------------------------------------------------------

    def get_run_members(self, slug: str) -> list[RunMember]:
        response = self._request("GET", f"/runs/{slug}/members", expected=(200,))
        return _parse(response, list[RunMember])

    def add_run_member(self, slug: str, account_id: int) -> None:
        """Join ``account_id`` to ``slug``. Idempotent. Refusals: ``ROLE_CONFLICT``, ``ACCOUNT_NOT_FOUND``."""
        self._request("PUT", f"/runs/{slug}/members/{account_id}", expected=(204,))

    def remove_run_member(self, slug: str, account_id: int) -> None:
        """Removing an account that is not a member does nothing. Refusal: ``ACCOUNT_NOT_FOUND``."""
        self._request("DELETE", f"/runs/{slug}/members/{account_id}", expected=(204,))

    def grant_facilitator(self, account_id: int, *, slug: str | None) -> None:
        """Server-wide if ``slug`` is ``None``. Idempotent. Refusals: ``ROLE_CONFLICT``, ``ACCOUNT_NOT_FOUND``."""
        self._request("PUT", f"/facilitator-grants/{account_id}", expected=(204,), json={"slug": slug})

    # --- runs ------------------------------------------------------------------------------------

    def list_runs(self) -> list[RunOut]:
        response = self._request("GET", "/runs", expected=(200,))
        return _parse(response, list[RunOut])

    def get_run(self, slug: str) -> RunOut | None:
        return self._get_or_none(f"/runs/{slug}", RunOut, not_found=LobbyServiceErrorCode.RUN_NOT_FOUND)

    def create_run(self, slug: str, run: RunCreate) -> RunOut:
        """Refusals: ``RUN_EXISTS``, ``INVALID_RUN``."""
        response = self._request("PUT", f"/runs/{slug}", expected=(201,), json=run.model_dump(mode="json"))
        return _parse(response, RunOut)

    def update_run(self, slug: str, changes: RunUpdate, *, acting_account_id: int | None = None) -> RunOut:
        """
        Change the fields ``changes`` sets, and only those. ``acting_account_id`` names the account
        the change is made for, for the service's log. Refusals: ``RUN_NOT_FOUND``, ``INVALID_RUN``.
        """
        response = self._request(
            "PATCH",
            f"/runs/{slug}",
            expected=(200,),
            json=changes.model_dump(mode="json", exclude_unset=True),
            headers=_acting_account_headers(acting_account_id),
        )
        return _parse(response, RunOut)

    def get_or_create_join_token(self, slug: str, *, acting_account_id: int | None = None) -> str:
        """A private run's join token, created on first use. Refusals: ``RUN_NOT_FOUND``, ``INVALID_RUN``."""
        response = self._request(
            "POST", f"/runs/{slug}/join-token", expected=(200,), headers=_acting_account_headers(acting_account_id)
        )
        return _parse(response, JoinTokenOut).join_token

    def delete_run(self, slug: str, *, with_members: bool = False) -> None:
        """Refusals: ``RUN_NOT_FOUND``, and ``RUN_HAS_MEMBERS`` unless ``with_members``."""
        self._request("DELETE", f"/runs/{slug}", expected=(204,), params={"with_members": with_members})

    # --- health ----------------------------------------------------------------------------------

    def healthz(self) -> HealthOut:
        response = self._request("GET", "/healthz", expected=(200,))
        return _parse(response, HealthOut)
