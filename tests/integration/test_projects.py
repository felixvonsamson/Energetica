"""This module contains tests for all methods that manage construction and research projects."""

from typing import Iterable

import pytest

from energetica import create_app
from energetica.database.map.hex_tile import HexTile
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.database.user import User
from energetica.enums import ControllableFacilityType, FunctionalFacilityType, ProjectStatus, TechnologyType, WorkerType
from energetica.globals import engine
from energetica.utils.assets import (
    cancel_project,
    decrease_project_priority,
    finish_project,
    queue_project,
    toggle_pause_project,
)
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location


def validate_rules(player: Player) -> None:
    """This function validates all of the above rules."""
    validate_rule_1(player)
    validate_rule_2(player)
    validate_rule_3(player)
    validate_rule_4(player)
    validate_rule_5(player)
    validate_rule_6(player)
    validate_rule_7(player)


def validate_rule_1(player: Player) -> None:
    """All projects (in the database) should appear exactly once in the priority list."""
    for worker_type in WorkerType:
        projects_by_priority = player.projects_by_priority[worker_type]
        assert len({project.id for project in projects_by_priority}) == len(projects_by_priority)
        for project in projects_by_priority:
            assert project is not None
            assert project.player == player
            if worker_type == WorkerType.CONSTRUCTION:
                assert not isinstance(project.project_type, TechnologyType)
            else:
                assert isinstance(project.project_type, TechnologyType)
        assert OngoingProject.count_when(player=player, worker_type=worker_type) == len(projects_by_priority)


def validate_rule_2(player: Player) -> None:
    """The number of ongoing projects must be less then or equal to the number of workers."""
    for worker_type in WorkerType:
        ongoing_projects = list(
            OngoingProject.filter_by(player=player, status=ProjectStatus.ONGOING, worker_type=worker_type),
        )
        if len(ongoing_projects) > player.workers[worker_type]:
            pytest.fail(
                f"Rule 2 violation: there are {len(ongoing_projects)} ongoing projects of type {worker_type} "
                f"({','.join(map(lambda c: c.project_type, ongoing_projects))}), "
                f"but only {player.workers[worker_type]} {worker_type} workers.",
            )


def validate_rule_3(player: Player) -> None:
    """
    In the project priority list, ongoing projects must come before all waiting projects and all waiting projects
    must come before all paused projects.
    """
    for worker_type in WorkerType:
        status_list = list(map(lambda x: x.status, player.projects_by_priority[worker_type]))
        assert sorted(status_list, reverse=True) == status_list


def validate_rule_4(player: Player) -> None:
    """All projects have a finish time in the future."""
    assert not OngoingProject.count(
        condition=lambda project: project.player == player
        and project.status == ProjectStatus.ONGOING
        and project.end_tick_or_ticks_passed <= engine.total_t,
    )


def validate_rule_5(player: Player) -> None:
    """A project can not be ongoing if it has unfulfilled requirements."""
    ongoing_projects: Iterable[OngoingProject] = OngoingProject.filter_by(
        player=player,
        status=ProjectStatus.ONGOING,
    )
    for project in ongoing_projects:
        if project.prerequisites:
            del project._prerequisites_and_level
            assert not project.prerequisites


def validate_rule_6(player: Player) -> None:
    """All requirements of a project must appear before the project in the priority list."""
    for worker_type in WorkerType:
        for index, project in enumerate(player.projects_by_priority[worker_type]):
            for prerequisite in project.prerequisites:
                if player.projects_by_priority[worker_type].index(prerequisite) >= index:
                    del project._prerequisites_and_level
                    for prerequisite in project.prerequisites:
                        assert player.projects_by_priority[worker_type].index(prerequisite) < index
                    break


def validate_rule_7(player: Player) -> None:
    """If there are projects waiting with all their requirements fulfilled, there should be no available workers."""
    for worker_type in WorkerType:
        waiting_projects = list(
            OngoingProject.filter(
                lambda project: project.player == player
                and project.status == ProjectStatus.WAITING
                and project.worker_type == worker_type
                and not project.prerequisites,
            ),
        )
        if waiting_projects:
            count_on_going_projects = OngoingProject.count(
                condition=lambda project: project.player == player
                and project.status == ProjectStatus.ONGOING
                and project.worker_type == worker_type,
            )
            if player.workers[worker_type] != count_on_going_projects:
                pytest.fail(
                    f"Rule 7 failed for {worker_type}. "
                    f"Player has {len(waiting_projects)} waiting projects "
                    f"({','.join(map(lambda c: c.project_type, waiting_projects))}), "
                    f"but has {player.workers[worker_type]} {worker_type} workers, "
                    f"and only {count_on_going_projects} ongoing projects.",
                )


