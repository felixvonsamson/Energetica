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
    account_id: int

    # Only valid when role == "player"
    player: Player | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    def __setstate__(self, state: dict) -> None:
        if "account_id" not in state:
            raise RuntimeError(
                "Pickle User is missing account_id — run scripts/migrate-to-server-accounts.py "
                "before starting the new code. See docs/architecture/static-serving-and-deployment.md "
                "§ migrate-to-server-accounts.py flow."
            )
        self.__dict__.update(state)
