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

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import OwnedFacility, Purchase
from energetica.workshop.loan import Loan
from energetica.workshop.prices import DEFAULT_PRICES, LockedPrices, PriceSheet
from energetica.workshop.trading import Bidder, TradingResult

if TYPE_CHECKING:
    from energetica.workshop.network import WorkshopNetwork

# A Workshop player's Round-1 starting budget (#992 §8/§9). Set by the first recalibration (#1227), so that
# a Round's income is a few times the budget.
WORKSHOP_STARTING_BUDGET = 50_000_000.0

# The least a player starts a Round with (#1016): 70% of the Round-1 starting budget. Raised from half in #1286, when
# the blackout reset was removed and the top-up became the only help for a player who overspent.
WORKSHOP_CASH_FLOOR = WORKSHOP_STARTING_BUDGET * 0.7


def round_start_money(money: float) -> float:
    """The cash a player holding ``money`` starts the next Round with (#1016): what they hold, but a player below the
    floor is topped up to exactly it.
    """
    return max(money, WORKSHOP_CASH_FLOOR)


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

    # Every facility the player bought, oldest first, including those since retired (#1008).
    purchases: list[Purchase] = field(default_factory=list)

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

    # The fuel the player holds, in kg (#1009). A fuel they hold none of is left out.
    fuel_stock: dict[Fuel, float] = field(default_factory=dict)

    # The fuel the player buys when the price-setting window closes, in kg, under manual procurement (#1009). Each
    # window starts from what they bought in the last one, so it also says what that was.
    fuel_order: dict[Fuel, float] = field(default_factory=dict)

    # How each completed Trading period went, oldest first (#1003). A period in which the player had
    # nothing operating has no result.
    trading_results: list[TradingResult] = field(default_factory=list)

    # The loan the player took, or None if they have not taken one (#1225).
    loan: Loan | None = None

    def selection_cost(self, prices: Mapping[FacilityId, float]) -> float:
        """What the selection costs to buy, in full, at this Round's ``prices``."""
        return sum(prices[facility] for facility in self.selection)

    def at_limit(self, facility: FacilityId) -> bool:
        """Whether the player can select no more of ``facility``, because the ones they own (built or under
        construction) and the ones in their selection already reach its ``max_owned`` (#1223). Retired ones
        are no longer owned, so they do not count.
        """
        max_owned = CATALOG[facility].max_owned
        if max_owned is None:
            return False
        owned = sum(1 for owned in self.owned_facilities if owned.facility == facility)
        return owned + self.selection.count(facility) >= max_owned

    def bidder(self) -> Bidder:
        """What the Trading-period engine needs to know about this player (#1003)."""
        return Bidder(self.account_id, self.owned_facilities, self.prices, self.stored_energy)

    def __repr__(self) -> str:
        """A short repr. The default one would recurse through ``network``, which holds this player."""
        return f"<WorkshopPlayer {self.account_id} '{self.username}'>"
