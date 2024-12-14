import os
import sys

sys.path.append(os.getcwd())
from werkzeug.security import generate_password_hash

from energetica import create_app
from energetica.database import db
from energetica.database.map import Hex
from energetica.database.ongoing_construction import ConstructionStatus, OngoingConstruction
from energetica.database.player import Player
from energetica.utils.assets import cancel_project, decrease_project_priority, queue_project, toggle_pause_project
from energetica.utils.misc import confirm_location

# RULES FOR CONSTRUCTIONS:
# 1. All projects (in the database) should appear exactly once in the priority list.
# 2. The number of ongoing constructions / research projects must be less then or equal to the number of construction / lab workers.
# 3. In the project priority list, ongoing projects must come before all waiting projects and all waiting projects must come before all paused projects.
# 4. All projects have a finish time in the future.
# 5. A project can not be ongoing if it has unfulfilled requirements.
# 6. All requirements of a project must appear before the project in the priority list.
# 7. If there are projects waiting that have all their requirements fulfilled, there should be no available workers of the corresponding type.


def validate_rules(engine, player):
    """This function validates all of the above rules."""
    # Rule 1
    construction_priorities = player.read_list("construction_priorities")
    research_priorities = player.read_list("research_priorities")
    assert len(set(construction_priorities)) == len(construction_priorities)
    assert len(set(research_priorities)) == len(research_priorities)
    for construction_id in construction_priorities:
        construction = OngoingConstruction.query.get(construction_id)
        assert construction is not None
        assert construction.player_id == player.id
        assert construction.family != "Technologies"
    for research_id in research_priorities:
        research = OngoingConstruction.query.get(research_id)
        assert research is not None
        assert research.player_id == player.id
        assert research.family == "Technologies"
    assert OngoingConstruction.query.filter(
        OngoingConstruction.player_id == player.id,
        OngoingConstruction.family != "Technologies",
    ).count() == len(construction_priorities)
    assert OngoingConstruction.query.filter_by(
        player_id=player.id,
        family="Technologies",
    ).count() == len(research_priorities)

    # Rule 2
    assert (
        OngoingConstruction.query.filter(
            OngoingConstruction.player_id == player.id,
            OngoingConstruction.status == ConstructionStatus.ONGOING,
            OngoingConstruction.family != "Technologies",
        ).count()
        <= player.construction_workers
    )
    assert (
        OngoingConstruction.query.filter_by(
            player_id=player.id,
            status=ConstructionStatus.ONGOING,
            family="Technologies",
        ).count()
        <= player.lab_workers
    )

    # Rule 3
    status_list_constructions = list(map(lambda x: OngoingConstruction.query.get(x).status, construction_priorities))
    assert sorted(status_list_constructions, reverse=True) == status_list_constructions
    status_list_research = list(map(lambda x: OngoingConstruction.query.get(x).status, research_priorities))
    assert sorted(status_list_research, reverse=True) == status_list_research

    # Rule 4
    assert (
        OngoingConstruction.query.filter(
            OngoingConstruction.player_id == player.id,
            OngoingConstruction.status == ConstructionStatus.ONGOING,
            OngoingConstruction.end_tick_or_ticks_passed <= engine.data["total_t"],
        ).count()
        == 0
    )
    assert (
        OngoingConstruction.query.filter(
            OngoingConstruction.player_id == player.id,
            OngoingConstruction.status != ConstructionStatus.ONGOING,
            OngoingConstruction.end_tick_or_ticks_passed > OngoingConstruction.duration,
        ).count()
        == 0
    )

    # Rule 5
    ongoing_projects: list[OngoingConstruction] = OngoingConstruction.query.filter_by(
        player_id=player.id,
        status=ConstructionStatus.ONGOING,
    ).all()
    for project in ongoing_projects:
        prerequisites = project.cache.prerequisites
        if prerequisites:
            del project.cache._prerequisites_and_levels
            assert not project.cache.prerequisites

    # Rule 6
    for index, construction_id in enumerate(construction_priorities):
        construction = OngoingConstruction.query.get(construction_id)
        for prerequisite in construction.cache.prerequisites:
            if construction_priorities.index(prerequisite) >= index:
                del construction.cache._prerequisites_and_levels
                for prerequisite in construction.cache.prerequisites:
                    assert construction_priorities.index(prerequisite) < index
                break
    for index, research_id in enumerate(research_priorities):
        research = OngoingConstruction.query.get(research_id)
        for prerequisite in research.cache.prerequisites:
            if research_priorities.index(prerequisite) >= index:
                del research.cache._prerequisites_and_levels
                for prerequisite in research.cache.prerequisites:
                    assert research_priorities.index(prerequisite) < index
                break

    # Rule 7
    waiting_constructions: list[OngoingConstruction] = OngoingConstruction.query.filter(
        OngoingConstruction.player_id == player.id,
        OngoingConstruction.status == ConstructionStatus.WAITING,
        OngoingConstruction.family != "Technologies",
    ).all()
    if any(not project.cache.prerequisites for project in waiting_constructions):
        assert (
            player.construction_workers
            == OngoingConstruction.query.filter(
                OngoingConstruction.player_id == player.id,
                OngoingConstruction.status == ConstructionStatus.ONGOING,
            ).count()
        )
    waiting_research: list[OngoingConstruction] = OngoingConstruction.query.filter(
        OngoingConstruction.player_id == player.id,
        OngoingConstruction.status == ConstructionStatus.WAITING,
        OngoingConstruction.family == "Technologies",
    ).all()
    if any(not project.cache.prerequisites for project in waiting_research):
        assert (
            player.lab_workers
            == OngoingConstruction.query.filter(
                OngoingConstruction.player_id == player.id,
                OngoingConstruction.status == ConstructionStatus.ONGOING,
            ).count()
        )


