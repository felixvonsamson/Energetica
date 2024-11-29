"""Utils relating to player assets"""

import math
import random
from typing import List

from flask import current_app

from energetica import db, game_engine, technology_effects
from energetica.database.active_facility import ActiveFacility
from energetica.database.ongoing_construction import OngoingConstruction
from energetica.database.player import Player
from energetica.game_engine import Confirm, GameEngine, GameException
from energetica.utils.network_helpers import reorder_facility_priorities


def finish_project(construction: OngoingConstruction, skip_notifications=False):
    """
    This function is executed when a construction or research project has finished. The effects include:
    * For facilities which create demands, e.g. carbon capture, adds demands to the demand priorities
    * For technologies and functional facilities, checks for achievements
    * Removes from the relevant construction / research list and priority list
    """
    engine: GameEngine = current_app.config["engine"]
    player: Player = Player.query.get(construction.player_id)

    if construction.family in ["Technologies", "Functional facilities"]:
        if getattr(player, construction.name) == 0:
            if construction.name == "carbon_capture":
                player.data.rolling_history.add_subcategory("demand", construction.name)
                player.data.rolling_history.add_subcategory("emissions", construction.name)
                player.data.cumul_emissions.add_category(construction.name)
                player.add_to_list("demand_priorities", construction.name)
                reorder_facility_priorities(engine, player)
            if construction.name == "warehouse":
                for resource in ["coal", "gas", "uranium"]:
                    player.data.rolling_history.add_subcategory("resources", resource)
            if construction.name == "laboratory":
                player.add_to_list("demand_priorities", "research")
                reorder_facility_priorities(engine, player)
            if construction.name == "warehouse":
                player.add_to_list("demand_priorities", "transport")
                reorder_facility_priorities(engine, player)

        setattr(player, construction.name, getattr(player, construction.name) + 1)

        if construction.family == "Technologies":
            player.total_technologies += 1
            server_tech = engine.data["technology_lvls"][construction.name]
            if len(server_tech) <= getattr(player, construction.name):
                server_tech.append(0)
            server_tech[getattr(player, construction.name) - 1] += 1
            player.check_technology_achievement()

    elif ActiveFacility.query.filter_by(facility=construction.name, player_id=player.id).count() == 0:
        # initialize array for facility if it is the first one built
        if construction.name in engine.storage_facilities + engine.power_facilities + engine.extraction_facilities:
            player.data.rolling_history.add_subcategory("op_costs", construction.name)
        if construction.name in engine.storage_facilities + engine.power_facilities:
            player.data.rolling_history.add_subcategory("generation", construction.name)
        if construction.name in engine.storage_facilities + engine.extraction_facilities:
            player.data.rolling_history.add_subcategory("demand", construction.name)
        if construction.name in engine.storage_facilities:
            player.data.rolling_history.add_subcategory("storage", construction.name)
        if construction.name in engine.controllable_facilities + engine.extraction_facilities:
            player.data.rolling_history.add_subcategory("emissions", construction.name)
            player.data.cumul_emissions.add_category(construction.name)
        if construction.name in engine.extraction_facilities + engine.storage_facilities:
            player.add_to_list("demand_priorities", construction.name)
            reorder_facility_priorities(engine, player)
        if construction.name in engine.renewables:
            player.add_to_list("self_consumption_priority", construction.name)
            reorder_facility_priorities(engine, player)
        if construction.name in engine.storage_facilities + engine.controllable_facilities:
            player.add_to_list("rest_of_priorities", construction.name)
            reorder_facility_priorities(engine, player)

    player.check_construction_achievements(construction.name)

    if construction.family == "Technologies":
        priority_list_name = "research_priorities"
    else:
        priority_list_name = "construction_priorities"
    player.remove_from_list(priority_list_name, construction.id)
    family = construction.family
    db.session.delete(construction)

    deploy_available_workers(player, family)

    construction_name = engine.const_config["assets"][construction.name]["name"]
    if construction.family == "Technologies":
        if not skip_notifications:
            player.notify("Technologies", f"+ 1 lvl <b>{construction_name}</b>.")
            engine.log(f"{player.username} : + 1 lvl {construction_name}")
    elif construction.family == "Functional facilities":
        if not skip_notifications:
            player.notify("Constructions", f"+ 1 lvl <b>{construction_name}</b>")
            engine.log(f"{player.username} : + 1 lvl {construction_name}")
    else:
        if not skip_notifications:
            player.notify("Constructions", f"+ 1 <b>{construction_name}</b>")
            engine.log(f"{player.username} : + 1 {construction_name}")
    if construction.family in [
        "Extraction facilities",
        "Power facilities",
        "Storage facilities",
    ]:
        eol = engine.data["total_t"] + math.ceil(
            engine.const_config["assets"][construction.name]["lifespan"] / engine.in_game_seconds_per_tick
        )
        position_x = player.tile.q + 0.5 * player.tile.r + random.uniform(-0.5, 0.5)
        position_y = (player.tile.r + random.uniform(-0.5, 0.5)) * 0.5 * 3**0.5
        new_facility: ActiveFacility = ActiveFacility(
            facility=construction.name,
            pos_x=position_x,
            pos_y=position_y,
            end_of_life=eol,
            player_id=player.id,
            price_multiplier=construction.price_multiplier,
            multiplier_1=construction.multiplier_1,
            multiplier_2=construction.multiplier_2,
            multiplier_3=construction.multiplier_3,
        )
        db.session.add(new_facility)
    if construction.family == "Technologies":
        player.data.capacities.update(player, None)
    else:
        player.data.capacities.update(player, construction.name)
    engine.config.update_config_for_user(player)
    player.emit("retrieve_player_data")

    if family == "Functional facilities":
        player.invalidate_recompute_and_dispatch_data_for_pages(functional_facilities=True, technologies=True)
    if family == "Technologies":
        player.invalidate_recompute_and_dispatch_data_for_pages(
            power_facilities=True,
            storage_facilities=True,
            extraction_facilities=True,
            functional_facilities=True,
            technologies=True,
        )
        other_players: List[Player] = Player.query.filter(Player.id != player.id).all()
        for other_player in other_players:
            other_player.invalidate_recompute_and_dispatch_data_for_pages(technologies=True)