def test_swap_paused_and_unpaused_constructions() -> None:
    """
    Setup:
    Player has one construction worker, constructions A and B are launched, A is ongoing, B is waiting.
    After decreasing the priority of the construction A, construction B should be ongoing, and A waiting.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    validate_rules(player)
    construction_a = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    assert construction_a.status == ProjectStatus.ONGOING
    construction_b = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    assert construction_b.status == ProjectStatus.WAITING
    decrease_project_priority(player, construction_a)
    validate_rules(player)
    assert construction_b.status == ProjectStatus.ONGOING
    assert construction_a.status == ProjectStatus.WAITING


def test_cancel_construction() -> None:
    """
    Setup:
    Player starts a construction and then cancels it. There should be no more constructions afterwards.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    validate_rules(player)
    construction = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    assert construction.status == ProjectStatus.ONGOING
    cancel_project(player, construction, force=True)
    validate_rules(player)
    assert len(player.constructions_by_priority) == 0


def test_pause_construction() -> None:
    """
    Setup:
    Player starts a construction and then pauses it. It should be paused.
    Then player unpauses the construction. It should be ongoing.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    validate_rules(player)
    construction = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    assert construction.status == ProjectStatus.ONGOING
    toggle_pause_project(player, construction)
    validate_rules(player)
    assert construction.status == ProjectStatus.PAUSED
    toggle_pause_project(player, construction)
    validate_rules(player)
    assert construction.status == ProjectStatus.ONGOING


def test_queue_two_pause_one() -> None:
    """
    Setup:
    Player starts constructions A and B. Player then pauses A.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    validate_rules(player)
    construction_a = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    construction_b = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    toggle_pause_project(player, construction_a)
    validate_rules(player)
    assert player.constructions_by_priority == [construction_b, construction_a]


def test_three_constructions_with_pause() -> None:
    """
    Setup:
    Player starts constructions A, B and C. Player then pauses C, then A.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    player.money = 1_000_000_000
    validate_rules(player)
    construction_a = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    construction_c = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    toggle_pause_project(player, construction_c)
    validate_rules(player)
    toggle_pause_project(player, construction_a)
    validate_rules(player)
    # assert player.constructions_by_priority == [construction_B, construction_A, construction_C]


def test_add_two_and_cancel_one() -> None:
    """Setup: queue(1), queue(2), cancel(1)."""
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    player.money = 1_000_000_000
    validate_rules(player)
    construction_1 = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    construction_2 = queue_project(player=player, project_type=ControllableFacilityType.STEAM_ENGINE, force=True)
    validate_rules(player)
    cancel_project(player, construction_1, force=True)
    validate_rules(player)
    assert player.constructions_by_priority == [construction_2]


def test_technologies_pausing_propagates_requirements() -> None:
    """
    Setup:
    Player starts technology A, and then technology B, which has A as a prerequisite. Pausing A should pause B.
    Here, A is mathematics, B is mechanical_engineering.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    player.money = 1_000_000_000
    finish_project(queue_project(player=player, project_type=FunctionalFacilityType.LABORATORY, force=True))

    validate_rules(player)
    technology_a = queue_project(player=player, project_type=TechnologyType.MATHEMATICS, force=True)
    validate_rules(player)
    assert technology_a.status == ProjectStatus.ONGOING
    technology_b = queue_project(player=player, project_type=TechnologyType.MECHANICAL_ENGINEERING, force=True)
    validate_rules(player)
    assert technology_b.status == ProjectStatus.WAITING
    toggle_pause_project(player, technology_a)
    validate_rules(player)
    assert technology_a.status == ProjectStatus.PAUSED
    assert technology_b.status == ProjectStatus.PAUSED


def test_math_and_building_tech() -> None:
    """
    Setup:
    Player starts mathematics and building_technology in that order.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")

    user = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player = confirm_location(user, hex_tile)
    player.money = 1_000_000_000
    finish_project(queue_project(player=player, project_type=FunctionalFacilityType.LABORATORY, force=True))

    validate_rules(player)
    technology_a = queue_project(player=player, project_type=TechnologyType.MATHEMATICS, force=True)
    validate_rules(player)
    assert technology_a.status == ProjectStatus.ONGOING
    technology_c = queue_project(player=player, project_type=TechnologyType.MECHANICAL_ENGINEERING, force=True)
    validate_rules(player)
    assert technology_c.status == ProjectStatus.WAITING
