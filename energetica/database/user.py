"""User model."""

from __future__ import annotations

import os
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
            # The backend must never start on an un-migrated pickle (auth would be broken),
            # so this normally hard-fails. The ONE legitimate reader of a pre-migration pickle
            # is scripts/migrate-to-server-accounts.py, which sets this env flag so it can load,
            # backfill account_id, and re-save. After migration every User carries account_id,
            # so the flag is irrelevant on all subsequent (normal) loads.
            if os.environ.get("ENERGETICA_ALLOW_UNMIGRATED_USERS") == "1":
                state["account_id"] = 0  # sentinel; the migration overwrites it with the real id
            else:
                raise RuntimeError(
                    "Pickle User is missing account_id — run scripts/migrate-to-server-accounts.py "
                    "before starting the new code. See docs/architecture/static-serving-and-deployment.md "
                    "§ migrate-to-server-accounts.py flow."
                )
        self.__dict__.update(state)