def deploy_available_workers(player: Player, family: str):
    """Ensures all free workers for `family` are in use, if possible"""
    if family == "Technologies":
        priority_list_name = "research_priorities"

        def available_workers() -> int:
            return player.available_lab_workers()

    else:
        priority_list_name = "construction_priorities"

        def available_workers() -> int:
            return player.available_construction_workers()

    if available_workers() <= 0:
        return
    priority_list = player.read_list(priority_list_name)

    for priority_index, construction_id in enumerate(priority_list):
        construction: OngoingConstruction = OngoingConstruction.query.get(construction_id)
        if not construction.is_paused():
            continue
        construction.recompute_prerequisites_and_level()  # force recompute
        if construction.cache.prerequisites:
            continue
        construction.resume()
        insertion_index = None
        for insertion_index_candidate, possibly_paused_construction_id in enumerate(priority_list[:priority_index]):
            possibly_paused_construction: OngoingConstruction = OngoingConstruction.query.get(
                possibly_paused_construction_id
            )
            if possibly_paused_construction.is_paused():
                insertion_index = insertion_index_candidate
                break
        if insertion_index is not None:
            priority_list.remove(construction_id)
            priority_list.insert(insertion_index, construction_id)
        if available_workers() <= 0:
            return


# Utilities relating to managing facilities and assets


def upgrade_facility(player, facility):
    """this function is executed when a player upgrades a facility"""
    engine: game_engine.GameEngine = current_app.config["engine"]
    if facility is None or facility.player_id != player.id:
        raise GameException("constructionNotFound")

    if facility.facility in engine.technologies + engine.functional_facilities or not facility.is_upgradable:
        raise GameException("notUpgradable")

    const_config = engine.const_config["assets"][facility.facility]
    upgrade_cost = facility.upgrade_cost
    if player.money < upgrade_cost:
        raise GameException("notEnoughMoney")
    player.money -= upgrade_cost
    facility.upgrade()
    player.data.capacities.update(player, facility.facility)


