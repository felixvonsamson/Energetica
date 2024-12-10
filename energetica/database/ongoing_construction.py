"""Module for the OngoingConstruction class."""

from dataclasses import dataclass
from functools import cached_property
from typing import TYPE_CHECKING

from flask import current_app

from energetica.database import db

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine


class ConstructionStatus:
    """Class that stores the status of ongoing constructions."""

    PAUSED = 0
    WAITING = 1
    ONGOING = 2


@dataclass
class OngoingConstructionData:
    """Dataclass that stores the data of ongoing constructions."""

    speed: float = 1
    previous_speed: float = 1


@dataclass
class OngoingConstructionCache:
    """Cache for the OngoingConstruction class."""

    construction_id: int

    @cached_property
    def _prerequisites_and_level(self) -> tuple[list[int], int]:
        """Compute the prerequisites and level of an ongoing construction."""
        construction = db.session.get(OngoingConstruction, self.construction_id)
        return construction._compute_prerequisites_and_level()

    @property
    def prerequisites(self) -> list[int]:
        """Return the prerequisites of the ongoing construction."""
        return self._prerequisites_and_level[0]

    @property
    def level(self) -> int:
        """Return the level of the ongoing construction."""
        return self._prerequisites_and_level[1]


class OngoingConstruction(db.Model):
    """Class that stores projects currently under construction."""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    # to assign the thing to the correct page
    _end_tick_or_ticks_passed = db.Column(
        db.Float
    )  # in game ticks when the construction will be finished or ticks passed if it is paused
    duration = db.Column(db.Float)  # in game ticks
    # time at witch the construction has been paused if it has else None
    status = db.Column(db.Integer)  # 0 for paused, 1 for waiting, 2 for ongoing. See ConstructionStatus
    # Power consumed and emissions produced by the construction
    construction_power = db.Column(db.Float)
    construction_pollution = db.Column(db.Float)
    # multipliers to keep track of the technology level at the time of the start of the construction
    price_multiplier = db.Column(db.Float, default=1)
    multiplier_1 = db.Column(db.Float, default=1)
    multiplier_2 = db.Column(db.Float, default=1)
    multiplier_3 = db.Column(db.Float, default=1)
    # can access player directly with .player
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))

    def was_paused_by_player(self) -> bool:
        """Returns True if this construction is paused by the player"""
        return self.status == ConstructionStatus.PAUSED

    def is_ongoing(self) -> bool:
        """Returns True if this construction is not paused and has no requirements"""
        return self.status == ConstructionStatus.ONGOING

    def pause(self):
        """Make this facility go from waiting or ongoing to paused"""
        assert not self.was_paused_by_player()
        engine: GameEngine = current_app.config["engine"]
        if self.is_ongoing():
            self._end_tick_or_ticks_passed = self.duration - self._end_tick_or_ticks_passed + engine.data["total_t"]
        self.status = ConstructionStatus.PAUSED
        db.session.flush()

    def set_ongoing(self):
        """Make this facility go from waiting to ongoing."""
        assert self.status == ConstructionStatus.WAITING
        assert not self.cache.prerequisites
        from energetica.database.player import Player

        engine: GameEngine = current_app.config["engine"]
        player: Player = Player.query.get(self.player_id)
        assert player.available_workers(self.family) > 0
        engine: GameEngine = current_app.config["engine"]
        self._end_tick_or_ticks_passed = self.duration - self._end_tick_or_ticks_passed + engine.data["total_t"]
        self.status = ConstructionStatus.ONGOING
        db.session.flush()

    def unpause(self):
        """Make this facility go from paused to either waiting or ongoing"""
        assert self.was_paused_by_player()
        from energetica.database.player import Player

        engine: GameEngine = current_app.config["engine"]
        player: Player = Player.query.get(self.player_id)
        if self.cache.prerequisites or player.available_workers(self.family) < 1:
            self.status = ConstructionStatus.WAITING
        else:
            self._end_tick_or_ticks_passed = self.duration - self._end_tick_or_ticks_passed + engine.data["total_t"]
            self.status = ConstructionStatus.ONGOING
        db.session.flush()

    def delay_by(self, ticks: float):
        """Delays the construction by the given number of ticks"""
        assert self.is_ongoing()
        self._end_tick_or_ticks_passed += ticks
        self.data.speed = 1 - ticks

    @cached_property
    def data(self) -> OngoingConstructionData:
        """Return the data of the ongoing construction."""
        return current_app.config["engine"].data["by_ongoing_construction"][self.id]

    @cached_property
    def cache(self) -> OngoingConstructionCache:
        """Return the cache for this ongoing construction."""
        if self.id not in current_app.config["engine"].buffered["by_ongoing_construction"]:
            current_app.config["engine"].buffered["by_ongoing_construction"][self.id] = OngoingConstructionCache(
                self.id
            )
        return current_app.config["engine"].buffered["by_ongoing_construction"][self.id]

    def recompute_prerequisites_and_level(self) -> None:
        """Recompute the prerequisites and level of an ongoing construction."""
        if "_prerequisites_and_level" in self.cache.__dict__:
            del self.cache.__dict__["_prerequisites_and_level"]

    def progress(self) -> float:
        """Returns the progress of the construction, as a float between 0 and 1"""
        engine: GameEngine = current_app.config["engine"]
        if self.status == ConstructionStatus.ONGOING:
            return (self.duration - self._end_tick_or_ticks_passed + engine.data["total_t"]) / self.duration
        else:
            return self._end_tick_or_ticks_passed / self.duration

    def updated_speed(self) -> float | None:
        """Returns the speed of the construction except if it is 1 and unchanged since last tick"""
        if self.data.speed != self.data.previous_speed or self.data.speed != 1:
            return self.data.speed
        return None

    def reset_speed(self):
        """Resets the speed of the construction to 1 and stores the previous speed"""
        self.data.previous_speed = self.data.speed
        self.data.speed = 1

    def _compute_prerequisites_and_level(self) -> tuple[list[int], int]:
        """Compute the prerequisites and level of an ongoing construction."""
        from energetica.database.player import Player

        if not TYPE_CHECKING:
            from energetica.database.ongoing_construction import OngoingConstruction

        player: Player = db.session.get(Player, self.player_id)
        prerequisites = []
        level = None
        if self.family == "Functional facilities":
            # For functional facilities, the only prerequisites are ongoing constructions of the same type
            priority_list = player.read_list("construction_priorities")
            this_priority_index = priority_list.index(self.id)
            # Go through all ongoing constructions that are higher up in the priority order
            level = getattr(player, self.name) + 1
            for candidate_prerequisite_id in priority_list[:this_priority_index]:
                # Add them as a prerequisite, if they are of the same type
                candidate_prerequisite = db.session.get(OngoingConstruction, candidate_prerequisite_id)
                if candidate_prerequisite.name == self.name:
                    prerequisites.append(candidate_prerequisite_id)
                    level += 1
        elif self.family == "Technologies":
            # For technologies, const config needs to be checked
            engine: GameEngine = current_app.config["engine"]
            const_config = engine.const_config["assets"]
            requirements = const_config[self.name]["requirements"]
            priority_list = player.read_list("research_priorities")
            this_priority_index: int = priority_list.index(self.id)
            # Compute this constructions level by looking at constructions higher up in the priority list with same name
            level = getattr(player, self.name) + 1
            for other_construction_id in priority_list[:this_priority_index]:
                other_construction: OngoingConstruction = db.session.get(OngoingConstruction, other_construction_id)
                if other_construction.name == self.name:
                    level += 1
            num_ongoing_researches_of = {}
            for candidate_prerequisite_id in priority_list[:this_priority_index]:
                candidate_prerequisite: OngoingConstruction = db.session.get(
                    OngoingConstruction, candidate_prerequisite_id
                )
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
                        getattr(player, candidate_prerequisite.name)
                        + num_ongoing_researches_of[candidate_prerequisite.name]
                    )
                    if level + offset - 1 >= candidate_prerequisite_level:
                        prerequisites.append(candidate_prerequisite_id)
        return prerequisites, level
