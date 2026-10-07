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
from typing import TYPE_CHECKING

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.fleet import OwnedFacility
from energetica.workshop.prices import DEFAULT_PRICES, LockedPrices, PriceSheet
from energetica.workshop.trading import TradingResult

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

    Created by :meth:`energetica.workshop.network.WorkshopNetwork.join`, or rebuilt by its
    :meth:`~energetica.workshop.network.WorkshopNetwork.restore` after a restart, never directly, so
    that every player is in the Run's shared Network from the moment it exists.
    """

    account_id: int
    username: str
    network: WorkshopNetwork

    money: float = WORKSHOP_STARTING_BUDGET

    owned_facilities: list[OwnedFacility] = field(default_factory=list)

    # The facilities picked in the open Investment phase, bought together when it closes (#999). One
    # entry per copy, in the order they were picked.
    selection: list[FacilityId] = field(default_factory=list)

    # The energy each storage type holds, in Wh, shared by every facility of that type (#1001). A type
    # holding nothing is left out.
    stored_energy: dict[FacilityId, float] = field(default_factory=dict)

    # The prices the player offers at (#1002). They change only while a price-setting window is open,
    # and carry over from one Trading period to the next.
    prices: PriceSheet = DEFAULT_PRICES

    # The prices each completed Trading period ran at, oldest first (#1002).
    locked_prices: list[LockedPrices] = field(default_factory=list)

    # How each completed Trading period went, oldest first (#1003). A period in which the player had
    # nothing operating has no result.
    trading_results: list[TradingResult] = field(default_factory=list)

    def selection_cost(self) -> float:
        """What the selection costs to buy, in full."""
        return sum(CATALOG[facility].base_price for facility in self.selection)

    def __repr__(self) -> str:
        """A short repr. The default one would recurse through ``network``, which holds this player."""
        return f"<WorkshopPlayer {self.account_id} '{self.username}'>"
