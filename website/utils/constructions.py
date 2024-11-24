"""Utility functions for ongoing constructions."""

from typing import TYPE_CHECKING

from flask import current_app

if TYPE_CHECKING:
    from website.database.player import Player
    from website.database.player_assets import OngoingConstruction
    from website.game_engine import GameEngine
else:
    OngoingConstruction = object


def compute_prerequisites_and_level(ongoing_construction: OngoingConstruction) -> tuple[list[int], int]:
    """Compute the prerequisites and level of an ongoing construction."""
    from website.database.player_assets import OngoingConstruction

    player: Player = ongoing_construction.player
    prerequisites = []
    level = -1
    if ongoing_construction.family == "Functional facilities":
        # For functional facilities, the only prerequisites are ongoing constructions of the same type
        priority_list = player.read_list("construction_priorities")
        this_priority_index = priority_list.index(ongoing_construction.id)
        # Go through all ongoing constructions that are higher up in the priority order
        level = getattr(player, ongoing_construction.name) + 1
        for candidate_prerequisite_id in priority_list[:this_priority_index]:
            # Add them as a prerequisite, if they are of the same type
            candidate_prerequisite = OngoingConstruction.query.get(candidate_prerequisite_id)
            if candidate_prerequisite.name == ongoing_construction.name:
                prerequisites.append(candidate_prerequisite_id)
                level += 1
    elif ongoing_construction.family == "Technologies":
        # For technologies, const config needs to be checked
        engine: GameEngine = current_app.config["engine"]
        const_config = engine.const_config["assets"]
        requirements = const_config[ongoing_construction.name]["requirements"]
        priority_list = player.read_list("research_priorities")
        this_priority_index: int = priority_list.index(ongoing_construction.id)
        # Compute this constructions level by looking at constructions higher up in the priority list with same name
        level = getattr(player, ongoing_construction.name) + 1
        for other_construction_id in priority_list[:this_priority_index]:
            other_construction: OngoingConstruction = OngoingConstruction.query.get(other_construction_id)
            if other_construction.name == ongoing_construction.name:
                level += 1
        num_ongoing_researches_of = {}
        for candidate_prerequisite_id in priority_list[:this_priority_index]:
            candidate_prerequisite: OngoingConstruction = OngoingConstruction.query.get(candidate_prerequisite_id)
            if candidate_prerequisite.name == ongoing_construction.name:
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
    ongoing_construction.prerequisites = prerequisites
    ongoing_construction.level = level
    return prerequisites, level


def compute_prerequisites(ongoing_construction: OngoingConstruction) -> list[int]:
    """Return a list of the id's of ongoing constructions that this constructions depends on."""
    compute_prerequisites_and_level(ongoing_construction)
    return ongoing_construction.prerequisites


def compute_level(ongoing_construction: OngoingConstruction) -> int:
    """Return the level of the ongoing construction when applicable.

    For functional facilities and technologies, returns the level of this construction.
    For other types of constructions, returns -1.
    """
    compute_prerequisites_and_level(ongoing_construction)
    return ongoing_construction.level
