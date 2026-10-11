"""The lobby's own error codes: signing up, logging in and joining a Run."""

from __future__ import annotations

from energetica.kernel.game_error import ErrorCode


class LobbyErrorCode(ErrorCode):
    USERNAME_TAKEN = "USERNAME_TAKEN"
    INVALID_PASSWORD = "INVALID_PASSWORD"
    SIGNUP_DISABLED = "SIGNUP_DISABLED"
    OLD_PASSWORD_INCORRECT = "OLD_PASSWORD_INCORRECT"
    RUN_NOT_FOUND = "RUN_NOT_FOUND"
