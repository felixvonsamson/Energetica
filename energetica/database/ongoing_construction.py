"""Module for the OngoingConstruction class."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import cached_property
from typing import TYPE_CHECKING

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
class OngoingConstructionCache:
    """Cache for the OngoingConstruction class."""

    construction_id: int

    @cached_property
    def _prerequisites_and_level(self) -> tuple[list[int], int]:
        """Compute the prerequisites and level of an ongoing construction."""
        construction = OngoingConstruction.get(self.construction_id)
        return construction._compute_prerequisites_and_level()

    @property
    def prerequisites(self) -> list[int]:
        """Return the prerequisites of the ongoing construction in form of a list of construction ids."""
        return self._prerequisites_and_level[0]

    @property
    def level(self) -> int:
        """Return the level of the ongoing construction."""
        return self._prerequisites_and_level[1]


@dataclass
class OngoingConstruction(DBModel):
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
        """Returns True if this construction is paused by the player"""
        return self.status == ConstructionStatus.PAUSED

    def is_ongoing(self) -> bool:
        """Returns True if this construction is not paused and has no requirements"""
        return self.status == ConstructionStatus.ONGOING

    def pause(self):
        """Make this facility go from waiting or ongoing to paused"""
        assert not self.was_paused_by_player()
        if self.is_ongoing():
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
        self.status = ConstructionStatus.PAUSED

    def set_waiting(self):
        """Make this facility go from ongoing to waiting."""
        assert self.status == ConstructionStatus.ONGOING
        self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
        self.status = ConstructionStatus.WAITING

    def set_ongoing(self, *, start_now=False):
        """
        Make this facility go from waiting to ongoing.
        start_now : if true, construction will skip the "Starting..." phase and start immediately (in the case of a
        worker that just got available)
        """
        assert self.status == ConstructionStatus.WAITING
        assert not self.cache.prerequisites

        assert self.player.available_workers(self.name) > 0
        if start_now:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + engine.data["total_t"]
        else:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
        self.status = ConstructionStatus.ONGOING

    def unpause(self):
        """Make this facility go from paused to either waiting or ongoing"""
        assert self.was_paused_by_player()
        if self.cache.prerequisites or self.player.available_workers(self.name) < 1:
            self.status = ConstructionStatus.WAITING
        else:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.data["total_t"] + 1)
            self.status = ConstructionStatus.ONGOING

    def delay_by(self, ticks: float):
        """Delays the construction by the given number of ticks"""
        assert self.is_ongoing()
        self.end_tick_or_ticks_passed += ticks
        self.speed = 1 - ticks

    @cached_property
    def cache(self) -> OngoingConstructionCache:
        """Return the cache for this ongoing construction."""
        if self.id not in engine.buffered["by_ongoing_construction"]:
            engine.buffered["by_ongoing_construction"][self.id] = OngoingConstructionCache(self.id)
        return engine.buffered["by_ongoing_construction"][self.id]

    def recompute_prerequisites_and_level(self) -> None:
        """Recompute the prerequisites and level of an ongoing construction."""
        if "_prerequisites_and_level" in self.cache.__dict__:
            del self.cache.__dict__["_prerequisites_and_level"]

    def progress(self) -> float:
        """Returns the progress of the construction, as a float between 0 and 1"""
        if self.status == ConstructionStatus.ONGOING:
            return (self.duration - self.end_tick_or_ticks_passed + engine.data["total_t"] + 1) / self.duration
        else:
            return self.end_tick_or_ticks_passed / self.duration

    def updated_speed(self) -> float | None:
        """Returns the speed of the construction except if it is 1 and unchanged since last tick"""
        if self.speed != self.previous_speed or self.speed != 1:
            return self.speed
        return None

    def reset_speed(self):
        """Resets the speed of the construction to 1 and stores the previous speed"""
        self.previous_speed = self.speed
        self.speed = 1

    def _compute_prerequisites_and_level(self) -> tuple[list[int], int]:
        """Compute the prerequisites and level of an ongoing construction."""
        if not TYPE_CHECKING:
            from energetica.database.ongoing_construction import OngoingConstruction

        prerequisites = []
        level = None
        if self.family == "Functional Facilities":
            # For functional facilities, the only prerequisites are ongoing constructions of the same type
            priority_list = self.player.construction_priorities
            this_priority_index = priority_list.index(self.id)
            # Go through all ongoing constructions that are higher up in the priority order
            level = getattr(self.player, self.name) + 1
            for candidate_prerequisite_id in priority_list[:this_priority_index]:
                # Add them as a prerequisite, if they are of the same type
                candidate_prerequisite = OngoingConstruction.get(candidate_prerequisite_id)
                if candidate_prerequisite.name == self.name:
                    prerequisites.append(candidate_prerequisite_id)
                    level += 1
        elif self.family == "Technologies":
            # For technologies, const config needs to be checked
            const_config = engine.const_config["assets"]
            requirements = const_config[self.name]["requirements"]
            priority_list = self.player.research_priorities
            this_priority_index: int = priority_list.index(self.id)
            # Compute this constructions level by looking at constructions higher up in the priority list with same name
            level = getattr(self.player, self.name) + 1
            for other_construction_id in priority_list[:this_priority_index]:
                other_construction: OngoingConstruction = OngoingConstruction.get(other_construction_id)
                if other_construction.name == self.name:
                    level += 1
            num_ongoing_researches_of = {}
            for candidate_prerequisite_id in priority_list[:this_priority_index]:
                candidate_prerequisite: OngoingConstruction = OngoingConstruction.get(candidate_prerequisite_id)
                if candidate_prerequisite.name == self.name:
                    prerequisites.append(candidate_prerequisite_id)
                    continue
                if candidate_prerequisite.name in requirements:
                    num_ongoing_researches_of[candidate_prerequisite.name] = (
                        num_ongoing_researches_of.get(candidate_prerequisite.name, 0) + 1
                    )
                    # Add them as a prerequisite, if they are, according to const_config
                    offset: int = requirements[candidate_prerequisite.name]
                    candidate_prerequisite_level: int = (
                        getattr(self.player, candidate_prerequisite.name)
                        + num_ongoing_researches_of[candidate_prerequisite.name]
                    )
                    if level + offset - 1 >= candidate_prerequisite_level:
                        prerequisites.append(candidate_prerequisite_id)
        return prerequisites, level
