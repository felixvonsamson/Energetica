"""Schemas for API for the power priorities list."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel

from energetica.enums import RenewableFacilityType
from energetica.schemas.networks import PowerPriorityItem

if TYPE_CHECKING:
    from energetica.database.player import Player


class PowerPrioritiesListOut(BaseModel):
    renewables: list[RenewableFacilityType]
    power_priorities: list[PowerPriorityItem]

    @classmethod
    def from_player(cls, player: Player) -> PowerPrioritiesListOut:
        return PowerPrioritiesListOut(
            renewables=player.network_prices.get_sorted_renewables(player),
            power_priorities=player.network_prices.get_facility_priorities(player),
        )


class PowerPrioritiesListIn(BaseModel):
    power_priorities: list[PowerPriorityItem]
