"""The error codes of the identity layer's Instance routes: join links, the facilitator pages and
the player and facilitator checks. Both Instance apps mount these routes, and the lobby does not.
"""

from __future__ import annotations

from energetica.kernel.game_error import ErrorCode


class IdentityErrorCode(ErrorCode):
    USER_IS_NOT_A_PLAYER = "USER_IS_NOT_A_PLAYER"
    ACCOUNT_IS_NOT_A_FACILITATOR = "ACCOUNT_IS_NOT_A_FACILITATOR"
    INSTANCE_NOT_PRIVATE = "INSTANCE_NOT_PRIVATE"
    JOIN_LINK_INVALID = "JOIN_LINK_INVALID"
    JOIN_LINK_CLOSED = "JOIN_LINK_CLOSED"
