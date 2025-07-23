"""Utility functions relating to player assets."""
# TODO(mglst): This file name should be renamed, e.g. to ongoing projects, constructions, the likes

import math
from typing import TYPE_CHECKING, cast

import numpy as np

from energetica import technology_effects
from energetica.database.active_facility import ActiveFacility
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    Fuel,
    FunctionalFacilityType,
    HydroFacilityType,
    PowerFacilityType,
    ProjectStatus,
    ProjectType,
    RenewableFacilityType,
    StorageFacilityType,
    TechnologyType,
    WorkerType,
    power_facility_types,
    renewable_facility_types,
)
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.schemas.projects import ProjectListOut
from energetica.utils.hashing import stable_hash

if TYPE_CHECKING:
    from collections.abc import Iterator


def finish_project(project: OngoingProject, *, skip_notifications: bool = False) -> None:
    """
    Finish a construction or research project.

    This function is executed when a construction or research project has finished. The effects include:
    * For facilities which create demands, e.g. carbon capture, adds demands to the demand priorities
    * For technologies and functional facilities, checks for achievements
    * Removes from the relevant construction / research list and priority list
    """
    player: Player = project.player

    if isinstance(project.project_type, TechnologyType):
        player.progression_metrics["total_technologies"] += 1
        server_tech = engine.technology_lvls[project.project_type]
        if len(server_tech) <= player.technology_lvl[project.project_type]:
            server_tech.append(0)
        server_tech[player.technology_lvl[project.project_type] - 1] += 1
        player.check_technology_achievement()

        player.technology_lvl[project.project_type] += 1

    elif isinstance(project.project_type, FunctionalFacilityType):
        if player.functional_facility_lvl[project.project_type] == 0:
            if project.project_type == "carbon_capture":
                player.rolling_history.add_subcategory("demand", project.project_type)
                player.rolling_history.add_subcategory("emissions", project.project_type)
                player.cumul_emissions.add_category(project.project_type)
            if project.project_type == "warehouse":
                for fuel in Fuel:
                    player.rolling_history.add_subcategory("resources", fuel.value)

        player.functional_facility_lvl[project.project_type] += 1

    elif not ActiveFacility.count_when(facility_type=project.project_type, player=player):
        # initialize array for facility if it is the first one built
        if isinstance(project.project_type, StorageFacilityType | PowerFacilityType | ExtractionFacilityType):
            player.rolling_history.add_subcategory("op_costs", project.project_type)
        if isinstance(project.project_type, StorageFacilityType | PowerFacilityType):
            player.rolling_history.add_subcategory("generation", project.project_type)
        if isinstance(project.project_type, StorageFacilityType | ExtractionFacilityType):
            player.rolling_history.add_subcategory("demand", project.project_type)
        if isinstance(project.project_type, StorageFacilityType):
            player.rolling_history.add_subcategory("storage", project.project_type)
        if isinstance(project.project_type, ControllableFacilityType | ExtractionFacilityType):
            player.rolling_history.add_subcategory("emissions", project.project_type)
            player.cumul_emissions.add_category(project.project_type)
        # add facility to player's NetworkPrices
        if project.project_type in renewable_facility_types:
            player.network_prices.renewable_bids.append(project.project_type)

    player.check_construction_achievements(project.project_type)

    project.delete()

    worker_type = project.project_type.worker_type
    if project not in player.projects_by_priority[worker_type]:
        pass
    player.projects_by_priority[worker_type].remove(project)

    deploy_available_workers(player, worker_type, start_now=True)

    project_name = engine.const_config["assets"][project.project_type]["name"]
    if not skip_notifications:
        if isinstance(project.project_type, TechnologyType):
            player.notify("Technologies", f"+ 1 lvl <b>{project_name}</b>.")
            engine.log(f"{player.username} : + 1 lvl {project_name}")
        elif isinstance(project.project_type, FunctionalFacilityType):
            player.notify("Constructions", f"+ 1 lvl <b>{project_name}</b>")
            engine.log(f"{player.username} : + 1 lvl {project_name}")
        else:
            player.notify("Constructions", f"+ 1 <b>{project_name}</b>")
            engine.log(f"{player.username} : + 1 {project_name}")
    if isinstance(project.project_type, PowerFacilityType | StorageFacilityType | ExtractionFacilityType):
        eol = engine.total_t + math.ceil(
            engine.const_config["assets"][project.project_type]["lifespan"] / engine.in_game_seconds_per_tick,
        )
        # Create a RNG, seeded with the server seed, the player's tile coordinates, the project name, and number of
        # facilities of that type the player has built. This ensures that the facility's random position is generated
        # deterministically.
        if player.tile is None:
            raise GameError("Player has no tile")
        seed_hash = stable_hash(
            (
                engine.random_seed,
                player.id,
                project.project_type,
                ActiveFacility.count_when(
                    facility_type=project.project_type,
                    player=player,
                ),  # TODO (mglst): This is not good, we should use the facility id or the "location"
            ),
        )
        rng = np.random.default_rng(abs(seed_hash))
        position_x = player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1] + rng.uniform(-0.5, 0.5)
        position_y = (player.tile.coordinates[1] + rng.uniform(-0.5, 0.5)) * 0.5 * 3**0.5
        ActiveFacility(
            facility_type=project.project_type,
            position=(position_x, position_y),
            end_of_life=eol,
            player=player,
            multipliers=project.multipliers,
        )

    if isinstance(project.project_type, TechnologyType):
        player.capacities.update(player, None)
    elif not isinstance(project.project_type, FunctionalFacilityType):
        player.capacities.update(player, project.project_type)
    engine.config.update_config_for_user(player)
    player.emit("retrieve_player_data")
    player.emit("finish_construction", ProjectListOut.from_player(player).model_dump())

    if isinstance(project.project_type, FunctionalFacilityType):
        player.invalidate_recompute_and_dispatch_data_for_pages(
            # Update power page if project is a warehouse, since all fuel-consuming power facilities require some level
            # of warehouse to be built
            power_facilities=project.project_type == FunctionalFacilityType.WAREHOUSE,
            # Always update functional facilities page, for the next level of this newly built facility
            functional_facilities=True,
            # Update the technologies page if the project is a laboratory
            technologies=project.project_type == FunctionalFacilityType.LABORATORY,
            # Update the extraction facilities page if project is a warehouse
            extraction_facilities=project.project_type == FunctionalFacilityType.WAREHOUSE,
        )
        # Deploy any new workers from laboratory upgrades
        if project.project_type == FunctionalFacilityType.LABORATORY:
            deploy_available_workers(player, WorkerType.RESEARCH, start_now=True)
    if isinstance(project.project_type, TechnologyType):
        if project.project_type == TechnologyType.BUILDING_TECHNOLOGY:
            deploy_available_workers(player, WorkerType.CONSTRUCTION, start_now=True)
        player.invalidate_recompute_and_dispatch_data_for_pages(
            power_facilities=True,
            storage_facilities=True,
            extraction_facilities=True,
            functional_facilities=True,
            technologies=True,
        )
        other_players: Iterator[Player] = Player.filter(lambda other_player: other_player != player)
        for other_player in other_players:
            other_player.invalidate_recompute_and_dispatch_data_for_pages(technologies=True)

    player.send_worker_info()


