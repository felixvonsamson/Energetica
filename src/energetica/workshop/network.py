"""The one shared market Network a Workshop Run places all its players into (#992 §11).

Its own class, not the persistent world's ``Network``: nothing about that class (its per-network
chart directory, the free-play create, join and leave flow, the per-network member cap) is reused
for Workshop, and a Workshop Run has exactly one Network for its whole life.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from energetica.workshop.player import WorkshopPlayer

if TYPE_CHECKING:
    from energetica.identity.accounts import Account
    from energetica.workshop.facilities import FacilityId
    from energetica.workshop.fleet import OwnedFacility, Purchase
    from energetica.workshop.prices import LockedPrices, PriceSheet
    from energetica.workshop.trading import TradingResult


@dataclass(eq=False)
class WorkshopNetwork:
    """A Workshop Run's single, shared market."""

    # Keyed by account id, so one account can never hold two places in the Run.
    members: dict[int, WorkshopPlayer] = field(default_factory=dict, repr=False)

    # Makes the lookup and insert in :meth:`join` one step, so two requests joining the same
    # account at once still produce one player. The persistent world gets this from ``engine.lock``,
    # which its middleware holds for every request, but that lock belongs to ``freeplay``. This is
    # the same approach ``identity.instance_config`` takes for its read-modify-write.
    _join_lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)

    def players(self) -> list[WorkshopPlayer]:
        """The Run's players, in the order they joined."""
        return list(self.members.values())

    def join(self, account: Account) -> WorkshopPlayer:
        """Place ``account`` into this Network, or return its existing player.

        Unlike the persistent world's ``join_network``, this is automatic and unconditional. It is
        also not subject to the persistent world's per-network member cap, which only gates that one
        join call and not Run membership in general (#990).

        Idempotent per account: a retried call returns the account's existing
        :class:`~energetica.workshop.player.WorkshopPlayer` rather than giving it a second one.
        """
        with self._join_lock:
            existing = self.members.get(account.account_id)
            if existing is not None:
                return existing
            player = WorkshopPlayer(account_id=account.account_id, username=account.username, network=self)
            self.members[account.account_id] = player
            return player

    def restore(
        self,
        *,
        account_id: int,
        username: str,
        money: float,
        owned_facilities: list[OwnedFacility],
        purchases: list[Purchase],
        selection: list[FacilityId],
        stored_energy: dict[FacilityId, float],
        prices: PriceSheet,
        locked_prices: list[LockedPrices],
        trading_results: list[TradingResult],
    ) -> WorkshopPlayer:
        """Put back a player saved from an earlier process, when a Run's session is reloaded.

        Not a join: the player was already admitted to the Run, so this only rebuilds its object.
        """
        with self._join_lock:
            player = WorkshopPlayer(
                account_id=account_id,
                username=username,
                network=self,
                money=money,
                owned_facilities=owned_facilities,
                purchases=purchases,
                selection=selection,
                stored_energy=stored_energy,
                prices=prices,
                locked_prices=locked_prices,
                trading_results=trading_results,
            )
            self.members[account_id] = player
            return player
