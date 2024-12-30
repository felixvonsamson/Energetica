"""Utils relating to player assets."""

import contextlib
import math
import random
from typing import Iterator

from energetica import technology_effects
from energetica.config.assets import WorkerType
from energetica.database.active_facility import ActiveFacility
from energetica.database.ongoing_construction import ConstructionStatus, OngoingProject
from energetica.database.player import Player
from energetica.game_engine import Confirm
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.network_helpers import reorder_facility_priorities


def finish_project(construction: OngoingProject, *, skip_notifications: bool = False) -> None:
    """Finish a construction or research project.

    This function is executed when a construction or research project has finished. The effects include:
    * For facilities which create demands, e.g. carbon capture, adds demands to the demand priorities
    * For technologies and functional facilities, checks for achievements
    * Removes from the relevant construction / research list and priority list
    """
    player: Player = construction.player

    if construction.family in ["Technologies", "Functional Facilities"]:
        if getattr(player, construction.name) == 0:
            if construction.name == "carbon_capture":
                player.rolling_history.add_subcategory("demand", construction.name)
                player.rolling_history.add_subcategory("emissions", construction.name)
                player.cumul_emissions.add_category(construction.name)
                player.priorities_of_demand.append(construction.name)
                reorder_facility_priorities(player)
            if construction.name == "warehouse":
                for resource in ["coal", "gas", "uranium"]:
                    player.rolling_history.add_subcategory("resources", resource)
            if construction.name == "laboratory":
                player.priorities_of_demand.append("research")
                reorder_facility_priorities(player)
            if construction.name == "warehouse":
                player.priorities_of_demand.append("transport")
                reorder_facility_priorities(player)

        setattr(player, construction.name, getattr(player, construction.name) + 1)

        if construction.family == "Technologies":
            player.progression_metrics["total_technologies"] += 1
            server_tech = engine.data["technology_lvls"][construction.name]
            if len(server_tech) <= getattr(player, construction.name):
                server_tech.append(0)
            server_tech[getattr(player, construction.name) - 1] += 1
            player.check_technology_achievement()

    elif not ActiveFacility.filter_by(facility=construction.name, player_id=player.id):
        # initialize array for facility if it is the first one built
        if construction.name in engine.storage_facilities + engine.power_facilities + engine.extraction_facilities:
            player.rolling_history.add_subcategory("op_costs", construction.name)
        if construction.name in engine.storage_facilities + engine.power_facilities:
            player.rolling_history.add_subcategory("generation", construction.name)
        if construction.name in engine.storage_facilities + engine.extraction_facilities:
            player.rolling_history.add_subcategory("demand", construction.name)
        if construction.name in engine.storage_facilities:
            player.rolling_history.add_subcategory("storage", construction.name)
        if construction.name in engine.controllable_facilities + engine.extraction_facilities:
            player.rolling_history.add_subcategory("emissions", construction.name)
            player.cumul_emissions.add_category(construction.name)
        if construction.name in engine.extraction_facilities + engine.storage_facilities:
            player.priorities_of_demand.append(construction.name)
            reorder_facility_priorities(player)
        if construction.name in engine.renewables:
            player.list_of_renewables.append(construction.name)
            reorder_facility_priorities(player)
        if construction.name in engine.storage_facilities + engine.controllable_facilities:
            player.priorities_of_controllables.append(construction.name)
            reorder_facility_priorities(player)

    player.check_construction_achievements(construction.name)

    worker_type: WorkerType
    if construction.family == "Technologies":
        worker_type = WorkerType.RESEARCH
    else:
        worker_type = WorkerType.CONSTRUCTION
    family = construction.family
    player.get_project_priority_list(worker_type).remove(construction)

    deploy_available_workers(player, worker_type, start_now=True)

    construction_name = engine.const_config["assets"][construction.name]["name"]
    if not skip_notifications:
        if construction.family == "Technologies":
            player.notify("Technologies", f"+ 1 lvl <b>{construction_name}</b>.")
            engine.log(f"{player.username} : + 1 lvl {construction_name}")
        elif construction.family == "Functional Facilities":
            player.notify("Constructions", f"+ 1 lvl <b>{construction_name}</b>")
            engine.log(f"{player.username} : + 1 lvl {construction_name}")
        else:
            player.notify("Constructions", f"+ 1 <b>{construction_name}</b>")
            engine.log(f"{player.username} : + 1 {construction_name}")
    if construction.family in [
        "Extraction Facilities",
        "Power Facilities",
        "Storage Facilities",
    ]:
        eol = engine.data["total_t"] + math.ceil(
            engine.const_config["assets"][construction.name]["lifespan"] / engine.in_game_seconds_per_tick
        )
        # TODO(mglst): using random is incompatible with the deterministic nature of the game that the action logger
        # relies on. This should be fixed. Either the position should be logged, or the random should be seeded.
        if player.tile is None:
            raise GameError("Player has no tile")
        position_x = player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1] + random.uniform(-0.5, 0.5)
        position_y = (player.tile.coordinates[1] + random.uniform(-0.5, 0.5)) * 0.5 * 3**0.5
        ActiveFacility(
            name=construction.name,
            position=(position_x, position_y),
            end_of_life=eol,
            player=player,
            multipliers=construction.multipliers,
        )
    if construction.family == "Technologies":
        player.capacities.update(player, None)
    else:
        player.capacities.update(player, construction.name)
    engine.config.update_config_for_user(player)
    player.emit("retrieve_player_data")
    player.emit("finish_construction", package_projects_data(player))

    if family == "Functional Facilities":
        player.invalidate_recompute_and_dispatch_data_for_pages(
            functional_facilities=True,
            technologies=construction.name == "laboratory",
            extraction_facilities=construction.name == "warehouse",
        )
        # Deploy any new workers from laboratory upgrades
        if construction.name == "laboratory":
            deploy_available_workers(player, WorkerType.RESEARCH, start_now=True)
    if family == "Technologies":
        if construction.name == "construction_technology":
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
    del construction
    player.send_worker_info()