def upgrade_all_of_type(player, facility_name):
    """this function is executed when a player upgrades all facilities of a certain type"""
    facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id, facility=facility_name).all()
    for facility in facilities:
        try:
            upgrade_facility(player, facility)
        except GameException:
            pass


def remove_asset(player, facility, decommissioning=True):
    """this function is executed when a facility is decommissioned."""
    engine = current_app.config["engine"]
    if facility is None or facility.player_id != player.id:
        raise GameException("constructionNotFound")
    if facility.facility in engine.technologies + engine.functional_facilities:
        raise GameException("notRemovable")
    db.session.delete(facility)
    db.session.flush()
    # The cost of decommissioning is 20% of the building cost.
    cost = 0.2 * engine.const_config["assets"][facility.facility]["base_price"] * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.multiplier_2
    player.money -= cost
    if ActiveFacility.query.filter_by(facility=facility.facility, player_id=player.id).count() == 0:
        # remove facility from facility priorities if it was the last one
        if facility.facility in engine.extraction_facilities + engine.storage_facilities:
            player.remove_from_list("demand_priorities", facility.facility)
            reorder_facility_priorities(engine, player)
        if facility.facility in engine.renewables:
            player.remove_from_list("self_consumption_priority", facility.facility)
            reorder_facility_priorities(engine, player)
        if facility.facility in engine.storage_facilities + engine.controllable_facilities:
            player.remove_from_list("rest_of_priorities", facility.facility)
            reorder_facility_priorities(engine, player)
    facility_name = engine.const_config["assets"][facility.facility]["name"]
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
    db.session.flush()
    player.data.capacities.update(player, facility.facility)
    engine.config.update_config_for_user(player.id)
    db.session.commit()


def facility_destroyed(player, facility, event_name):
    """this function is executed when a facility is destroyed by a climate event"""
    base_price = current_app.config["engine"].const_config["assets"][facility.facility]["base_price"]
    cost = 0.1 * base_price * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.multiplier_2
    remove_asset(player, facility, decommissioning=False)
    player.notify(
        "Destruction",
        (
            f"The facility {facility.facility} was destroyed by the {event_name}. The cost of the cleanup was "
            f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
        ),
    )
    current_app.config["engine"].log(f"{player.username} : {facility.facility} destroyed by {event_name}.")


def dismantle_facility(player, facility):
    """this function is executed when a player dismantles a facility"""
    if facility is None or facility.player_id != player.id:
        raise GameException("facilityNotFound")
    cost = facility.dismantle_cost
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.multiplier_2
    if player.money < cost:
        return GameException("notEnoughMoney")
    remove_asset(player, facility, decommissioning=False)
    current_app.config["engine"].log(f"{player.username} dismantled the facility {facility.facility}.")


def dismantle_all_of_type(player, facility_name):
    """this function is executed when a player dismantles all facilities of a certain type"""
    facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id, facility=facility_name).all()
    for facility in facilities:
        try:
            dismantle_facility(player, facility)
        except GameException:
            pass


def package_projects_data(player):
    """
    Gets the data for the ongoing constructions for a particular player
    TODO:
    * Rework the return dict structure (involves back + front end)
    """
    projects = player.package_constructions()
    construction_priorities = player.read_list("construction_priorities")
    research_priorities = player.read_list("research_priorities")
    return {0: projects, 1: construction_priorities, 2: research_priorities}