def deploy_available_workers(player: Player, worker_type: WorkerType, *, start_now: bool = False) -> None:
    """
    Ensure all free workers for of type `worker_type` are in use, if possible.

    Workers are deployed only on projects that are waiting - paused projects are never unpaused, except by the player.
    The list of ongoing projects may be reordered to satisfy the priority list invariants.
    start_now: If True, this action is considered to take place at the start of this ongoing tick rather than waiting
    until the start of the next tick. This is used when a construction is finished and the worker starts a new one and
    when a new worker is available and starts a new construction.
    """
    available_workers = player.available_workers(worker_type)
    priority_list = player.projects_by_priority[worker_type]

    if available_workers <= 0:
        return

    for priority_index, construction in enumerate(priority_list):
        if construction.status == ProjectStatus.PAUSED:
            # Only the player can unpause a paused construction
            return
        if construction.is_ongoing:
            continue
        construction.recompute_prerequisites_and_level()  # force recompute
        if construction.prerequisites:
            continue
        construction.set_ongoing(start_now=start_now)
        available_workers -= 1
        insertion_index = None
        for insertion_index_candidate, possibly_paused_construction in enumerate(priority_list[:priority_index]):
            if not possibly_paused_construction.is_ongoing:
                insertion_index = insertion_index_candidate
                break
        if insertion_index is not None:
            priority_list.remove(construction)
            priority_list.insert(insertion_index, construction)
        if available_workers <= 0:
            return


# Utilities relating to managing facilities and assets


