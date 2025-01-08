"""Utils relating to player assets."""

import contextlib
import math
import random
from typing import TYPE_CHECKING

from energetica import technology_effects
from energetica.database.active_facility import ActiveFacility
from energetica.database.ongoing_project import OngoingProject, ProjectStatus
from energetica.database.player import Player
from energetica.enums import (
    ProjectName,
    WorkerType,
    controllable_facilities,
    extraction_facilities,
    functional_facilities,
    power_facilities,
    renewables,
    storage_facilities,
    technologies,
)
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine

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

    if project.name in technologies:
        player.technology_lvl[project.name] += 1
    if project.name in functional_facilities:
        if player.functional_facility_lvl[project.name] == 0:
            if project.name == "carbon_capture":
                player.rolling_history.add_subcategory("demand", project.name)
                player.rolling_history.add_subcategory("emissions", project.name)
                player.cumul_emissions.add_category(project.name)
                player.network_prices.add_ask(project.name)
            if project.name == "warehouse":
                for resource in ["coal", "gas", "uranium"]:
                    player.rolling_history.add_subcategory("resources", resource)
                player.network_prices.add_ask(ProjectName.TRANSPORT)
            if project.name == "laboratory":
                player.network_prices.add_ask(ProjectName.RESEARCH)

        player.functional_facility_lvl[project.name] += 1

        if project.name in technologies:
            player.progression_metrics["total_technologies"] += 1
            server_tech = engine.data["technology_lvls"][project.name]
            if len(server_tech) <= player.technology_lvl[project.name]:
                server_tech.append(0)
            server_tech[player.technology_lvl[project.name] - 1] += 1
            player.check_technology_achievement()

    elif not ActiveFacility.count_when(name=project.name, player=player):
        # initialize array for facility if it is the first one built
        if project.name in storage_facilities + power_facilities + extraction_facilities:
            player.rolling_history.add_subcategory("op_costs", project.name)
        if project.name in storage_facilities + power_facilities:
            player.rolling_history.add_subcategory("generation", project.name)
        if project.name in storage_facilities + extraction_facilities:
            player.rolling_history.add_subcategory("demand", project.name)
        if project.name in storage_facilities:
            player.rolling_history.add_subcategory("storage", project.name)
        if project.name in controllable_facilities + extraction_facilities:
            player.rolling_history.add_subcategory("emissions", project.name)
            player.cumul_emissions.add_category(project.name)
        # add facility to player's NetworkPrices
        if project.name in extraction_facilities + storage_facilities:
            player.network_prices.add_ask(project.name)
        if project.name in renewables:
            player.network_prices.renewable_bids.append(project.name)
        if project.name in storage_facilities + controllable_facilities:
            player.network_prices.add_bid(project.name)

    player.check_construction_achievements(project.name)

    project.delete()

    worker_type: WorkerType
    worker_type = WorkerType.RESEARCH if project.name in technologies else WorkerType.CONSTRUCTION
    if project not in player.get_project_priority_list(worker_type):
        pass
    player.get_project_priority_list(worker_type).remove(project)

    deploy_available_workers(player, worker_type, start_now=True)

    project_name = engine.const_config["assets"][project.name]["name"]
    if not skip_notifications:
        if project.name in technologies:
            player.notify("Technologies", f"+ 1 lvl <b>{project_name}</b>.")
            engine.log(f"{player.username} : + 1 lvl {project_name}")
        elif project.name in functional_facilities:
            player.notify("Constructions", f"+ 1 lvl <b>{project_name}</b>")
            engine.log(f"{player.username} : + 1 lvl {project_name}")
        else:
            player.notify("Constructions", f"+ 1 <b>{project_name}</b>")
            engine.log(f"{player.username} : + 1 {project_name}")
    if project.name in power_facilities + storage_facilities + extraction_facilities:
        eol = engine.data["total_t"] + math.ceil(
            engine.const_config["assets"][project.name]["lifespan"] / engine.in_game_seconds_per_tick
        )
        # TODO(mglst): using random is incompatible with the deterministic nature of the game that the action logger
        # relies on. This should be fixed. Either the position should be logged, or the random should be seeded.
        if player.tile is None:
            raise GameError("Player has no tile")
        position_x = player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1] + random.uniform(-0.5, 0.5)
        position_y = (player.tile.coordinates[1] + random.uniform(-0.5, 0.5)) * 0.5 * 3**0.5
        ActiveFacility(
            name=project.name,
            position=(position_x, position_y),
            end_of_life=eol,
            player=player,
            multipliers=project.multipliers,
        )
    if project.name in technologies:
        player.capacities.update(player, None)
    else:
        player.capacities.update(player, project.name)
    engine.config.update_config_for_user(player)
    player.emit("retrieve_player_data")
    player.emit("finish_construction", package_projects_data(player))

    if project.name in functional_facilities:
        player.invalidate_recompute_and_dispatch_data_for_pages(
            functional_facilities=True,
            technologies=project.name == "laboratory",
            extraction_facilities=project.name == "warehouse",
        )
        # Deploy any new workers from laboratory upgrades
        if project.name == "laboratory":
            deploy_available_workers(player, WorkerType.RESEARCH, start_now=True)
    if project.name in technologies:
        if project.name == "construction_technology":
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
    priority_list = player.get_project_priority_list(worker_type)

    if available_workers <= 0:
        return

    for priority_index, construction in enumerate(priority_list):
        if construction.status == ProjectStatus.PAUSED:
            # Only the player can unpause a paused construction
            return
        if construction.is_ongoing():
            continue
        construction.recompute_prerequisites_and_level()  # force recompute
        if construction.prerequisites:
            continue
        construction.set_ongoing(start_now=start_now)
        available_workers -= 1
        insertion_index = None
        for insertion_index_candidate, possibly_paused_construction in enumerate(priority_list[:priority_index]):
            if not possibly_paused_construction.is_ongoing():
                insertion_index = insertion_index_candidate
                break
        if insertion_index is not None:
            priority_list.remove(construction)
            priority_list.insert(insertion_index, construction)
        if available_workers <= 0:
            return