def queue_project(
    engine: GameEngine,
    player: Player,
    asset: str,
    force=False,
    ignore_requirements_and_money=False,
    skip_notifications=False,
) -> OngoingConstruction:
    """this function is executed when a player clicks on 'start construction'"""

    if asset not in engine.all_asset_types:
        raise GameException("malformedRequest")

    asset_requirement_status = technology_effects.requirements_status(
        player, asset, technology_effects.asset_requirements(player, asset)
    )
    if asset_requirement_status == "unsatisfied" and not ignore_requirements_and_money:
        raise GameException("locked")

    real_price = technology_effects.construction_price(player, asset)
    duration = technology_effects.construction_time(player, asset)

    if player.money < real_price and not ignore_requirements_and_money:
        raise GameException("notEnoughMoney")

    construction_power = technology_effects.construction_power(player, asset)
    if not force and not player.is_in_network:
        capacity = 0
        for gen in engine.power_facilities:
            if player.data.capacities[gen] is not None:
                capacity += player.data.capacities[gen]["power"]
        if construction_power > capacity:
            raise Confirm(capacity=capacity, construction_power=construction_power)

    def can_start_immediately():
        if asset_requirement_status == "queued":
            return False
        if asset in engine.technologies and player.available_lab_workers() == 0:
            return False  # No available workers
        if asset not in engine.technologies and player.available_construction_workers() == 0:
            return False  # No available workers
        if (
            asset in engine.technologies + engine.functional_facilities
            and OngoingConstruction.query.filter_by(name=asset, player_id=player.id).count() > 0
        ):
            return False  # Another level is already ongoing
        return True

    suspension_time = None if can_start_immediately() else engine.data["total_t"]

    if not ignore_requirements_and_money:
        player.money -= real_price
    new_construction: OngoingConstruction = OngoingConstruction(
        name=asset,
        family=engine.asset_family_by_name[asset],
        start_time=engine.data["total_t"],
        duration=duration,
        suspension_time=suspension_time,
        construction_power=construction_power,
        construction_pollution=technology_effects.construction_pollution_per_tick(player, asset),
        price_multiplier=technology_effects.price_multiplier(player, asset),
        multiplier_1=technology_effects.multiplier_1(player, asset),
        multiplier_2=technology_effects.multiplier_2(player, asset),
        multiplier_3=technology_effects.multiplier_3(player, asset),
        player_id=player.id,
    )
    db.session.add(new_construction)
    db.session.commit()

    priority_list_name = "research_priorities" if asset in engine.technologies else "construction_priorities"
    if suspension_time is None:
        # Add this project to the priority list, before all paused projects, but after all existing ongoing projects
        priority_list = player.read_list(priority_list_name)
        insertion_index = 0
        for possibly_unpaused_project_index, possibly_unpaused_project_id in enumerate(priority_list):
            possibly_unpaused_project: OngoingConstruction = OngoingConstruction.query.get(possibly_unpaused_project_id)
            if possibly_unpaused_project.suspension_time is None:  # not paused
                insertion_index = possibly_unpaused_project_index + 1
            else:  # paused
                break
        priority_list.insert(insertion_index, new_construction.id)
        player.write_list(priority_list_name, priority_list)
    else:
        player.add_to_list(priority_list_name, new_construction.id)

    if not skip_notifications:
        engine.log(f"{player.username} started the construction {asset}")
    from energetica.api import websocket

    websocket.rest_notify_constructions(engine, player)
    db.session.commit()

    invalidate_data_on_project_update(engine, player, asset)
    return new_construction


def invalidate_data_on_project_update(engine: GameEngine, player: Player, asset_type: str):
    """Check for data page invalidation when project has been queued or cancelled"""
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


def cancel_project(player: Player, construction: OngoingConstruction, force=False):
    """This function is executed when a player cancels an ongoing construction"""
    engine: GameEngine = current_app.config["engine"]
    if construction is None or construction.player_id != player.id:
        raise GameException("constructionNotFound")
    priority_list_name = (
        "research_priorities" if construction.name in engine.technologies else "construction_priorities"
    )

    if construction.suspension_time is None:
        time_fraction = (engine.data["total_t"] - construction.start_time) / (construction.duration)
    else:
        time_fraction = (construction.suspension_time - construction.start_time) / (construction.duration)

    dependents = []
    priority_list = player.read_list(priority_list_name)
    construction_priority_index = priority_list.index(construction.id)
    for candidate_dependent_id in priority_list[construction_priority_index + 1 :]:
        candidate_dependent: OngoingConstruction = OngoingConstruction.query.get(candidate_dependent_id)
        if construction.id in candidate_dependent.cache.prerequisites:
            dependents.append([candidate_dependent.name, candidate_dependent.cache.level])
    if dependents:
        raise GameException("hasDependents", dependents=dependents)

    if not force:
        raise Confirm(refund=f"{round(80 * (1 - time_fraction))}%")

    refund = (
        0.8
        * engine.const_config["assets"][construction.name]["base_price"]
        * construction.price_multiplier
        * (1 - time_fraction)
    )
    if construction.name in ["small_water_dam", "large_water_dam", "watermill"]:
        refund *= construction.multiplier_2
    player.money += refund
    player.remove_from_list(priority_list_name, construction.id)
    db.session.delete(construction)
    engine.log(f"{player.username} cancelled the construction {construction.name}")
    db.session.commit()
    from energetica.api import websocket

    websocket.rest_notify_constructions(engine, player)

    invalidate_data_on_project_update(engine, player, construction.name)