def upgrade_facility(facility: ActiveFacility) -> None:
    """Upgrade a facility."""
    upgrade_cost = facility.upgrade_cost
    if upgrade_cost is None:
        msg = "Facility not upgradable"
        raise GameError(msg)
    if facility.player.money < upgrade_cost:
        msg = "Not enough money"
        raise GameError(msg)
    if facility.decommissioning:
        msg = "FacilityIsDecommissioning"
        raise GameError(msg)
    facility.player.money -= upgrade_cost
    facility.multipliers = technology_effects.current_multipliers(facility.player, facility.facility_type)
    facility.player.capacities.update(facility.player, facility.facility_type)


def upgrade_all_of_type(
    player: Player,
    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
) -> None:
    """Upgrade all facilities of a certain type."""
    facilities = list(
        ActiveFacility.filter(
            lambda facility: facility.player == player
            and facility.facility_type == facility_type
            and facility.upgrade_cost is not None
            and not facility.decommissioning,
        ),
    )
    if player.money < sum(map(lambda facility: cast(float, facility.upgrade_cost), facilities)):
        msg = "Not enough money"
        raise GameError(msg)
    for facility in facilities:
        upgrade_facility(facility)


def remove_asset(player: Player, facility: ActiveFacility, *, decommissioning: bool = True) -> None:
    """
    Remove a facility.

    This function is executed when a facility is decommissioned.
    """
    if facility is None or facility.player != player:
        msg = "Facility not found"
        raise GameError(msg)
    if isinstance(facility.facility_type, TechnologyType | FunctionalFacilityType):
        msg = "Cannot remove technologies or functional facilities"
        raise GameError(msg)
    if isinstance(facility.facility_type, StorageFacilityType) and not decommissioning:
        facility.end_of_life = 0
        player.capacities.update(player, facility.facility_type)
        return
    # The cost of decommissioning is 20% of the building cost.
    cost = facility.dismantle_cost
    player.money -= cost
    if not ActiveFacility.filter_by(facility_type=facility.facility_type, player=player):
        # remove facility from facility priorities if it was the last one
        if isinstance(facility.facility_type, RenewableFacilityType):
            player.network_prices.renewable_bids.remove(facility.facility_type)
    facility_name = engine.const_config["assets"][facility.facility_type]["name"]
    if decommissioning:
        player.notify(
            "Decommissioning",
            (
                f"The facility {facility_name} reached the end of its operational lifespan and had to be "
                "decommissioned. The cost of this operation was "
                f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
            ),
        )
        engine.log(f"The facility {facility_name} from {player.username} has been decommissioned.")
    player.capacities.update(player, facility.facility_type)
    engine.config.update_config_for_user(player)
    facility.delete()


def facility_destroyed(player: Player, facility: ActiveFacility, event_name: str) -> None:
    """Destroyed a facility, by a climate event."""
    cost = 0.1 * facility.total_cost
    remove_asset(player, facility, decommissioning=False)
    player.notify(
        "Destruction",
        (
            f"The facility {facility.facility_type} was destroyed by the {event_name}. The cost of the cleanup was "
            f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
        ),
    )
    engine.log(f"{player.username} : {facility.facility_type} destroyed by {event_name}.")


def dismantle_facility(facility: ActiveFacility) -> None:
    """Dismantle a facility."""
    player = facility.player
    cost = facility.dismantle_cost
    if player.money < cost:
        msg = "Not enough money"
        raise GameError(msg)
    remove_asset(player, facility, decommissioning=False)
    engine.log(f"{player.username} dismantled the facility {facility.facility_type}.")


def dismantle_all_of_type(
    player: Player,
    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
) -> None:
    """Dismantle all facilities of a certain type."""
    facilities = list(
        ActiveFacility.filter(
            lambda facility: facility.player == player
            and facility.facility_type == facility_type
            and not facility.decommissioning,
        ),
    )
    if player.money < sum(map(lambda facility: cast(float, facility.dismantle_cost), facilities)):
        msg = "Not enough money"
        raise GameError(msg)
    for facility in facilities:
        dismantle_facility(facility)


