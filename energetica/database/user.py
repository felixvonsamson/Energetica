"""User model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player

# Type alias for user roles (can be imported by other modules)
UserRole = Literal["player", "admin"]


@dataclass
class User(DBModel):
    username: str
    pwhash: str
    role: UserRole

    # Only valid when role == "player"
    player: Player | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
