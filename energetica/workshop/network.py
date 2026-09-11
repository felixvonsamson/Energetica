"""The one shared market Network every Workshop Run's players are placed into (#992 §11).

Deliberately its own class, not the persistent world's ``energetica.database.network.Network``:
nothing about that class (its per-network chart-dump directory, its interplay with the free-play
``join_network``/``create_network``/``NETWORK_MEMBER_LIMIT`` flow) is named as reused for Workshop
by #992's explicit-reuse principle, and a Workshop Run has exactly one Network for its whole
life — never several to name, create, or switch between the way a persistent-world player can.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.workshop.player import WorkshopPlayer


@dataclass
class WorkshopNetwork(DBModel):
    """A Workshop Run's single, shared market."""

    members: list[WorkshopPlayer] = field(default_factory=list)


def get_or_create_shared_network() -> WorkshopNetwork:
    """Return this Run's one shared market Network, creating it the first time it's needed.

    Idempotent: a Workshop Run has exactly one Network for its whole life, so every joining
    player after the first lands in the same object — there is no player-initiated
    create-or-choose-a-network step the way the persistent world has.

    This check-then-create is not itself locked, matching every other check-then-act game
    mutation in this codebase (e.g. ``network_helpers.create_network``'s own
    check-then-act name-uniqueness test): every request is already serialized through the single
    global ``engine.lock`` held for the duration of the request (see the middleware in
    ``energetica/routers/__init__.py``), so two calls here can never actually interleave.
    """
    existing = WorkshopNetwork.all()
    if existing:
        return existing[0]
    return WorkshopNetwork()
