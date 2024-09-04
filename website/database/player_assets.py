"""Here are defined the classes for the items stored in the database"""

from typing import List

from website import db


class OngoingConstruction(db.Model):
    """class that stores the things currently under construction"""

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

    # A list of OngoingConstruction id's
    _prerequisites = None
    # The level for this construction if it is a technology or a functional facility, otherwise -1 as special value
    _level = None

    def prerequisites(self, recompute=False) -> List[int]:
        """Returns a list of the id's of ongoing constructions that this constructions depends on"""
        if self._prerequisites is None or recompute:
            self._compute_prerequisites_and_level()
        return self._prerequisites

    def level(self) -> int:
        """
        In the case of functional facilities and technologies, returns the level of this construction.
        Otherwise, returns 0.
        """
        if self._level is None:
            self._compute_prerequisites_and_level()
        return self._level

    def reset_prerequisites(self):
        """Resets the prerequisites, so that it is recomputed next time prerequisites are accessed"""
        self._prerequisites = None

    def is_paused(self) -> bool:
        """Returns True if this construction is paused"""
        return self.suspension_time is not None

    def resume(self):
        """Make this facility go from paused to unpaused"""
        assert self.is_paused()
        from flask import current_app

        from website.game_engine import GameEngine

        engine: GameEngine = current_app.config["engine"]
        self.start_time += engine.data["total_t"] - self.suspension_time
        self.suspension_time = None

    def _compute_prerequisites_and_level(self):
        from website.database.player import Player

        player: Player = Player.query.get(self.player_id)
        self._prerequisites = []
        if self.family == "Functional facilities":
            # For functional facilities, the only prerequisites are ongoing constructions of the same type
            priority_list = player.read_list("construction_priorities")
            this_priority_index = priority_list.index(self.id)
            # Go through all ongoing constructions that are higher up in the priority order
            self._level = getattr(player, self.name) + 1
            for candidate_prerequisite_id in priority_list[:this_priority_index]:
                # Add them as a prerequisite, if they are of the same type
                candidate_prerequisite = OngoingConstruction.query.get(candidate_prerequisite_id)
                if candidate_prerequisite.name == self.name:
                    self._prerequisites.append(candidate_prerequisite_id)
                    self._level += 1
            return
        if self.family == "Technologies":
            # For technologies, const config needs to be checked
            from flask import current_app

            from website.game_engine import GameEngine

            engine: GameEngine = current_app.config["engine"]
            const_config = engine.const_config["assets"]
            requirements = const_config[self.name]["requirements"]
            priority_list = player.read_list("research_priorities")
            this_priority_index: int = priority_list.index(self.id)
            # Compute this constructions level by looking at constructions higher up in the priority list with same name
            self._level = getattr(player, self.name) + 1
            for other_construction_id in priority_list[:this_priority_index]:
                other_construction: OngoingConstruction = OngoingConstruction.query.get(other_construction_id)
                if other_construction.name == self.name:
                    self._level += 1
            num_ongoing_researches_of = {}
            for candidate_prerequisite_id in priority_list[:this_priority_index]:
                candidate_prerequisite: OngoingConstruction = OngoingConstruction.query.get(candidate_prerequisite_id)
                if candidate_prerequisite.name == self.name:
                    self._prerequisites.append(candidate_prerequisite_id)
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
                    if self._level + offset - 1 >= candidate_prerequisite_level:
                        self._prerequisites.append(candidate_prerequisite_id)
            return
        self._level = -1


class ActiveFacility(db.Model):
    """Class that stores the facilities on the server and their end of life time."""

    id = db.Column(db.Integer, primary_key=True)
    facility = db.Column(db.String(50))
    pos_x = db.Column(db.Float)
    pos_y = db.Column(db.Float)
    # time at witch the facility will be decommissioned
    end_of_life = db.Column(db.Integer)
    # multiply the base values by the following values
    price_multiplier = db.Column(db.Float)
    multiplier_1 = db.Column(db.Float)
    multiplier_2 = db.Column(db.Float)
    multiplier_3 = db.Column(db.Float)
    # percentage of the facility that is currently used
    usage = db.Column(db.Float, default=0)

    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))


class Shipment(db.Model):
    """Class that stores the resources shipment on their way"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    departure_time = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    suspension_time = db.Column(db.Integer, default=None)  # time at witch the shipment has been paused if it has
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player


class ResourceOnSale(db.Model):
    """Class that stores resources currently on sale"""

    id = db.Column(db.Integer, primary_key=True)
    resource = db.Column(db.String(10))
    quantity = db.Column(db.Float)
    price = db.Column(db.Float)
    creation_date = db.Column(db.DateTime)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player


class ClimateEventRecovery(db.Model):
    """Class that stores the climate events players are recovering from"""

    id = db.Column(db.Integer, primary_key=True)
    event = db.Column(db.String(20))
    start_time = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    recovery_cost = db.Column(db.Float)
    player_id = db.Column(db.Integer, db.ForeignKey("player.id"))  # can access player directly with .player
