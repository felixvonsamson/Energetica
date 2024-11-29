from dataclasses import dataclass
from functools import cached_property
from typing import TYPE_CHECKING

from flask import current_app

from energetica.database import db

if TYPE_CHECKING:
    from energetica.game_engine import GameEngine


@dataclass
class OngoingConstructionCache(object):
    construction_id: int

    @cached_property
    def _prerequisites_and_level(self) -> tuple[list[int], int]:
        construction = db.session.get(OngoingConstruction, self.construction_id)
        return construction._compute_prerequisites_and_level()

    @property
    def prerequisites(self) -> list[int]:
        return self._prerequisites_and_level[0]

    @property
    def level(self) -> int:
        return self._prerequisites_and_level[1]


class OngoingConstruction(db.Model):
    """class that stores the things currently under construction."""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    family = db.Column(db.String(50))
    # to assign the thing to the correct page
    start_time = db.Column(db.Integer)  # in game ticks
    duration = db.Column(db.Integer)  # in game ticks
    # time at witch the construction has been paused if it has else None
    suspension_time = db.Column(db.Integer)
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

    def is_paused(self) -> bool:
        """Returns True if this construction is paused"""
        return self.suspension_time is not None

    def resume(self):
        """Make this facility go from paused to unpaused"""
        assert self.is_paused()
        from flask import current_app

        engine: GameEngine = current_app.config["engine"]
        self.start_time += engine.data["total_t"] - self.suspension_time
        self.suspension_time = None

    @cached_property
    def cache(self) -> OngoingConstructionCache:
        if self.id not in current_app.config["engine"].buffered["by_ongoing_construction"]:
            current_app.config["engine"].buffered["by_ongoing_construction"][self.id] = OngoingConstructionCache(
                self.id
            )
        return current_app.config["engine"].buffered["by_ongoing_construction"][self.id]

    def recompute_prerequisites_and_level(self) -> None:
        """Recompute the prerequisites and level of an ongoing construction."""
        if "_prerequisites_and_level" in self.cache.__dict__:
            del self.cache.__dict__["_prerequisites_and_level"]

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
