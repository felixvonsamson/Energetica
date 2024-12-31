"""Module for the OngoingProject class."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from functools import cached_property
from typing import TYPE_CHECKING

from energetica.config.assets import WorkerType
from energetica.database import DBModel
from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.player import Player


class ConstructionStatus:
    """Class that stores the status of ongoing constructions."""

    PAUSED = 0
    WAITING = 1
    ONGOING = 2


@dataclass
class OngoingProject(DBModel):
    """Class that stores projects currently under construction."""

    name: str
    family: str  # TODO (Felix) : is that really needed?
    player: Player

    end_tick_or_ticks_passed: (
        float  # in game ticks when the construction will be finished or ticks passed if it is paused
    )
    duration: float  # in game ticks
    status: int  # 0 for paused, 1 for waiting, 2 for ongoing. See ConstructionStatus
    construction_power: float  # Power consumed by the construction
    construction_pollution: float  # Emissions produced by the construction

    # multipliers to keep track of the technology level at the time of the start of the construction
    multipliers: dict[str, float] = field(default_factory=dict)

    speed: float = 1
    previous_speed: float = 1

    def was_paused_by_player(self) -> bool:
        """Return True if this construction is paused by the player."""
        return self.status == ConstructionStatus.PAUSED

    def is_ongoing(self) -> bool:
        """Return True if this construction is not paused and has no requirements."""
        return self.status == ConstructionStatus.ONGOING

    def pause(self) -> None:
        """Make this facility go from waiting or ongoing to paused."""
        assert not self.was_paused_by_player()
        if self.is_ongoing():
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
        self.status = ConstructionStatus.PAUSED

    def set_waiting(self) -> None:
        """Make this facility go from ongoing to waiting."""
        assert self.status == ConstructionStatus.ONGOING
        self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
        self.status = ConstructionStatus.WAITING

    def set_ongoing(self, *, start_now: bool = False) -> None:
        """
        Make this facility go from waiting to ongoing.

        start_now : if true, construction will skip the "Starting..." phase and start immediately (in the case of a
        worker that just got available)
        """
        assert self.status == ConstructionStatus.WAITING
        assert not self.prerequisites

        worker_type = WorkerType.RESEARCH if self.family == "Technologies" else WorkerType.CONSTRUCTION
        assert self.player.available_workers(worker_type) > 0
        if start_now:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + engine.data["total_t"]
        else:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
        self.status = ConstructionStatus.ONGOING

    def unpause(self) -> None:
        """Make this facility go from paused to either waiting or ongoing."""
        assert self.was_paused_by_player()
        worker_type = WorkerType.RESEARCH if self.family == "Technologies" else WorkerType.CONSTRUCTION
        if self.prerequisites or self.player.available_workers(worker_type) < 1:
            self.status = ConstructionStatus.WAITING
        else:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
            self.status = ConstructionStatus.ONGOING

    def delay_by(self, ticks: float) -> None:
        """Delay the construction by the given number of ticks."""
        assert self.is_ongoing()
        self.end_tick_or_ticks_passed += ticks
        self.speed = 1 - ticks

    def recompute_prerequisites_and_level(self) -> None:
        """Recompute the prerequisites and level of an ongoing construction."""
        if "_prerequisites_and_level" in self.__dict__:
            del self.__dict__["_prerequisites_and_level"]

    def progress(self) -> float:
        """Return the progress of the construction, as a float between 0 and 1."""
        if self.status == ConstructionStatus.ONGOING:
            return (self.duration - self.end_tick_or_ticks_passed + engine.data["total_t"] + 1) / self.duration
        else:
            return self.end_tick_or_ticks_passed / self.duration

    def updated_speed(self) -> float | None:
        """Return the speed of the construction except if it is 1 and unchanged since last tick."""
        if self.speed != self.previous_speed or self.speed != 1:
            return self.speed
        return None

    def reset_speed(self) -> None:
        """Reset the speed of the construction to 1 and stores the previous speed."""
        self.previous_speed = self.speed
        self.speed = 1

    @cached_property
    def _prerequisites_and_level(self) -> tuple[list[OngoingProject], int | None]:
        """Compute the prerequisites and level of an ongoing construction."""
        return self._compute_prerequisites_and_level()

    @property
    def prerequisites(self) -> list[OngoingProject]:
        """Return the prerequisites of the ongoing construction in form of a list of construction ids."""
        return self._prerequisites_and_level[0]

    @property
    def level(self) -> int | None:
        """Return the level of the ongoing construction."""
        return self._prerequisites_and_level[1]

    def _compute_prerequisites_and_level(self) -> tuple[list[OngoingProject], int | None]:
        """Compute the prerequisites and level of an ongoing construction."""
        prerequisites: list[OngoingProject] = []
        level = None
        this_priority_index: int
        if self.family == "Functional Facilities":
            # For functional facilities, the only prerequisites are ongoing constructions of the same type
            priority_list = self.player.constructions_by_priority
            this_priority_index = priority_list.index(self)
            # Go through all ongoing constructions that are higher up in the priority order
            level = self.player.functional_facility_lvl[self.name] + 1
            for candidate_prerequisite in priority_list[:this_priority_index]:
                # Add them as a prerequisite, if they are of the same type
                if candidate_prerequisite.name == self.name:
                    prerequisites.append(candidate_prerequisite)
                    level += 1
        elif self.family == "Technologies":
            # For technologies, const config needs to be checked
            const_config = engine.const_config["assets"]
            requirements = const_config[self.name]["requirements"]
            priority_list = self.player.researches_by_priority
            this_priority_index = priority_list.index(self)
            # Compute this constructions level by looking at constructions higher up in the priority list with same name
            level = self.player.technology_lvl[self.name] + 1
            for other_construction in priority_list[:this_priority_index]:
                if other_construction.name == self.name:
                    level += 1
            num_ongoing_researches_of: dict[str, int] = defaultdict(int)
            for candidate_prerequisite in priority_list[:this_priority_index]:
                if candidate_prerequisite.name == self.name:
                    prerequisites.append(candidate_prerequisite)
                    continue
                if candidate_prerequisite.name in requirements:
                    num_ongoing_researches_of[candidate_prerequisite.name] += 1
                    # Add them as a prerequisite, if they are, according to const_config
                    offset: int = requirements[candidate_prerequisite.name]
                    candidate_prerequisite_level: int = (
                        getattr(self.player, candidate_prerequisite.name)
                        + num_ongoing_researches_of[candidate_prerequisite.name]
                    )
                    if level + offset - 1 >= candidate_prerequisite_level:
                        prerequisites.append(candidate_prerequisite)
        return prerequisites, level
