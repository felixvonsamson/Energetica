"""
Class for errors in the game.

These include game-level for API response like "not enough money".
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, ClassVar


class GameError(Exception):
    """Define the exception class for the game engine."""

    #: The HTTP status the error envelope answers with. A subclass can change it, such as to 404 for
    #: something that does not exist.
    status_code: ClassVar[int] = 400

    def __init__(self, exception_type: ErrorCode, **kwargs: Any):
        self.exception_type = exception_type
        self.kwargs = kwargs
        Exception.__init__(self, exception_type)


class ErrorCode(StrEnum):
    """The base of every error code enum. It has no codes of its own.

    The kernel holds only the codes every app can return, in :class:`SharedErrorCode`. The
    identity layer and each app subclass this with their own codes, so an app's codes do not leak
    into another app's schema. A code's value is what players receive, so values are unique across
    all of them.
    """


class SharedErrorCode(ErrorCode):
    """The error codes every app can return: the lobby and both Instance apps."""

    USER_NOT_FOUND = "USER_NOT_FOUND"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    INSTANCE_ACCESS_DENIED = "INSTANCE_ACCESS_DENIED"
