"""Define the ClimateEventRecovery class which stores the climate events players are recovering from."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from energetica.freeplay.database import DBModel

if TYPE_CHECKING:
    from energetica.freeplay.database.player import Player


@dataclass
class ClimateEventRecovery(DBModel):
    """Class that stores the climate events players are recovering from."""

    name: str
    end_tick: float
    duration: float
    recovery_cost: float
    player: Player