def deploy_available_workers(player: Player, worker_type: WorkerType, *, start_now=False) -> None:
    """Ensure all free workers for `family` are in use, if possible.

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
        if construction.status == ConstructionStatus.PAUSED:
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
    if facility.name in engine.extraction_facilities:
        facility.multipliers["price_multiplier"] = technology_effects.price_multiplier(facility.player, facility.name)
        facility.multipliers["multiplier_1"] = technology_effects.multiplier_1(facility.player, facility.name)
        facility.multipliers["multiplier_2"] = technology_effects.multiplier_2(facility.player, facility.name)
        facility.multipliers["multiplier_3"] = technology_effects.multiplier_3(facility.player, facility.name)
    else:
        facility.multipliers["multiplier_1"] = technology_effects.multiplier_1(facility.player, facility.name)
        if facility.name in engine.power_facilities + engine.storage_facilities:
            facility.multipliers["multiplier_1"] = technology_effects.multiplier_1(facility.player, facility.name)
        if facility.name in engine.storage_facilities:
            facility.multipliers["multiplier_2"] = technology_effects.multiplier_2(facility.player, facility.name)
        if facility.name in engine.controllable_facilities + engine.storage_facilities:
            facility.multipliers["multiplier_3"] = technology_effects.multiplier_3(facility.player, facility.name)
    player.capacities.update(player, facility.name)


def upgrade_all_of_type(player: Player, facility_name: str) -> None:
    """Upgrade all facilities of a certain type."""
    facilities: Iterator[ActiveFacility] = ActiveFacility.filter_by(player_id=player.id, facility=facility_name)
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
    if facility.name in engine.technologies + engine.functional_facilities:
        msg = "Cannot remove technologies or functional facilities"
        raise GameError(msg)
    if facility.name in engine.storage_facilities and not decommissioning:
        facility.end_of_life = 0
        player.capacities.update(player, facility.name)
        return
    # The cost of decommissioning is 20% of the building cost.
    cost = facility.dismantle_cost
    player.money -= cost
    if not ActiveFacility.filter_by(facility=facility.name, player_id=player.id):
        # remove facility from facility priorities if it was the last one
        if facility.name in engine.extraction_facilities + engine.storage_facilities:
            player.priorities_of_demand.remove(facility.name)
            reorder_facility_priorities(player)
        if facility.name in engine.renewables:
            player.list_of_renewables.remove(facility.name)
            reorder_facility_priorities(player)
        if facility.name in engine.storage_facilities + engine.controllable_facilities:
            player.priorities_of_controllables.remove(facility.name)
            reorder_facility_priorities(player)
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
    del facility


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
    facilities: Iterator[ActiveFacility] = ActiveFacility.filter_by(player_id=player.id, facility=facility_name)
    for facility in facilities:
        with contextlib.suppress(GameError):
            dismantle_facility(player, facility)


def package_projects_data(player: Player) -> dict:
    """Package ongoing constructions for a particular player."""
    # TODO(mglst): Rework the return dict structure (involves back + front end)
    return {0: player.package_constructions(), 1: player.constructions_by_priority, 2: player.researches_by_priority}


def queue_project(
    player: Player,
    asset: str,
    *,
    force: bool = False,
    ignore_requirements_and_money: bool = False,
    skip_notifications: bool = False,
) -> OngoingProject:
    """Queue a construction or research project."""

    if asset not in engine.all_asset_types:
        msg = f"Asset '{asset}' not found"
        raise GameError(msg)

    asset_requirement_status = technology_effects.requirements_status(
        player,
        asset,
        technology_effects.asset_requirements(player, asset),
    )
    if asset_requirement_status == "unsatisfied" and not ignore_requirements_and_money:
        msg = "Requirements not satisfied"
        raise GameError(msg)

    real_price = technology_effects.construction_price(player, asset)
    duration = technology_effects.construction_time(player, asset)

    if player.money < real_price and not ignore_requirements_and_money:
        msg = "notEnoughMoney"
        raise GameError(msg)

    construction_power = technology_effects.construction_power(player, asset)
    if not force and not player.is_in_network:
        capacity = 0
        for gen in engine.power_facilities:
            if player.capacities[gen] is not None:
                capacity += player.capacities[gen]["power"]
        if construction_power > capacity:
            raise Confirm(capacity=capacity, construction_power=construction_power)

    if not ignore_requirements_and_money:
        player.money -= real_price

    # The construction is added as paused and then immediately unpaused in order to place it in the right place in the
    # priority list.
    new_construction: OngoingProject = OngoingProject(
        name=asset,
        family=engine.asset_family_by_name[asset],
        end_tick_or_ticks_passed=0,
        duration=duration,
        status=ConstructionStatus.PAUSED,
        construction_power=construction_power,
        construction_pollution=technology_effects.construction_pollution_per_tick(player, asset),
        multipliers={
            "price_multiplier": technology_effects.price_multiplier(player, asset),
            "multiplier_1": technology_effects.multiplier_1(player, asset),
            "multiplier_2": technology_effects.multiplier_2(player, asset),
            "multiplier_3": technology_effects.multiplier_3(player, asset),
        },
        player=player,
    )
    if asset in engine.technologies:
        player.researches_by_priority.append(new_construction)
    else:
        player.constructions_by_priority.append(new_construction)
    try:
        toggle_pause_project(player, new_construction)
    except GameError:
        # if the new construction depends on a construction that is paused.
        pass

    if not skip_notifications:
        engine.log(f"{player.username} started the construction {asset}")
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)

    invalidate_data_on_project_update(player, asset)
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
    elif asset_type in engine.functional_facilities:
        player.invalidate_recompute_and_dispatch_data_for_pages(functional_facilities=True)
    elif asset_type in engine.technologies:
        player.invalidate_recompute_and_dispatch_data_for_pages(technologies=True)


def cancel_project(player: Player, construction: OngoingProject, *, force: bool = False):
    """Cancel an ongoing construction."""
    if construction is None or construction.player != player:
        msg = "Construction not found"
        raise GameError(msg)
    priority_list_name = (
        "researches_by_priority" if construction.name in engine.technologies else "constructions_by_priority"
    )

    dependents = []
    priority_list = getattr(player, priority_list_name)
    construction_priority_index = priority_list.index(construction.id)
    for candidate_dependent in priority_list[construction_priority_index + 1 :]:
        if construction.id in candidate_dependent.cache.prerequisites:
            dependents.append([candidate_dependent.name, candidate_dependent.cache.level])
    if dependents:
        msg = "HasDependents"
        raise GameError(msg, dependents=dependents)

    if not force:
        raise Confirm(refund=f"{round(80 * (1 - construction.progress()))}%")

    refund = (
        0.8
        * engine.const_config["assets"][construction.name]["base_price"]
        * construction.multipliers["price_multiplier"]
        * (1 - construction.progress())
    )
    if construction.name in ["small_water_dam", "large_water_dam", "watermill"]:
        refund *= construction.multipliers["multiplier_2"]
    player.money += refund
    if priority_list_name == "researches_by_priority":
        player.researches_by_priority.remove(construction)
    else:
        player.constructions_by_priority.remove(construction)

    worker_type = WorkerType.RESEARCH if construction.name in engine.technologies else WorkerType.CONSTRUCTION
    deploy_available_workers(player, worker_type)
    player.send_worker_info()

    engine.log(f"{player.username} cancelled the construction {construction.name}")
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)

    invalidate_data_on_project_update(player, construction.name)
    del construction


def decrease_project_priority(player: Player, construction: OngoingProject):
    """
    Decrease the priority of an ongoing construction.
    This function is executed when a player changes the order of ongoing constructions.
    Note : When a project is moved in the priority list, it may be paused or unpaused.
    """
    if construction is None or construction.player != player:
        msg = "Construction not found"
        raise GameError(msg)
    attr = "researches_by_priority" if construction.name in engine.technologies else "constructions_by_priority"

    worker_type = WorkerType.RESEARCH if construction.family == "Technologies" else WorkerType.CONSTRUCTION
    priority_list = player.get_project_priority_list(worker_type)
    index = priority_list.index(construction)
    if index == len(priority_list) - 1:
        return

    construction_1: OngoingProject = construction
    construction_2: OngoingProject = priority_list[index + 1]

    # Here are all the possible cases for the two projects, construction_1 and construction_2:
    # 1. ongoing, ongoing (swap)
    # 2. ongoing, waiting (swap, modify status)
    # 3. ongoing, paused  DISALLOWED
    # 4. waiting, waiting (swap)
    # 5. waiting, paused  DISALLOWED
    # 6. paused , paused  (swap)

    if construction_1 in construction_2.prerequisites:
        raise GameError("requirementsPreventReorder")
    if not construction_1.was_paused_by_player() and construction_2.was_paused_by_player():
        msg = "CannotSwapPausedProject"
        raise GameError(msg, construction_1=construction_1.name, construction_2=construction_2.name)

    if construction_1.status == ConstructionStatus.ONGOING and construction_2.status == ConstructionStatus.WAITING:
        # Case 2
        # This case can only happen when construction 1 is using the last available worker. (Indeed, the other case is
        # when construction 1 is a prerequisite of construction 2, but in this case, the swap is not possible)
        construction_1.set_waiting()
        construction_2.set_ongoing()

    priority_list[index + 1], priority_list[index] = (priority_list[index], priority_list[index + 1])
    setattr(player, attr, ",".join(map(str, priority_list)))
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)


def toggle_pause_project(player: Player, construction: OngoingProject) -> None:
    """
    This function is executed when a player pauses or unpauses an ongoing construction.
    Note : When a project is paused or unpaused, it's position in the priority list has to be updated.
    """
    if construction is None or construction.player != player:
        msg = "Construction not found"
        raise GameError(msg)

    worker_type = WorkerType.RESEARCH if construction.family == "Technologies" else WorkerType.CONSTRUCTION

    if not construction.was_paused_by_player():
        # project is currently not paused by player, and should be paused
        priority_list = player.get_project_priority_list(worker_type)
        construction_index = priority_list.index(construction)
        construction.pause()
        dependency = [construction]
        dependency_indices = [construction_index]
        insertion_index: int | None = None
        for index, other_construction in enumerate(priority_list[construction_index + 1 :]):
            other_construction_index = index + construction_index + 1
            if other_construction.was_paused_by_player():
                insertion_index = other_construction_index
                break
            for prerequisite in other_construction.prerequisites:
                if prerequisite in dependency:
                    other_construction.pause()
                    dependency.append(other_construction)
                    dependency_indices.append(other_construction_index)
                    break
        # Remove all dependent constructions from the priority list, and reinsert them at the right place
        if insertion_index is None:
            # If insertion_index is None, then there are no preexisting paused constructions
            for dependent in dependency:
                priority_list.remove(dependent)
            for dependent in dependency:
                priority_list.append(dependent)
        else:
            # If insertion_index is not None, then there are preexisting paused constructions
            priority_list = [
                *[id for id in priority_list[:insertion_index] if id not in dependency],
                *dependency,
                *priority_list[insertion_index:],
            ]
            for dependent in dependency:
                priority_list.insert(insertion_index, dependent)
                priority_list.remove(dependent)

        # There is now (at least one) free worker, which must now be deployed on any WAITING projects, if possible
        worker_type = WorkerType.RESEARCH if construction.name in engine.technologies else WorkerType.CONSTRUCTION
        deploy_available_workers(player, worker_type)
        player.send_worker_info()

        engine.log(f"{player.username} paused the construction {construction.id} {construction.name}")
    else:
        # project is currently pause, and should be unpaused
        if "_prerequisites_and_level" in construction.__dict__:
            del construction._prerequisites_and_level  # Needed to force recompute, as prerequisites aren't
        for prerequisite in construction.prerequisites:
            if prerequisite.status == ConstructionStatus.PAUSED:
                raise GameError("PausedPrerequisitePreventUnpause")

        construction.unpause()
        # project status is now ONGOING or WAITING.
        # Reorder the priority list
        priority_list = player.get_project_priority_list(worker_type)
        priority_list.remove(construction)
        insertion_index = None
        for new_index, other_construction in enumerate(priority_list):
            if other_construction.status < construction.status:
                insertion_index = new_index
                break
        if insertion_index is not None:
            priority_list.insert(insertion_index, construction)
        else:
            priority_list.append(construction)
        engine.log(f"{player.username} unpaused the construction {construction.id} {construction.name}")

    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(player)
