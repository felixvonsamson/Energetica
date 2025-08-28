"""User model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class User(DBModel):
    username: str
    pwhash: str
    role: Literal["player", "admin"]

    # Only valid when role == "player"
    player: Player | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