# Utilities relating to managing facilities and assets


def upgrade_facility(player: Player, facility: ActiveFacility) -> None:
    """Upgrade a facility."""
    if facility is None or facility.player == player:
        msg = "Construction not found"
        raise GameError(msg)

    upgrade_cost = facility.upgrade_cost
    if upgrade_cost is None:
        msg = "Facility not upgradable"
        raise GameError(msg)
    if player.money < upgrade_cost:
        msg = "Not enough money"
        raise GameError(msg)
    if facility.decommissioning:
        msg = "FacilityIsDecommissioning"
        raise GameError(msg)
    player.money -= upgrade_cost
    if facility.name in extraction_facilities:
        facility.multipliers["price_multiplier"] = technology_effects.price_multiplier(facility.player, facility.name)
        facility.multipliers["multiplier_1"] = technology_effects.multiplier_1(facility.player, facility.name)
        facility.multipliers["multiplier_2"] = technology_effects.multiplier_2(facility.player, facility.name)
        facility.multipliers["multiplier_3"] = technology_effects.multiplier_3(facility.player, facility.name)
    else:
        facility.multipliers["multiplier_1"] = technology_effects.multiplier_1(facility.player, facility.name)
        if facility.name in power_facilities + storage_facilities:
            facility.multipliers["multiplier_1"] = technology_effects.multiplier_1(facility.player, facility.name)
        if facility.name in storage_facilities:
            facility.multipliers["multiplier_2"] = technology_effects.multiplier_2(facility.player, facility.name)
        if facility.name in controllable_facilities + storage_facilities:
            facility.multipliers["multiplier_3"] = technology_effects.multiplier_3(facility.player, facility.name)
    player.capacities.update(player, facility.name)


def upgrade_all_of_type(player: Player, facility_name: str) -> None:
    """Upgrade all facilities of a certain type."""
    facilities: Iterator[ActiveFacility] = ActiveFacility.filter_by(player=player, name=facility_name)
    for facility in facilities:
        with contextlib.suppress(GameError):
            upgrade_facility(player, facility)


def remove_asset(player: Player, facility: ActiveFacility, *, decommissioning: bool = True) -> None:
    """
    Remove a facility.

    This function is executed when a facility is decommissioned.
    """
    if facility is None or facility.player != player:
        msg = "Facility not found"
        raise GameError(msg)
    if facility.name in technologies + functional_facilities:
        msg = "Cannot remove technologies or functional facilities"
        raise GameError(msg)
    if facility.name in storage_facilities and not decommissioning:
        facility.end_of_life = 0
        player.capacities.update(player, facility.name)
        return
    # The cost of decommissioning is 20% of the building cost.
    cost = facility.dismantle_cost
    player.money -= cost
    if not ActiveFacility.filter_by(name=facility.name, player=player):
        # remove facility from facility priorities if it was the last one
        if facility.name in extraction_facilities + storage_facilities:
            del player.network_prices.ask_prices[facility.name]
        if facility.name in renewables:
            player.network_prices.renewable_bids.remove(facility.name)
            del player.network_prices.bid_prices[facility.name]
        if facility.name in storage_facilities + controllable_facilities:
            del player.network_prices.bid_prices[facility.name]
    facility_name = engine.const_config["assets"][facility.name]["name"]
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
    player.capacities.update(player, facility.name)
    engine.config.update_config_for_user(player)
    facility.delete()