def queue_project(
    player: Player,
    project_type: ProjectType,
    *,
    force: bool = False,
    ignore_requirements_and_money: bool = False,
    skip_notifications: bool = False,
) -> OngoingProject:
    """Queue a construction or research project."""
    asset_requirement_status = technology_effects.requirements_status(
        player,
        project_type,
        technology_effects.project_requirements(player, project_type),
    )
    if asset_requirement_status == "unsatisfied" and not ignore_requirements_and_money:
        msg = "Requirements not satisfied"
        raise GameError(msg)

    real_price = technology_effects.construction_price(player, project_type)
    duration = technology_effects.construction_time(player, project_type)

    if player.money < real_price and not ignore_requirements_and_money:
        msg = "Not enough money"
        raise GameError(msg)

    construction_power = technology_effects.construction_power(player, project_type)
    if not force and not player.is_in_network:
        capacity = 0
        for gen in power_facility_types:
            if gen in player.capacities:
                capacity += player.capacities[gen]["power"]
        if construction_power > capacity:
            raise Confirm(type="areYouSure", capacity=capacity, construction_power=construction_power)

    if not ignore_requirements_and_money:
        player.money -= real_price

    # The construction is added as paused and then immediately unpaused in order to place it in the right place in the
    # priority list.
    new_construction: OngoingProject = OngoingProject(
        project_type=project_type,
        duration=duration,
        project_power=construction_power,
        project_pollution=technology_effects.construction_pollution_per_tick(player, project_type),
        player=player,
    )
    player.projects_by_priority[project_type.worker_type].append(new_construction)
    try:
        resume_project(player, new_construction)
    except GameError:
        # if the new construction depends on a construction that is paused.
        pass

    if not skip_notifications:
        engine.log(f"{player.username} started the construction {project_type}")

    invalidate_data_on_project_update(player, project_type)
    player.send_worker_info()
    return new_construction


def invalidate_data_on_project_update(player: Player, asset_type: str) -> None:
    """Check for data page invalidation when project has been queued or cancelled."""
    if asset_type in {
        "watermill",
        "small_water_dam",
        "large_water_dam",
        "windmill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
    }:
        player.invalidate_recompute_and_dispatch_data_for_pages(power_facilities=True)
    elif isinstance(asset_type, FunctionalFacilityType):
        player.invalidate_recompute_and_dispatch_data_for_pages(functional_facilities=True)
    elif isinstance(asset_type, TechnologyType):
        player.invalidate_recompute_and_dispatch_data_for_pages(technologies=True)


def cancel_project(player: Player, project: OngoingProject, *, force: bool = False) -> None:
    """Cancel an ongoing project."""
    if project is None or project.player != player:
        msg = "Project not found"
        raise GameError(msg)

    dependents = []
    priority_list = player.projects_by_priority[project.project_type.worker_type]
    project_priority_index = priority_list.index(project)
    for candidate_dependent in priority_list[project_priority_index + 1 :]:
        if project in candidate_dependent.prerequisites:
            dependents.append([candidate_dependent.project_type, candidate_dependent.level])
    if dependents:
        msg = "HasDependents"
        raise GameError(msg, dependents=dependents)

    if not force:
        raise Confirm(type="areYouSure", refund=f"{round(80 * (1 - project.progress()))}%")

    refund = (
        0.8
        * engine.const_config["assets"][project.project_type]["base_price"]
        * project.multipliers["price_multiplier"]
        * (1 - project.progress())
    )
    if isinstance(project.project_type, HydroFacilityType):
        refund *= project.multipliers["hydro_price_multiplier"]
    player.money += refund
    priority_list.remove(project)

    project.delete()

    deploy_available_workers(player, project.project_type.worker_type)
    player.send_worker_info()

    engine.log(f"{player.username} cancelled the project {project.project_type}")

    invalidate_data_on_project_update(player, project.project_type)


def decrease_project_priority(player: Player, project: OngoingProject) -> None:
    """
    Decrease the priority of an ongoing project.

    This function is executed when a player changes the order of ongoing projects.
    Note : When a project is moved in the priority list, it may be paused or unpaused.
    """
    priority_list = player.projects_by_priority[project.project_type.worker_type]
    index = priority_list.index(project)
    if index == len(priority_list) - 1:
        raise GameError("CannotDecreasePriorityOfLastProject")

    project_1: OngoingProject = project
    project_2: OngoingProject = priority_list[index + 1]

    # Here are all the possible cases for the two projects, project_1 and project_2:
    # 1. ongoing, ongoing (swap)
    # 2. ongoing, waiting (swap, modify status)
    # 3. ongoing, paused  DISALLOWED
    # 4. waiting, waiting (swap)
    # 5. waiting, paused  DISALLOWED
    # 6. paused , paused  (swap)

    if project_1 in project_2.prerequisites:
        raise GameError("requirementsPreventReorder")
    if not project_1.was_paused_by_player() and project_2.was_paused_by_player():
        msg = "CannotSwapPausedProject"
        raise GameError(msg, first_project_type=project_1.project_type, second_project_type=project_2.project_type)

    if project_1.status == ProjectStatus.ONGOING and project_2.status == ProjectStatus.WAITING:
        # Case 2
        # This case can only happen when project 1 is using the last available worker. (Indeed, the other case is
        # when project 1 is a prerequisite of project 2, but in this case, the swap is not possible)
        project_1.set_waiting()
        project_2.set_ongoing()

    priority_list[index + 1], priority_list[index] = (priority_list[index], priority_list[index + 1])


