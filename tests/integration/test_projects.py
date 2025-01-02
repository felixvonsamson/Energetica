import os
import sys
from typing import Iterable

sys.path.append(os.getcwd())
import pytest
from werkzeug.security import generate_password_hash

from energetica import create_app
from energetica.database.map import HexTile
from energetica.database.ongoing_project import OngoingProject, ProjectStatus
from energetica.database.player import Player
from energetica.globals import engine
from energetica.utils.assets import (
    cancel_project,
    decrease_project_priority,
    finish_project,
    queue_project,
    toggle_pause_project,
)
from energetica.utils.misc import confirm_location

# RULES FOR PROJECTS:
# 1. All projects (in the database) should appear exactly once in the priority list.
# 2. The number of ongoing constructions / research projects must be less then or equal to the number of construction / lab workers.
# 3. In the project priority list, ongoing projects must come before all waiting projects and all waiting projects must come before all paused projects.
# 4. All projects have a finish time in the future.
# 5. A project can not be ongoing if it has unfulfilled requirements.
# 6. All requirements of a project must appear before the project in the priority list.
# 7. If there are projects waiting that have all their requirements fulfilled, there should be no available workers of the corresponding type.


def validate_rules(player: Player):
    """This function validates all of the above rules."""
    # Rule 1
    assert len({construction.id for construction in player.constructions_by_priority}) == len(
        player.constructions_by_priority
    )
    assert len({research.id for research in player.researches_by_priority}) == len(player.researches_by_priority)
    for construction in player.constructions_by_priority:
        assert construction is not None
        assert construction.player == player
        assert construction.family != "Technologies"
    for research in player.researches_by_priority:
        assert research is not None
        assert research.player == player
        assert research.family == "Technologies"
    assert OngoingProject.count(
        condition=lambda construction: construction.player == player and construction.family != "Technologies"
    ) == len(player.constructions_by_priority)
    assert OngoingProject.count(
        condition=lambda research: research.player == player and research.family == "Technologies"
    ) == len(player.researches_by_priority)

    # Rule 2
    ongoing_constructions = list(
        OngoingProject.filter(
            lambda construction: construction.player == player
            and construction.status == ProjectStatus.ONGOING
            and construction.family != "Technologies"
        )
    )
    if len(ongoing_constructions) > player.workers["construction"]:
        pytest.fail(
            f"Rule 2 violation: there are {len(ongoing_constructions)} ongoing constructions "
            f"({','.join(map(lambda c: c.name, ongoing_constructions))}), "
            f"but only {player.workers["construction"]} construction workers."
        )

    ongoing_research = list(
        OngoingProject.filter_by(
            player=player,
            status=ProjectStatus.ONGOING,
            family="Technologies",
        )
    )
    if len(ongoing_research) > player.workers["laboratory"]:
        pytest.fail(
            f"Rule 2 violation: there are {len(ongoing_research)} ongoing research projects "
            f"({','.join(map(lambda c: c.name, ongoing_research))}), "
            f"but only {player.workers["laboratory"]} lab workers."
        )

    # Rule 3
    status_list_constructions = list(map(lambda x: x.status, player.constructions_by_priority))
    assert sorted(status_list_constructions, reverse=True) == status_list_constructions
    status_list_research = list(map(lambda x: x.status, player.researches_by_priority))
    assert sorted(status_list_research, reverse=True) == status_list_research

    # Rule 4
    assert not OngoingProject.count(
        condition=lambda project: project.player == player
        and project.status == ProjectStatus.ONGOING
        and project.end_tick_or_ticks_passed <= engine.data["total_t"]
    )
    assert not OngoingProject.count(
        condition=lambda project: project.player == player
        and project.status != ProjectStatus.ONGOING
        and project.end_tick_or_ticks_passed > engine.data["total_t"]
    )

    # Rule 5
    ongoing_projects: Iterable[OngoingProject] = OngoingProject.filter_by(
        player=player,
        status=ProjectStatus.ONGOING,
    )
    for project in ongoing_projects:
        prerequisites = project.prerequisites
        if prerequisites:
            del project._prerequisites_and_levels
            assert not project.prerequisites

    # Rule 6
    for index, construction in enumerate(player.constructions_by_priority):
        for prerequisite in construction.prerequisites:
            if player.constructions_by_priority.index(prerequisite) >= index:
                del construction._prerequisites_and_levels
                for prerequisite in construction.prerequisites:
                    assert player.constructions_by_priority.index(prerequisite) < index
                break
    for index, research in enumerate(player.researches_by_priority):
        for prerequisite in research.prerequisites:
            if player.researches_by_priority.index(prerequisite) >= index:
                del research._prerequisites_and_levels
                for prerequisite in research.prerequisites:
                    assert player.researches_by_priority.index(prerequisite) < index
                break

    # Rule 7
    waiting_constructions: list[OngoingProject] = list(
        OngoingProject.filter(
            lambda construction: construction.player == player
            and construction.status == ProjectStatus.WAITING
            and construction.family != "Technologies"
            and not construction.prerequisites
        )
    )
    if waiting_constructions:
        count_on_going_constructions = OngoingProject.count(
            condition=lambda construction: construction.player == player
            and construction.status == ProjectStatus.ONGOING
            and construction.family != "Technologies"
        )
        if player.workers["construction"] != count_on_going_constructions:
            pytest.fail(
                "Rule 7 failed for constructions. "
                f"Player has {len(waiting_constructions)} waiting constructions "
                f"({','.join(map(lambda c: c.name, waiting_constructions))}), "
                f"but has {player.workers["construction"]} construction workers, "
                f"and only {count_on_going_constructions} ongoing constructions."
            )
    waiting_research: list[OngoingProject] = list(
        OngoingProject.filter(
            lambda research: research.player == player
            and research.status == ProjectStatus.WAITING
            and research.family == "Technologies"
            and not research.prerequisites
        )
    )
    if waiting_research:
        count_on_going_research = OngoingProject.count(
            condition=lambda research: research.player == player
            and research.status == ProjectStatus.ONGOING
            and research.family == "Technologies"
        )
        if player.workers["laboratory"] != count_on_going_research:
            pytest.fail(
                "Rule 7 failed for research. "
                f"Player has {len(waiting_research)} waiting research projects "
                f"({','.join(map(lambda c: c.name, waiting_research))}), "
                f"but has {player.workers["laboratory"]} lab workers, "
                f"and only {count_on_going_research} ongoing research projects."
            )