def facility_destroyed(player: Player, facility: ActiveFacility, event_name: str) -> None:
    """Destroyed a facility, by a climate event."""
    cost = 0.1 * facility.total_cost
    remove_asset(player, facility, decommissioning=False)
    player.notify(
        "Destruction",
        (
            f"The facility {facility.name} was destroyed by the {event_name}. The cost of the cleanup was "
            f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
        ),
    )
    engine.log(f"{player.username} : {facility.name} destroyed by {event_name}.")


def dismantle_facility(player: Player, facility: ActiveFacility) -> None:
    """Dismantle a facility."""
    if facility is None or facility.player != player:
        msg = "Facility not found"
        raise GameError(msg)
    cost = facility.dismantle_cost
    if facility.name in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.multipliers["multiplier_2"]
    if player.money < cost:
        msg = "Not enough money"
        raise GameError(msg)
    remove_asset(player, facility, decommissioning=False)
    engine.log(f"{player.username} dismantled the facility {facility.name}.")


def dismantle_all_of_type(player: Player, facility_name: str) -> None:
    """Dismantle all facilities of a certain type."""
    facilities = list(ActiveFacility.filter_by(player=player, name=facility_name))
    for facility in facilities:
        with contextlib.suppress(GameError):
            dismantle_facility(player, facility)


def package_projects_data(player: Player) -> dict:
    """Package ongoing constructions for a particular player."""
    # TODO(mglst): Rework the return dict structure (involves back + front end)
    return {
        0: player.package_constructions(),
        1: [c.id for c in player.constructions_by_priority],
        2: [r.id for r in player.researches_by_priority],
    }


def queue_project(
    player: Player,
    project_name: ProjectName,
    *,
    force: bool = False,
    ignore_requirements_and_money: bool = False,
    skip_notifications: bool = False,
) -> OngoingProject:
    """Queue a construction or research project."""

    asset_requirement_status = technology_effects.requirements_status(
        player,
        project_name,
        technology_effects.project_requirements(player, project_name),
    )
    if asset_requirement_status == "unsatisfied" and not ignore_requirements_and_money:
        msg = "Requirements not satisfied"
        raise GameError(msg)

    real_price = technology_effects.construction_price(player, project_name)
    duration = technology_effects.construction_time(player, project_name)

    if player.money < real_price and not ignore_requirements_and_money:
        msg = "notEnoughMoney"
        raise GameError(msg)

    construction_power = technology_effects.construction_power(player, project_name)
    if not force and not player.is_in_network:
        capacity = 0
        for gen in power_facilities:
            if player.capacities[gen] is not None:
                capacity += player.capacities[gen]["power"]
        if construction_power > capacity:
            raise Confirm(capacity=capacity, construction_power=construction_power)

    if not ignore_requirements_and_money:
        player.money -= real_price

    # The construction is added as paused and then immediately unpaused in order to place it in the right place in the
    # priority list.
    new_construction: OngoingProject = OngoingProject(
        name=project_name,
        end_tick_or_ticks_passed=0,
        duration=duration,
        status=ProjectStatus.PAUSED,
        project_power=construction_power,
        project_pollution=technology_effects.construction_pollution_per_tick(player, project_name),
        multipliers={
            "price_multiplier": technology_effects.price_multiplier(player, project_name),
            "multiplier_1": technology_effects.multiplier_1(player, project_name),
            "multiplier_2": technology_effects.multiplier_2(player, project_name),
            "multiplier_3": technology_effects.multiplier_3(player, project_name),
        },
        player=player,
    )
    if project_name in technologies:
        player.researches_by_priority.append(new_construction)
    else:
        player.constructions_by_priority.append(new_construction)
    try:
        toggle_pause_project(player, new_construction)
    except GameError:
        # if the new construction depends on a construction that is paused.
        pass

    if not skip_notifications:
        engine.log(f"{player.username} started the construction {project_name}")
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)

    invalidate_data_on_project_update(player, project_name)
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
    elif asset_type in functional_facilities:
        player.invalidate_recompute_and_dispatch_data_for_pages(functional_facilities=True)
    elif asset_type in technologies:
        player.invalidate_recompute_and_dispatch_data_for_pages(technologies=True)


