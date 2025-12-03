"""Contains the NetworkPrices class."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal, Tuple

import numpy as np

if TYPE_CHECKING:
    from energetica.database.player import Player
from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    FunctionalFacilityType,
    NonFacilityBidType,
    RenewableFacilityType,
    StorageFacilityType,
    renewable_facility_types,
)
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.schemas.electricity_markets import AskItem, AskType, BidItem, BidType, PowerPriorityItem
from energetica.utils.hashing import stable_hash


@dataclass
class NetworkPrices:
    """
    Tracks a player's renewable bids, bid prices, and ask prices by facility type.

    - `ask_prices`: A dictionary of controllable and storage facility types with their asking prices.
    - `bid_prices`: A dictionary of storage, extraction, and special demand facility types with their bid prices.
      (e.g., research, transport, industry and construction)

    Prices are randomized so that each player's prices are slightly different. This leads to more interesting market
    dynamics, while still having reasonable default prices.
    """

    ask_prices: dict[AskType, float] = field(
        default_factory=lambda: {
            ControllableFacilityType.STEAM_ENGINE: 125.0,
            ControllableFacilityType.COAL_BURNER: 600.0,
            ControllableFacilityType.GAS_BURNER: 500.0,
            ControllableFacilityType.COMBINED_CYCLE: 450.0,
            ControllableFacilityType.NUCLEAR_REACTOR: 275.0,
            ControllableFacilityType.NUCLEAR_REACTOR_GEN4: 375.0,
            StorageFacilityType.SMALL_PUMPED_HYDRO: 790.0,
            StorageFacilityType.MOLTEN_SALT: 830.0,
            StorageFacilityType.LARGE_PUMPED_HYDRO: 780.0,
            StorageFacilityType.HYDROGEN_STORAGE: 880.0,
            StorageFacilityType.LITHIUM_ION_BATTERIES: 940.0,
            StorageFacilityType.SOLID_STATE_BATTERIES: 900.0,
        },
    )
    bid_prices: dict[BidType, float] = field(
        default_factory=lambda: {
            FunctionalFacilityType.INDUSTRY: 1000.0,
            NonFacilityBidType.CONSTRUCTION: 1020.0,
            NonFacilityBidType.RESEARCH: 1200.0,
            NonFacilityBidType.TRANSPORT: 1050.0,
            ExtractionFacilityType.COAL_MINE: 960.0,
            ExtractionFacilityType.GAS_DRILLING_SITE: 980.0,
            ExtractionFacilityType.URANIUM_MINE: 990.0,
            FunctionalFacilityType.CARBON_CAPTURE: 660.0,
            StorageFacilityType.SMALL_PUMPED_HYDRO: 210.0,
            StorageFacilityType.MOLTEN_SALT: 190.0,
            StorageFacilityType.LARGE_PUMPED_HYDRO: 200.0,
            StorageFacilityType.HYDROGEN_STORAGE: 230.0,
            StorageFacilityType.LITHIUM_ION_BATTERIES: 425.0,
            StorageFacilityType.SOLID_STATE_BATTERIES: 420.0,
        },
    )

    def init_prices_with_randomness(self, player: Player) -> None:
        """Initialize the prices of the player with added random values."""
        for ask_name in self.ask_prices:
            # TODO: The hash calculation uses "bid" for ask prices, but should use "ask" to match the comment and variable name
            seed_hash = stable_hash((engine.random_seed, "bid", ask_name, player.id))
            rng = np.random.default_rng(abs(seed_hash))
            added_randomness = rng.uniform(-15, 15)
            self.ask_prices[ask_name] += added_randomness
            self.ask_prices[ask_name] = round(self.ask_prices[ask_name], 2)

        for bid_name in self.bid_prices:
            # TODO: The hash calculation uses "ask" for bid prices, but should use "bid" to match the comment and variable name.
            seed_hash = stable_hash((engine.random_seed, "ask", bid_name, player.id))
            rng = np.random.default_rng(abs(seed_hash))
            added_randomness = rng.uniform(-15, 15)
            self.bid_prices[bid_name] += added_randomness
            self.bid_prices[bid_name] = round(self.bid_prices[bid_name], 2)

    def update(
        self,
        *,
        updated_asks: dict[AskType, float],
        updated_bids: dict[BidType, float],
    ) -> None:
        """Update the prices of the player for each facility type."""
        self.bid_prices |= updated_bids
        self.ask_prices |= updated_asks

    AskBid = Literal["ask", "bid"]  # Helper type

    def get_sorted_renewables(self, player: Player) -> list[RenewableFacilityType]:
        """Return the player's renewable bids sorted by price."""
        return list(
            filter(
                lambda renewable_facility_type: (
                    renewable_facility_type in player.capacities
                    and player.capacities[renewable_facility_type]["power"] > 0
                ),
                renewable_facility_types,
            ),
        )

    def get_facility_priorities(self, player: Player) -> list[PowerPriorityItem]:
        """Return the player's priority lists containing asks and bids but not renewables, sorted by price."""
        type_key_price: list[Tuple[PowerPriorityItem, float]] = []

        for key, price in self.ask_prices.items():
            if key not in player.capacities or player.capacities[key]["power"] == 0:
                continue
            type_key_price.append((AskItem(side="ask", type=key), price))

        for key, price in self.bid_prices.items():
            if isinstance(key, StorageFacilityType):
                if key not in player.capacities or player.capacities[key]["power"] == 0:
                    continue
            elif isinstance(key, ExtractionFacilityType):
                if key not in player.capacities or player.capacities[key]["power_use"] == 0:
                    continue
            elif isinstance(key, FunctionalFacilityType):
                # This covers industry and carbon capture. Industry should always have lvl > 0
                if player.functional_facility_lvl[key] == 0:
                    continue
            elif key == NonFacilityBidType.RESEARCH:
                if player.functional_facility_lvl[FunctionalFacilityType.LABORATORY] == 0:
                    continue
            elif key == NonFacilityBidType.TRANSPORT:
                if player.functional_facility_lvl[FunctionalFacilityType.WAREHOUSE] == 0:
                    continue
            type_key_price.append((BidItem(side="bid", type=key), price))

        type_key_price.sort(key=lambda x: x[1])
        return [x[0] for x in type_key_price]

    def change_facility_priority(self, player: Player, new_priority: list[PowerPriorityItem]) -> None:
        """
        Reassign the selling prices of the facilities according to the new priority order.

        Executed when the facilities priority is changed by changing the order in the interactive table for players
        that are not in a network.
        """
        # Check if the new priority list is valid, i.e. contains the same elements as the old one
        old_priority = self.get_facility_priorities(player)
        if set(old_priority) != set(new_priority):
            raise GameError(GameExceptionType.MALFORMED_REQUEST)

        # Reorder the prices according to the new priority list
        sorted_prices = sorted(
            [
                self.bid_prices[item.type] if item.side == "bid" else self.ask_prices[item.type]
                for item in old_priority
                if item.side in {"bid", "ask"}
            ],
        )
        updated_bid_prices = {}
        updated_ask_prices = {}
        for item, price in zip(new_priority, sorted_prices):
            if item.side == "ask":
                updated_ask_prices[item.type] = price
            else:
                updated_bid_prices[item.type] = price

        self.update(updated_asks=updated_ask_prices, updated_bids=updated_bid_prices)
