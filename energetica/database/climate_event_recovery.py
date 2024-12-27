import itertools
from dataclasses import dataclass
from typing import ClassVar

from flask import current_app


@dataclass
class ClimateEventRecovery:
    """Class that stores the climate events players are recovering from"""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    name: str
    end_tick: float
    duration: float
    recovery_cost: float

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(ClimateEventRecovery.__next_id)
        current_app.config["engine"].players[self.id] = self