def cancel_project(player: Player, project: OngoingProject, *, force: bool = False) -> None:
    """Cancel an ongoing project."""
    if project is None or project.player != player:
        msg = "Project not found"
        raise GameError(msg)

    dependents = []
    priority_list = player.researches_by_priority if project.name in technologies else player.constructions_by_priority
    project_priority_index = priority_list.index(project)
    for candidate_dependent in priority_list[project_priority_index + 1 :]:
        if project.id in candidate_dependent.prerequisites:
            dependents.append([candidate_dependent.name, candidate_dependent.level])
    if dependents:
        msg = "HasDependents"
        raise GameError(msg, dependents=dependents)

    if not force:
        raise Confirm(refund=f"{round(80 * (1 - project.progress()))}%")

    refund = (
        0.8
        * engine.const_config["assets"][project.name]["base_price"]
        * project.multipliers["price_multiplier"]
        * (1 - project.progress())
    )
    if project.name in ["small_water_dam", "large_water_dam", "watermill"]:
        refund *= project.multipliers["multiplier_2"]
    player.money += refund
    priority_list.remove(project)

    project.delete()

    worker_type = WorkerType.RESEARCH if project.name in technologies else WorkerType.CONSTRUCTION
    deploy_available_workers(player, worker_type)
    player.send_worker_info()

    engine.log(f"{player.username} cancelled the project {project.name}")
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)

    invalidate_data_on_project_update(player, project.name)


def decrease_project_priority(player: Player, project: OngoingProject) -> None:
    """
    Decrease the priority of an ongoing project.

    This function is executed when a player changes the order of ongoing projects.
    Note : When a project is moved in the priority list, it may be paused or unpaused.
    """
    if project is None or project.player != player:
        msg = "Project not found"
        raise GameError(msg)

    worker_type = WorkerType.RESEARCH if project.name in technologies else WorkerType.CONSTRUCTION
    priority_list = player.get_project_priority_list(worker_type)
    index = priority_list.index(project)
    if index == len(priority_list) - 1:
        return

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
        raise GameError(msg, project_1=project_1.name, project_2=project_2.name)

    if project_1.status == ProjectStatus.ONGOING and project_2.status == ProjectStatus.WAITING:
        # Case 2
        # This case can only happen when project 1 is using the last available worker. (Indeed, the other case is
        # when project 1 is a prerequisite of project 2, but in this case, the swap is not possible)
        project_1.set_waiting()
        project_2.set_ongoing()

    priority_list[index + 1], priority_list[index] = (priority_list[index], priority_list[index + 1])
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)


def toggle_pause_project(player: Player, project: OngoingProject) -> None:
    """
    Pause or unpauses an ongoing project.

    Note : When a project is paused or unpaused, it's position in the priority list has to be updated.
    """
    if project is None or project.player != player:
        msg = "Project not found"
        raise GameError(msg)

    worker_type = WorkerType.RESEARCH if project.name in technologies else WorkerType.CONSTRUCTION

    if not project.was_paused_by_player():
        # project is currently not paused by player, and should be paused
        priority_list = player.get_project_priority_list(worker_type)
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
            player.set_project_priority_list(worker_type, priority_list)

        # There is now (at least one) free worker, which must now be deployed on any WAITING projects, if possible
        worker_type = WorkerType.RESEARCH if project.name in technologies else WorkerType.CONSTRUCTION
        deploy_available_workers(player, worker_type)
        player.send_worker_info()

        engine.log(f"{player.username} paused the project {project.id} {project.name}")
    else:
        # project is currently pause, and should be unpaused
        if "_prerequisites_and_level" in project.__dict__:
            del project._prerequisites_and_level  # Needed to force recompute, as prerequisites aren't
        for prerequisite in project.prerequisites:
            if prerequisite.status == ProjectStatus.PAUSED:
                raise GameError("PausedPrerequisitePreventUnpause")

        project.unpause()
        # project status is now ONGOING or WAITING.
        # Reorder the priority list
        priority_list = player.get_project_priority_list(worker_type)
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
        engine.log(f"{player.username} unpaused the project {project.id} {project.name}")

    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_projects(player)
