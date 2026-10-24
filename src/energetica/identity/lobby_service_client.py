"""The client for the lobby service's internal API (``/internal/v1``, ADR-0009).

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
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException, status
from pydantic import BaseModel, TypeAdapter

from energetica.identity.schemas.lobby_service import (
    AccountOut,
    CreatedAccount,
    HealthOut,
    LobbyServiceErrorCode,
    MembershipsOut,
    RunMember,
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
_BASE_URL = "http://lobby-service/internal/v1"
CALLER_HEADER = "X-Energetica-Caller"


def default_socket_path() -> Path:
    """Where the lobby service listens, unless a caller says otherwise."""
    return Path(os.environ.get(_SOCKET_ENV_VAR, _DEFAULT_SOCKET_PATH))


class LobbyServiceUnavailable(HTTPException):
    """The lobby service could not be reached, timed out, or failed. Answered as a 503."""

    def __init__(self, reason: str) -> None:
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, SharedErrorCode.LOBBY_SERVICE_UNAVAILABLE)
        self.reason = reason


class LobbyServiceRefusal(Exception):
    """The lobby service refused the request with one of its documented error codes."""

    def __init__(self, code: LobbyServiceErrorCode) -> None:
        super().__init__(code)
        self.code = code


class LobbyServiceClient:
    """One method per endpoint of the internal API."""

    def __init__(self, http: httpx.Client) -> None:
        """Wrap ``http``, whose base URL must point at ``/internal/v1``. Tests pass a FastAPI
        ``TestClient`` over the service app; everything else uses :meth:`connect`.
        """
        self._http = http

    @classmethod
    def connect(
        cls, caller: str, *, socket_path: Path | None = None, timeout: float = _DEFAULT_TIMEOUT_SECONDS
    ) -> LobbyServiceClient:
        """A client for the service on its Unix socket. ``caller`` names the calling program, such
        as ``lobby-backend``; the deployed commit is appended to it.
        """
        path = socket_path if socket_path is not None else default_socket_path()
        version = backend_version() or {}
        http = httpx.Client(
            transport=httpx.HTTPTransport(uds=str(path)),
            base_url=_BASE_URL,
            timeout=timeout,
            headers={CALLER_HEADER: f"{caller}@{version.get('commit_short', 'unknown')}"},
        )
        return cls(http)

    def _request(self, method: str, path: str, *, expected: tuple[int, ...], **kwargs: Any) -> httpx.Response:
        """Send a request. A documented refusal raises :class:`LobbyServiceRefusal`; anything else
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
            detail = response.json().get("detail")
            if detail in LobbyServiceErrorCode.__members__.values():
                raise LobbyServiceRefusal(LobbyServiceErrorCode(detail))
        logger.error("lobby service answered %s %s with %s: %s", method, path, response.status_code, response.text)
        raise LobbyServiceUnavailable(f"unexpected status {response.status_code}")

    def _get_or_none[T: BaseModel](self, path: str, model: type[T]) -> T | None:
        try:
            response = self._request("GET", path, expected=(200,))
        except LobbyServiceRefusal as refusal:
            if refusal.code == LobbyServiceErrorCode.ACCOUNT_NOT_FOUND:
                return None
            raise
        return model.model_validate(response.json())

    # --- sessions --------------------------------------------------------------------------------

    def create_session(self, *, username: str, password: str) -> str:
        """Log in and return a session token. Refusals: ``USER_NOT_FOUND``, ``INVALID_PASSWORD``."""
        response = self._request(
            "POST", "/sessions", expected=(201,), json={"username": username, "password": password}
        )
        return SessionToken.model_validate(response.json()).token

    def resolve_session(self, token: str, *, run: str | None = None) -> SessionOut | None:
        """The account behind ``token`` and its standing in ``run``, or ``None`` if the token is
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
        return SessionOut.model_validate(response.json())

    # --- accounts --------------------------------------------------------------------------------

    def create_account(self, *, username: str, password: str) -> CreatedAccount:
        """Sign up. Refusals: ``USERNAME_TAKEN``, ``PASSWORD_TOO_SHORT``."""
        response = self._request(
            "POST", "/accounts", expected=(201,), json={"username": username, "password": password}
        )
        return CreatedAccount.model_validate(response.json())

    def get_account(self, account_id: int) -> AccountOut | None:
        return self._get_or_none(f"/accounts/{account_id}", AccountOut)

    def get_account_by_username(self, username: str) -> AccountOut | None:
        return self._get_or_none(f"/accounts/by-username/{username}", AccountOut)

    def search_accounts(self, *, prefix: str, limit: int = 20) -> list[AccountOut]:
        response = self._request("GET", "/accounts", expected=(200,), params={"prefix": prefix, "limit": limit})
        return TypeAdapter(list[AccountOut]).validate_python(response.json())

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
        return MembershipsOut.model_validate(response.json())

    # --- run members and facilitator grants ------------------------------------------------------

    def get_run_members(self, slug: str) -> list[RunMember]:
        response = self._request("GET", f"/runs/{slug}/members", expected=(200,))
        return TypeAdapter(list[RunMember]).validate_python(response.json())

    def add_run_member(self, slug: str, account_id: int) -> None:
        """Join ``account_id`` to ``slug``. Idempotent. Refusals: ``ROLE_CONFLICT``, ``ACCOUNT_NOT_FOUND``."""
        self._request("PUT", f"/runs/{slug}/members/{account_id}", expected=(204,))

    def remove_run_member(self, slug: str, account_id: int) -> None:
        """Idempotent."""
        self._request("DELETE", f"/runs/{slug}/members/{account_id}", expected=(204,))

    def grant_facilitator(self, account_id: int, *, slug: str | None) -> None:
        """Server-wide if ``slug`` is ``None``. Idempotent. Refusals: ``ROLE_CONFLICT``, ``ACCOUNT_NOT_FOUND``."""
        self._request("PUT", f"/facilitator-grants/{account_id}", expected=(204,), json={"slug": slug})

    # --- health ----------------------------------------------------------------------------------

    def healthz(self) -> HealthOut:
        response = self._request("GET", "/healthz", expected=(200,))
        return HealthOut.model_validate(response.json())
