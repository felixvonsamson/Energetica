"""
Class for errors in the game.

These include game-level for API response like "not enough money".
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class GameError(Exception):
    """Define the exception class for the game engine."""

    def __init__(self, exception_type: ErrorCode, **kwargs: Any):
        self.exception_type = exception_type
        self.kwargs = kwargs
        Exception.__init__(self, exception_type)


class ErrorCode(StrEnum):
    """The base of every error code enum. It has no codes of its own.

    The kernel holds only the codes every app can return, in :class:`GameExceptionType`. The
    identity layer and each app subclass this with their own codes, so an app's codes do not leak
    into another app's schema. A code's value is what players receive, so values are unique across
    all of them.
    """


class GameExceptionType(ErrorCode):
    """The error codes every app can return: the lobby and both Instance apps."""

    USER_NOT_FOUND = "USER_NOT_FOUND"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    INSTANCE_ACCESS_DENIED = "INSTANCE_ACCESS_DENIED"
