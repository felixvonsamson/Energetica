"""Workshop's own player-identity object (#992 §11, #993).

Modeled on the persistent world's ``Player`` where the shape genuinely transfers to a moderated,
mapless session: account linkage, cash, an owned-facility roster, and Network membership. It does
not subclass or sit alongside ``Player``, whose required ``tile`` a Workshop Run has no map to
supply. See :mod:`energetica.workshop.setup` for how one is created.

Left out on purpose, because each is persistent-world-only with no Workshop equivalent:
``projects_by_priority`` (Workshop's tech-grade unlock is a session-wide learning curve over
cumulative investment, not a per-player research queue), the ``achievements`` milestone system, and
tile, map and general-chat coupling.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from energetica.workshop.network import WorkshopNetwork

# A Workshop player's Round-1 starting budget (#992 §8/§9). A placeholder: the real figure is
# game-balance tuning, deferred along with every other Workshop magnitude in #992.
WORKSHOP_STARTING_BUDGET = 25_000.0


# `eq=False` keeps equality and hashing by identity. Field-wise equality would recurse, since the
# network holds each player and each player holds the network.
@dataclass(eq=False)
class WorkshopPlayer:
    """A single account's identity within one Workshop Run.

    Created by :meth:`energetica.workshop.network.WorkshopNetwork.join`, never directly, so that every
    player is in the Run's shared Network from the moment it exists.
    """

    account_id: int
    username: str
    network: WorkshopNetwork

    money: float = WORKSHOP_STARTING_BUDGET

    # Filled once Workshop's own facility catalog exists (#998). This ticket only adds the field.
    owned_facilities: list[Any] = field(default_factory=list)

    def __repr__(self) -> str:
        """A short repr. The default one would recurse through ``network``, which holds this player."""
        return f"<WorkshopPlayer {self.account_id} '{self.username}'>"