def increase_project_priority(player: Player, project: OngoingProject) -> None:
    """
    Increase the priority of an ongoing project.

    This function is executed when a player changes the order of ongoing projects.
    Note : When a project is moved in the priority list, it may be paused or unpaused.
    """
    priority_list = player.projects_by_priority[project.project_type.worker_type]
    index = priority_list.index(project)
    if index == 0:
        raise GameError("CannotIncreasePriorityOfFirstProject")
    # Here, to increase the priority of this project, we decrease the priority of the project just above it
    decrease_project_priority(player, priority_list[index - 1])


def pause_project(player: Player, project: OngoingProject) -> None:
    """Pause an ongoing project, changing its position in the priority list."""
    if project is None or project.player != player:
        msg = "Project not found"
        raise GameError(msg)

    worker_type = project.project_type.worker_type

    if project.was_paused_by_player():
        raise GameError("cannotPause")

    priority_list = player.projects_by_priority[worker_type]
    project_index = priority_list.index(project)
    project.pause()
    dependency = [project]
    dependency_indices = [project_index]
    insertion_index: int | None = len(priority_list)
    for index, other_project in enumerate(priority_list[project_index + 1 :]):
        other_project_index = index + project_index + 1
        if other_project.was_paused_by_player():
            insertion_index = other_project_index
            break
        for prerequisite in other_project.prerequisites:
            if prerequisite in dependency:
                other_project.pause()
                dependency.append(other_project)
                dependency_indices.append(other_project_index)
                break
    # Remove all dependent projects from the priority list, and reinsert them at the right place
    if insertion_index is None:
        # If insertion_index is None, then there are no preexisting paused projects
        for dependent in dependency:
            priority_list.remove(dependent)
        for dependent in dependency:
            priority_list.append(dependent)
    else:
        # If insertion_index is not None, then there are preexisting paused projects
        priority_list = [
            *[id for id in priority_list[:insertion_index] if id not in dependency],
            *dependency,
            *priority_list[insertion_index:],
        ]
        player.projects_by_priority[worker_type] = priority_list

    # There is now (at least one) free worker, which must now be deployed on any WAITING projects, if possible
    deploy_available_workers(player, worker_type)
    player.send_worker_info()

    engine.log(f"{player.username} paused the project {project.id} {project.project_type}")


def resume_project(player: Player, project: OngoingProject) -> None:
    """Resume an ongoing project, changing its position in the priority list."""
    if project is None or project.player != player:
        msg = "Project not found"
        raise GameError(msg)

    worker_type = project.project_type.worker_type

    if not project.was_paused_by_player():
        raise GameError("cannotResume")

    # project is currently pause, and should be unpaused
    if "_prerequisites_and_level" in project.__dict__:
        del project._prerequisites_and_level  # Needed to force recompute, as prerequisites aren't
    for prerequisite in project.prerequisites:
        if prerequisite.status == ProjectStatus.PAUSED:
            raise GameError("PausedPrerequisitePreventUnpause")

    project.unpause()
    # project status is now ONGOING or WAITING.
    # Reorder the priority list
    priority_list = player.projects_by_priority[worker_type]
    priority_list.remove(project)
    insertion_index = None
    for new_index, other_project in enumerate(priority_list):
        if other_project.status < project.status:
            insertion_index = new_index
            break
    if insertion_index is not None:
        priority_list.insert(insertion_index, project)
    else:
        priority_list.append(project)
    engine.log(f"{player.username} unpaused the project {project.id} {project.project_type}")


def toggle_pause_project(player: Player, project: OngoingProject) -> None:
    """Pause or unpauses an ongoing project, changing its position in the priority list."""
    # TODO(mglst): this function is now used only in tests. I suggest that these calls to toggle in the tests should be
    # replaced with calls to pause and resume - the two functions above which have now replaced this one - and that this
    # function should be deprecated.
    if not project.was_paused_by_player():
        pause_project(player, project)
    else:
        resume_project(player, project)
