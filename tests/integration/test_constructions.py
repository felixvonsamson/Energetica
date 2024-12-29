import os
import sys
from typing import Iterable

sys.path.append(os.getcwd())
import pytest
from werkzeug.security import generate_password_hash

from energetica import create_app
from energetica.database.map import HexTile
from energetica.database.ongoing_construction import ConstructionStatus, OngoingConstruction
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

# RULES FOR CONSTRUCTIONS:
# 1. All projects (in the database) should appear exactly once in the priority list.
# 2. The number of ongoing constructions / research projects must be less then or equal to the number of construction / lab workers.
# 3. In the project priority list, ongoing projects must come before all waiting projects and all waiting projects must come before all paused projects.
# 4. All projects have a finish time in the future.
# 5. A project can not be ongoing if it has unfulfilled requirements.
# 6. All requirements of a project must appear before the project in the priority list.
# 7. If there are projects waiting that have all their requirements fulfilled, there should be no available workers of the corresponding type.


def validate_rules(player):
    """This function validates all of the above rules."""
    # Rule 1
    construction_priorities = player.construction_priorities
    research_priorities = player.research_priorities
    assert len(set(construction_priorities)) == len(construction_priorities)
    assert len(set(research_priorities)) == len(research_priorities)
    for construction_id in construction_priorities:
        construction = OngoingConstruction.get(construction_id)
        assert construction is not None
        assert construction.player_id == player.id
        assert construction.family != "Technologies"
    for research_id in research_priorities:
        research = OngoingConstruction.get(research_id)
        assert research is not None
        assert research.player_id == player.id
        assert research.family == "Technologies"
    assert len(
        OngoingConstruction.filter(
            lambda construction: construction.player == player and construction.family != "Technologies"
        )
    ) == len(construction_priorities)
    assert len(
        OngoingConstruction.filter(
            lambda construction: construction.player == player and construction.family == "Technologies"
        )
    ) == len(research_priorities)

    # Rule 2
    ongoing_constructions = list(
        OngoingConstruction.filter(
            lambda construction: construction.player == player
            and construction.status == ConstructionStatus.ONGOING
            and construction.family != "Technologies"
        )
    )
    if len(ongoing_constructions) > player.workers["construction"]:
        pytest.fail(
            f"Rule 2 violation: there are {len(ongoing_constructions)} ongoing constructions "
            f"({','.join(map(lambda c: c.name, ongoing_constructions))}), "
            f"but only {player.workers["construction"]} construction workers."
        )

    ongoing_research = OngoingConstruction.filter_by(
        player_id=player.id,
        status=ConstructionStatus.ONGOING,
        family="Technologies",
    )
    if len(ongoing_research) > player.workers["laboratory"]:
        pytest.fail(
            f"Rule 2 violation: there are {len(ongoing_research)} ongoing research projects "
            f"({','.join(map(lambda c: c.name, ongoing_research))}), "
            f"but only {player.workers["laboratory"]} lab workers."
        )

    # Rule 3
    status_list_constructions = list(map(lambda x: OngoingConstruction.get(x).status, construction_priorities))
    assert sorted(status_list_constructions, reverse=True) == status_list_constructions
    status_list_research = list(map(lambda x: OngoingConstruction.get(x).status, research_priorities))
    assert sorted(status_list_research, reverse=True) == status_list_research

    # Rule 4
    assert not OngoingConstruction.filter(
        lambda construction: construction.player == player
        and construction.status == ConstructionStatus.ONGOING
        and construction.end_tick_or_ticks_passed <= engine.data["total_t"]
    )
    assert not OngoingConstruction.filter(
        lambda construction: construction.player == player
        and construction.status != ConstructionStatus.ONGOING
        and construction.end_tick_or_ticks_passed > engine.data["total_t"]
    )

    # Rule 5
    ongoing_projects: Iterable[OngoingConstruction] = OngoingConstruction.filter_by(
        player_id=player.id,
        status=ConstructionStatus.ONGOING,
    )
    for project in ongoing_projects:
        prerequisites = project.cache.prerequisites
        if prerequisites:
            del project.cache._prerequisites_and_levels
            assert not project.cache.prerequisites

    # Rule 6
    for index, construction_id in enumerate(construction_priorities):
        construction = OngoingConstruction.get(construction_id)
        for prerequisite in construction.cache.prerequisites:
            if construction_priorities.index(prerequisite) >= index:
                del construction.cache._prerequisites_and_levels
                for prerequisite in construction.cache.prerequisites:
                    assert construction_priorities.index(prerequisite) < index
                break
    for index, research_id in enumerate(research_priorities):
        research = OngoingConstruction.get(research_id)
        for prerequisite in research.cache.prerequisites:
            if research_priorities.index(prerequisite) >= index:
                del research.cache._prerequisites_and_levels
                for prerequisite in research.cache.prerequisites:
                    assert research_priorities.index(prerequisite) < index
                break

    # Rule 7
    waiting_constructions: list[OngoingConstruction] = list(
        OngoingConstruction.filter(
            lambda construction: construction.player == player
            and construction.status == ConstructionStatus.WAITING
            and construction.family != "Technologies"
            and not construction.cache.prerequisites
        )
    )
    if waiting_constructions:
        count_on_going_constructions = len(
            OngoingConstruction.filter(
                lambda construction: construction.player == player
                and construction.status == ConstructionStatus.ONGOING
                and construction.family != "Technologies"
            )
        )
        if player.workers["construction"] != count_on_going_constructions:
            pytest.fail(
                "Rule 7 failed for constructions. "
                f"Player has {len(waiting_constructions)} waiting constructions "
                f"({','.join(map(lambda c: c.name, waiting_constructions))}), "
                f"but has {player.workers["construction"]} construction workers, "
                f"and only {count_on_going_constructions} ongoing constructions."
            )
    waiting_research: list[OngoingConstruction] = list(
        OngoingConstruction.filter(
            lambda construction: construction.player == player
            and construction.status == ConstructionStatus.WAITING
            and construction.family == "Technologies"
            and not construction.cache.prerequisites
        )
    )
    if waiting_research:
        count_on_going_research = len(
            OngoingConstruction.filter(
                lambda construction: construction.player == player
                and construction.status == ConstructionStatus.ONGOING
                and construction.family == "Technologies"
            )
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

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        hex_tile = HexTile.get(1)
        confirm_location(player, hex_tile)
        validate_rules(player)
        construction_A = queue_project(player=player, asset="steam_engine", force=True)
        validate_rules(player)
        assert construction_A.status == ConstructionStatus.ONGOING
        construction_B = queue_project(player=player, asset="steam_engine", force=True)
        validate_rules(player)
        assert construction_B.status == ConstructionStatus.WAITING
        decrease_project_priority(player, construction_A)
        validate_rules(player)
        assert construction_B.status == ConstructionStatus.ONGOING
        assert construction_A.status == ConstructionStatus.WAITING


def test_cancel_construction():
    """Setup:
    Player starts a construction and then cancels it. There should be no more constructions afterwards.
    """
    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        hex_tile = HexTile.get(1)
        confirm_location(player, hex_tile)
        validate_rules(player)
        construction = queue_project(player=player, asset="steam_engine", force=True)
        validate_rules(player)
        assert construction.status == ConstructionStatus.ONGOING
        cancel_project(player, construction, force=True)
        validate_rules(player)
        assert len(player.construction_priorities) == 0


def test_pause_construction():
    """Setup:
    Player starts a construction and then pauses it. It should be paused.
    Then player unpauses the construction. It should be ongoing.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        hex_tile = HexTile.get(1)
        confirm_location(player, hex_tile)
        validate_rules(player)
        construction = queue_project(player=player, asset="steam_engine", force=True)
        validate_rules(player)
        assert construction.status == ConstructionStatus.ONGOING
        toggle_pause_project(player, construction)
        validate_rules(player)
        assert construction.status == ConstructionStatus.PAUSED
        toggle_pause_project(player, construction)
        validate_rules(player)
        assert construction.status == ConstructionStatus.ONGOING


def test_queue_two_pause_one():
    """Setup:
    Player starts constructions A and B. Player then pauses A.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
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
        assert player.construction_priorities == [construction_B.id, construction_A.id]


def test_three_constructions_with_pause():
    """Setup:
    Player starts constructions A, B and C. Player then pauses C, then A.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
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
        # assert player.construction_priorities == [construction_B.id, construction_A.id, construction_C.id]


def test_add_two_and_cancel_one():
    """Setup:
    queue(1)
    queue(2)
    cancel(1)
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
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
        assert player.construction_priorities == [construction_2.id]


def test_technologies_pausing_propagates_requirements():
    """Setup:
    Player starts technology A, and then technology B, which has A as a prerequisite. Pausing A should pause B.
    Here, A is mathematics, B is mechanical_engineering.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        player.money = 1_000_000_000
        hex_tile = HexTile.get(1)
        confirm_location(player, hex_tile)
        finish_project(queue_project(player=player, asset="laboratory", force=True))

        validate_rules(player)
        technology_a = queue_project(player=player, asset="mathematics", force=True)
        validate_rules(player)
        assert technology_a.status == ConstructionStatus.ONGOING
        technology_b = queue_project(player=player, asset="mechanical_engineering", force=True)
        validate_rules(player)
        assert technology_b.status == ConstructionStatus.WAITING
        toggle_pause_project(player, technology_a)
        validate_rules(player)
        assert technology_a.status == ConstructionStatus.PAUSED
        assert technology_b.status == ConstructionStatus.PAUSED


def test_math_and_building_tech():
    """Setup:
    Player starts mathematics and building_technology in that order.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        player.money = 1_000_000_000
        hex_tile = HexTile.get(1)
        confirm_location(player, hex_tile)
        finish_project(queue_project(player=player, asset="laboratory", force=True))

        validate_rules(player)
        technology_a = queue_project(player=player, asset="mathematics", force=True)
        validate_rules(player)
        assert technology_a.status == ConstructionStatus.ONGOING
        technology_c = queue_project(player=player, asset="building_technology", force=True)
        validate_rules(player)
        assert technology_c.status == ConstructionStatus.WAITING
