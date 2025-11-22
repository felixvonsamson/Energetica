"""
Player capability flags schema.

These flags determine what features/pages a player has unlocked access to.
Separate from achievements (which are progress counters) to clarify intent.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from energetica.database.player import Player


class PlayerCapabilities(BaseModel):
    """
    Feature capability flags for a player.

    These flags control UI visibility and route access in the frontend.
    Updated when player builds functional facilities (laboratory, warehouse, etc.).

    All flags are boolean for efficient serialization (~50 bytes total).
    Sent with auth response and invalidated on facility construction.
    """

    # Core capabilities unlocked by building facilities
    has_laboratory: bool  # Can access /technology page, research UI
    has_warehouse: bool  # Can access /resource-market, shipments section
    has_storage: bool  # Can access /storage page
    has_network: bool  # Can access /network page, market features
    has_greenhouse_gas_effect: bool  # Has discovered climate/emissions tracking

    # Future capabilities (for when new features are added)
    # has_advanced_analytics: bool  # Advanced charts/analytics

    @classmethod
    def from_player(cls, player: Player) -> PlayerCapabilities:
        """
        Extract capability flags from player's achievements dict.

        Note: These are currently stored in player.achievements as 0/1 values,
        but conceptually they're capability flags, not achievement progress.
        Future refactor could move these to a dedicated player.capabilities field.
        """
        return cls(
            has_laboratory=bool(player.achievements.get("laboratory", 0)),
            has_warehouse=bool(player.achievements.get("warehouse", 0)),
            has_storage=bool(player.achievements.get("storage_facilities", 0)),
            has_network=bool(player.achievements.get("network", 0)),
            has_greenhouse_gas_effect=bool(player.achievements.get("GHG_effect", 0)),
        )