def test_swap_paused_and_unpaused_constructions():
    """Setup:
    Player has one construction worker, constructions A and B are launched, A is ongoing, B is waiting.
    After decreasing the priority of the construction A, construction B should be ongoing, and A waiting.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    engine = app.config["engine"]
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        db.session.add(player)
        db.session.commit()
        hex_tile = db.session.get(Hex, 1)
        confirm_location(engine, player, hex_tile)
        db.session.commit()
        validate_rules(engine, player)
        construction_A = queue_project(engine=engine, player=player, asset="steam_engine", force=True)
        validate_rules(engine, player)
        assert construction_A.status == ConstructionStatus.ONGOING
        construction_B = queue_project(engine=engine, player=player, asset="steam_engine", force=True)
        validate_rules(engine, player)
        assert construction_B.status == ConstructionStatus.WAITING
        decrease_project_priority(player, construction_A)
        validate_rules(engine, player)
        assert construction_B.status == ConstructionStatus.ONGOING
        assert construction_A.status == ConstructionStatus.WAITING


def test_cancel_construction():
    """Setup:
    Player starts a construction and then cancels it. There should be no more constructions afterwards.
    """
    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    engine = app.config["engine"]
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        db.session.add(player)
        db.session.commit()
        hex_tile = db.session.get(Hex, 1)
        confirm_location(engine, player, hex_tile)
        db.session.commit()
        validate_rules(engine, player)
        construction = queue_project(engine=engine, player=player, asset="steam_engine", force=True)
        validate_rules(engine, player)
        assert construction.status == ConstructionStatus.ONGOING
        cancel_project(player, construction, force=True)
        validate_rules(engine, player)
        assert len(player.read_list("construction_priorities")) == 0


def test_pause_construction():
    """Setup:
    Player starts a construction and then pauses it. It should be paused.
    Then player unpauses the construction. It should be ongoing.
    """

    _, app = create_app(rm_instance=True, skip_adding_handlers=True)
    engine = app.config["engine"]
    with app.app_context():
        player = Player(username="username", pwhash=generate_password_hash("password"))
        db.session.add(player)
        db.session.commit()
        hex_tile = db.session.get(Hex, 1)
        confirm_location(engine, player, hex_tile)
        db.session.commit()
        validate_rules(engine, player)
        construction = queue_project(engine=engine, player=player, asset="steam_engine", force=True)
        validate_rules(engine, player)
        assert construction.status == ConstructionStatus.ONGOING
        toggle_pause_project(player, construction)
        validate_rules(engine, player)
        assert construction.status == ConstructionStatus.PAUSED
        toggle_pause_project(player, construction)
        validate_rules(engine, player)
        assert construction.status == ConstructionStatus.ONGOING


# /def test_misc