def decrease_project_priority(player, construction):
    """
    This function is executed when a player changes the order of ongoing constructions.
    This function is also called from within the `toggle_pause_project` function, in which case `pausing=True`
    """
    engine = current_app.config["engine"]
    if construction is None or construction.player_id != player.id:
        raise GameException("constructionNotFound")
    attr = "research_priorities" if construction.name in engine.technologies else "construction_priorities"

    priority_list = player.read_list(attr)
    index = priority_list.index(construction.id)
    if 0 <= index < len(priority_list) - 1:
        construction_1: OngoingConstruction = construction
        construction_2: OngoingConstruction = OngoingConstruction.query.get(priority_list[index + 1])

        if construction_1.suspension_time is None and construction_2.suspension_time is not None:
            # construction_1 is not paused, but construction_2 is
            toggle_pause_project(player, construction_1)
            toggle_pause_project(player, construction_2)
            priority_list[index + 1], priority_list[index] = (
                priority_list[index],
                priority_list[index + 1],
            )
        setattr(player, attr, ",".join(map(str, priority_list)))
        db.session.commit()
        from energetica.api import websocket

        websocket.rest_notify_constructions(engine, player)


def toggle_pause_project(player: Player, construction: OngoingConstruction):
    """this function is executed when a player pauses or unpauses an ongoing construction"""
    engine: GameEngine = current_app.config["engine"]
    if construction is None or construction.player_id != player.id:
        raise GameException("constructionNotFound")
    priority_list_name = (
        "research_priorities" if construction.name in engine.technologies else "construction_priorities"
    )

    if construction.suspension_time is None:
        # project is currently not pause, and should be paused
        while construction.suspension_time is None:
            construction.suspension_time = engine.data["total_t"]
            priority_list: List[int] = player.read_list(priority_list_name)
            priority_list.remove(construction.id)
            insertion_index = None
            for new_index, other_construction_id in enumerate(priority_list):
                other_construction: OngoingConstruction = OngoingConstruction.query.get(other_construction_id)
                if other_construction.suspension_time is not None:
                    insertion_index = new_index
                    break
            if insertion_index is not None:
                priority_list.insert(insertion_index, construction.id)
            else:
                priority_list.append(construction.id)
            player.write_list(priority_list_name, priority_list)
        engine.log(f"{player.username} paused the construction {construction.id} {construction.name}")
    else:
        # project is currently pause, and should be unpaused
        construction.recompute_prerequisites_and_level()  # force recompute
        if construction.cache.prerequisites:
            raise GameException("hasUnfinishedPrerequisites")

        available_workers = (
            player.available_lab_workers()
            if construction.family == "Technologies"
            else player.available_construction_workers()
        )

        if available_workers == 0:
            raise GameException("noAvailableWorkers")

        # Unpause the construction
        construction.start_time += engine.data["total_t"] - construction.suspension_time
        construction.suspension_time = None

        # Reorder the priority list
        priority_list: List[int] = player.read_list(priority_list_name)
        priority_list.remove(construction.id)
        insertion_index = None
        for new_index, other_construction_id in enumerate(priority_list):
            other_construction: OngoingConstruction = OngoingConstruction.query.get(other_construction_id)
            if other_construction.suspension_time is not None:
                insertion_index = new_index
                break
        if insertion_index is not None:
            priority_list.insert(insertion_index, construction.id)
        else:
            priority_list.append(construction.id)
        player.write_list(priority_list_name, priority_list)
        engine.log(f"{player.username} unpaused the construction {construction.id} {construction.name}")

    db.session.commit()
    from energetica.api import websocket

    websocket.rest_notify_constructions(engine, player)
