"""Workshop's own player-identity object (#992 §11, #993).

Modeled on the persistent world's ``Player`` (``energetica.database.player.Player``) where the
shape genuinely transfers to a moderated, mapless session — account linkage, cash/budget, an
owned-facility roster, and Network membership — and nothing else. Following #992's explicit-reuse
principle ("anything not named as reused is built fresh"), ``WorkshopPlayer`` does not subclass or
get constructed alongside ``Player``: ``Player.tile: HexTile`` is a required field with no
default, and Workshop has no map/tile system to supply one from (see :mod:`energetica.workshop.setup`
for the system-managed setup that constructs this class instead of ``Player``).

Left out on purpose, because each is persistent-world-only with no Workshop equivalent:
``projects_by_priority`` (no per-player tech tree — Workshop's tech-grade unlock is a session-wide
learning curve over cumulative investment, not a per-player research queue), the ``achievements``
milestone system, and tile/map/general-chat coupling.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from energetica.config.constants import WORKSHOP_STARTING_BUDGET
from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.workshop.network import WorkshopNetwork


@dataclass
class WorkshopPlayer(DBModel):
    """A single account's identity within one Workshop Run.

    Constructed by :func:`energetica.workshop.setup.join_workshop_run`, never directly — that
    function is what places a fresh instance into the Run's shared Network in the same step.
    """

    account_id: int
    username: str

    # Game-balance placeholder: the real Round-1 starting figure is deferred to tuning (#992 §8/§9).
    money: float = WORKSHOP_STARTING_BUDGET

    # Populated once Workshop's own hand-authored facility catalog exists (#992 §5) — that ticket
    # is separate from this one; this class only carries the roster field itself.
    owned_facilities: list[Any] = field(default_factory=list)

    network: WorkshopNetwork | None = None

    def __hash__(self) -> int:
        """Return the hash of the player's id (mirrors ``Player.__hash__``)."""
        return hash(self.id)

    def __repr__(self) -> str:
        """A short, non-recursive repr (mirrors ``Player.__repr__``) — ``network`` holds this
        player back in its ``members``, so the dataclass-default repr would recurse forever.
        """
        return f"<WorkshopPlayer {self.id} '{self.username}'>"

    @property
    def is_in_network(self) -> bool:
        """Mirror ``Player.is_in_network``. Always ``True`` once :func:`join_workshop_run` has
        run: unlike the persistent world, Workshop has no leave-network flow to ever unset this.
        """
        return self.network is not None
