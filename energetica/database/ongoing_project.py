"""Module for the OngoingProject class."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from functools import cached_property
from typing import TYPE_CHECKING

from energetica import technology_effects
from energetica.database import DBModel
from energetica.enums import FunctionalFacilityType, ProjectStatus, ProjectType, TechnologyType, WorkerType
from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class OngoingProject(DBModel):
    """Class that stores projects."""

    project_type: ProjectType
    player: Player

    duration: float  # in game ticks
    project_power: float  # Power consumed by the project
    project_pollution: float  # Emissions produced by the project
    status: ProjectStatus = ProjectStatus.PAUSED  # 0 for paused, 1 for waiting, 2 for ongoing. See ProjectStatus
    end_tick_or_ticks_passed: float = 0  # in game ticks when the project will be finished or ticks passed if paused

    # multipliers to keep track of the technology level at the time of the start of the project
    multipliers: dict[str, float] = field(init=False)

    speed: float = 1
    previous_speed: float = 1

    def __post_init__(self) -> None:
        """Post initialization function."""
        self.multipliers = technology_effects.current_multipliers(
            self.player,
            self.project_type,
        )  # has to be called before the super().__post_init__()
        super().__post_init__()  # Needed for DBModel to add this new object to the database

    @property
    def worker_type(self) -> WorkerType:
        """Return the worker type of the project."""
        return self.project_type.worker_type

    def was_paused_by_player(self) -> bool:
        """Return True if this project is paused by the player."""
        return self.status == ProjectStatus.PAUSED

    @property
    def is_ongoing(self) -> bool:
        """Return True if this project is not paused and has no requirements."""
        return self.status == ProjectStatus.ONGOING

    def pause(self) -> None:
        """Make this facility go from waiting or ongoing to paused."""
        assert not self.was_paused_by_player()
        if self.is_ongoing:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.total_t + 1)
        self.status = ProjectStatus.PAUSED

    def set_waiting(self) -> None:
        """Make this facility go from ongoing to waiting."""
        assert self.status == ProjectStatus.ONGOING
        self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.total_t + 1)
        self.status = ProjectStatus.WAITING

    def set_ongoing(self, *, start_now: bool = False) -> None:
        """
        Make this facility go from waiting to ongoing.

        start_now : if true, project will skip the "Starting..." phase and start immediately (in the case of a
        worker that just got available)
        """
        assert self.status == ProjectStatus.WAITING
        assert not self.prerequisites

        assert self.player.available_workers(self.project_type.worker_type) > 0
        if start_now:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + engine.total_t
        else:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.total_t + 1)
        self.status = ProjectStatus.ONGOING

    def unpause(self) -> None:
        """Make this facility go from paused to either waiting or ongoing."""
        assert self.was_paused_by_player()
        if self.prerequisites or self.player.available_workers(self.project_type.worker_type) < 1:
            self.status = ProjectStatus.WAITING
        else:
            self.end_tick_or_ticks_passed = self.duration - self.end_tick_or_ticks_passed + (engine.total_t + 1)
            self.status = ProjectStatus.ONGOING

    def delay_by(self, ticks: float) -> None:
        """Delay the project by the given number of ticks."""
        assert self.is_ongoing
        self.end_tick_or_ticks_passed += ticks
        self.speed = 1 - ticks

    def recompute_prerequisites_and_level(self) -> None:
        """Recompute the prerequisites and level of an ongoing project."""
        if "_prerequisites_and_level" in self.__dict__:
            del self.__dict__["_prerequisites_and_level"]

    def progress(self) -> float:
        """Return the progress of the project, as a float between 0 and 1."""
        if self.status == ProjectStatus.ONGOING:
            return (self.duration - self.end_tick_or_ticks_passed + engine.total_t + 1) / self.duration
        else:
            return self.end_tick_or_ticks_passed / self.duration

    def updated_speed(self) -> float | None:
        """Return the speed of the project except if it is 1 and unchanged since last tick."""
        if self.speed != self.previous_speed or self.speed != 1:
            return self.speed
        return None

    def reset_speed(self) -> None:
        """Reset the speed of the project to 1 and stores the previous speed."""
        self.previous_speed = self.speed
        self.speed = 1

    @cached_property
    def _prerequisites_and_level(self) -> tuple[list[OngoingProject], int | None]:
        """Compute the prerequisites and level of an ongoing project."""
        return self._compute_prerequisites_and_level()

    @property
    def prerequisites(self) -> list[OngoingProject]:
        """Return the prerequisites of the ongoing project in form of a list of project ids."""
        return self._prerequisites_and_level[0]

    @property
    def level(self) -> int | None:
        """Return the level of the ongoing project."""
        return self._prerequisites_and_level[1]

    def _compute_prerequisites_and_level(self) -> tuple[list[OngoingProject], int | None]:
        """Compute the prerequisites and level of an ongoing project."""
        prerequisites: list[OngoingProject] = []
        level = None
        this_priority_index: int
        if isinstance(self.project_type, FunctionalFacilityType):
            # For functional facilities, the only prerequisites are ongoing projects of the same type
            # TODO(mglst): This is not correct, carbon capture has technology prerequisites
            priority_list = self.player.constructions_by_priority
            this_priority_index = priority_list.index(self)
            # Go through all ongoing constructions that are higher up in the priority order
            level = self.player.functional_facility_lvl[self.project_type] + 1
            for candidate_prerequisite in priority_list[:this_priority_index]:
                # Add them as a prerequisite, if they are of the same type
                if candidate_prerequisite.project_type == self.project_type:
                    prerequisites.append(candidate_prerequisite)
                    level += 1
        elif isinstance(self.project_type, TechnologyType):
            # For technologies, const config needs to be checked
            const_config = engine.const_config["assets"]
            requirements = const_config[self.project_type]["requirements"]
            priority_list = self.player.researches_by_priority
            this_priority_index = priority_list.index(self)
            # Compute this technologies level by looking at technologies higher up in the priority list with same name
            level = self.player.technology_lvl[self.project_type] + 1
            for other_technology in priority_list[:this_priority_index]:
                if other_technology.project_type == self.project_type:
                    level += 1
            num_ongoing_researches_of: dict[str, int] = defaultdict(int)
            for candidate_prerequisite in priority_list[:this_priority_index]:
                if candidate_prerequisite.project_type == self.project_type:
                    prerequisites.append(candidate_prerequisite)
                    continue
                if candidate_prerequisite.project_type in requirements:
                    num_ongoing_researches_of[candidate_prerequisite.project_type] += 1
                    # Add them as a prerequisite, if they are, according to const_config
                    offset: int = requirements[candidate_prerequisite.project_type]
                    assert isinstance(candidate_prerequisite.project_type, TechnologyType)
                    candidate_prerequisite_level: int = (
                        self.player.technology_lvl[candidate_prerequisite.project_type]
                        + num_ongoing_researches_of[candidate_prerequisite.project_type]
                    )
                    if level + offset - 1 >= candidate_prerequisite_level:
                        prerequisites.append(candidate_prerequisite)
        return prerequisites, level
