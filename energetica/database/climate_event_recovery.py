from dataclasses import dataclass

from energetica.database import DB


@dataclass
class ClimateEventRecovery(DB):
    """Class that stores the climate events players are recovering from"""
    name: str
    end_tick: float
    duration: float
    recovery_cost: float