def test_swap_paused_and_unpaused_constructions():
    """Setup:
    Player has one construction worker, constructions A and B are launched, A is ongoing, B is waiting.
    After decreasing the priority of the construction A, construction B should be ongoing, and A waiting.
    """

    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    validate_rules(player)
    construction_A = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    assert construction_A.status == ProjectStatus.ONGOING
    construction_B = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    assert construction_B.status == ProjectStatus.WAITING
    decrease_project_priority(player, construction_A)
    validate_rules(player)
    assert construction_B.status == ProjectStatus.ONGOING
    assert construction_A.status == ProjectStatus.WAITING


def test_cancel_construction():
    """Setup:
    Player starts a construction and then cancels it. There should be no more constructions afterwards.
    """
    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    validate_rules(player)
    construction = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    assert construction.status == ProjectStatus.ONGOING
    cancel_project(player, construction, force=True)
    validate_rules(player)
    assert len(player.constructions_by_priority) == 0


def test_pause_construction():
    """Setup:
    Player starts a construction and then pauses it. It should be paused.
    Then player unpauses the construction. It should be ongoing.
    """

    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    validate_rules(player)
    construction = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    assert construction.status == ProjectStatus.ONGOING
    toggle_pause_project(player, construction)
    validate_rules(player)
    assert construction.status == ProjectStatus.PAUSED
    toggle_pause_project(player, construction)
    validate_rules(player)
    assert construction.status == ProjectStatus.ONGOING


def test_queue_two_pause_one():
    """Setup:
    Player starts constructions A and B. Player then pauses A.
    """
    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    validate_rules(player)
    construction_A = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    construction_B = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    toggle_pause_project(player, construction_A)
    validate_rules(player)
    assert player.constructions_by_priority == [construction_B, construction_A]


def test_three_constructions_with_pause():
    """Setup:
    Player starts constructions A, B and C. Player then pauses C, then A.
    """

    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    player.money = 1_000_000_000
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    validate_rules(player)
    construction_A = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    construction_B = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    construction_C = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    toggle_pause_project(player, construction_C)
    validate_rules(player)
    toggle_pause_project(player, construction_A)
    validate_rules(player)
    # assert player.constructions_by_priority == [construction_B, construction_A, construction_C]


def test_add_two_and_cancel_one():
    """Setup:
    queue(1)
    queue(2)
    cancel(1)
    """

    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    player.money = 1_000_000_000
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    validate_rules(player)
    construction_1 = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    construction_2 = queue_project(player=player, asset="steam_engine", force=True)
    validate_rules(player)
    cancel_project(player, construction_1, force=True)
    validate_rules(player)
    assert player.constructions_by_priority == [construction_2]


def test_technologies_pausing_propagates_requirements():
    """Setup:
    Player starts technology A, and then technology B, which has A as a prerequisite. Pausing A should pause B.
    Here, A is mathematics, B is mechanical_engineering.
    """

    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    player.money = 1_000_000_000
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    finish_project(queue_project(player=player, asset="laboratory", force=True))

    validate_rules(player)
    technology_a = queue_project(player=player, asset="mathematics", force=True)
    validate_rules(player)
    assert technology_a.status == ProjectStatus.ONGOING
    technology_b = queue_project(player=player, asset="mechanical_engineering", force=True)
    validate_rules(player)
    assert technology_b.status == ProjectStatus.WAITING
    toggle_pause_project(player, technology_a)
    validate_rules(player)
    assert technology_a.status == ProjectStatus.PAUSED
    assert technology_b.status == ProjectStatus.PAUSED


def test_math_and_building_tech():
    """Setup:
    Player starts mathematics and building_technology in that order.
    """

    create_app(rm_instance=True, skip_adding_handlers=True)

    player = Player(username="username", pwhash=generate_password_hash("password"))
    player.money = 1_000_000_000
    hex_tile = HexTile.get(1)
    confirm_location(player, hex_tile)
    finish_project(queue_project(player=player, asset="laboratory", force=True))

    validate_rules(player)
    technology_a = queue_project(player=player, asset="mathematics", force=True)
    validate_rules(player)
    assert technology_a.status == ProjectStatus.ONGOING
    technology_c = queue_project(player=player, asset="building_technology", force=True)
    validate_rules(player)
    assert technology_c.status == ProjectStatus.WAITING
