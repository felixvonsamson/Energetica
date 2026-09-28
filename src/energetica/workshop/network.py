"""The one shared market Network a Workshop Run places all its players into (#992 §11).

Its own class, not the persistent world's ``Network``: nothing about that class (its per-network
chart directory, the free-play create, join and leave flow, the per-network member cap) is reused
for Workshop, and a Workshop Run has exactly one Network for its whole life.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from energetica.workshop.player import WorkshopPlayer


@dataclass(eq=False)
class WorkshopNetwork:
    """A Workshop Run's single, shared market."""

    # Keyed by account id, so one account can never hold two places in the Run.
    members: dict[int, WorkshopPlayer] = field(default_factory=dict, repr=False)

    def players(self) -> list[WorkshopPlayer]:
        """The Run's players, in the order they joined."""
        return list(self.members.values())
