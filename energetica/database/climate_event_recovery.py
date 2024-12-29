from dataclasses import dataclass

from energetica.database import DBModel


@dataclass
class ClimateEventRecovery(DBModel):
    """Class that stores the climate events players are recovering from"""

    name: str
    end_tick: float
    duration: float
    recovery_cost: float
