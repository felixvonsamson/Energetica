"""Utils relating to player assets."""

import contextlib
import math
import random

from flask import current_app

from energetica import technology_effects
from energetica.database import db
from energetica.database.active_facility import ActiveFacility
from energetica.database.ongoing_construction import ConstructionStatus, OngoingConstruction
from energetica.database.player import Player
from energetica.game_engine import Confirm, GameEngine, GameError
from energetica.utils.network_helpers import reorder_facility_priorities


def finish_project(construction: OngoingConstruction, *, skip_notifications: bool = False):
    """Finish a construction or research project.

    This function is executed when a construction or research project has finished. The effects include:
    * For facilities which create demands, e.g. carbon capture, adds demands to the demand priorities
    * For technologies and functional facilities, checks for achievements
    * Removes from the relevant construction / research list and priority list
    """
    engine: GameEngine = current_app.config["engine"]
    player: Player = db.session.get(Player, construction.player_id)

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

    priority_list_name = "research_priorities" if construction.family == "Technologies" else "construction_priorities"
    player.remove_from_list(priority_list_name, construction.id)
    family = construction.family
    db.session.delete(construction)

    deploy_available_workers(player, family)

    construction_name = engine.const_config["assets"][construction.name]["name"]
    if not skip_notifications:
        if construction.family == "Technologies":
            player.notify("Technologies", f"+ 1 lvl <b>{construction_name}</b>.")
            engine.log(f"{player.username} : + 1 lvl {construction_name}")
        elif construction.family == "Functional facilities":
            player.notify("Constructions", f"+ 1 lvl <b>{construction_name}</b>")
            engine.log(f"{player.username} : + 1 lvl {construction_name}")
        else:
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
        # TODO(mglst): using random is incompatible with the deterministic nature of the game that the action logger
        # relies on. This should be fixed. Either the position should be logged, or the random should be seeded.
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
        # Deploy any new workers from laboratory upgrades
        if construction.name == "laboratory":
            deploy_available_workers(player, "Technologies")
    if family == "Technologies":
        player.invalidate_recompute_and_dispatch_data_for_pages(
            power_facilities=True,
            storage_facilities=True,
            extraction_facilities=True,
            functional_facilities=True,
            technologies=True,
        )
        other_players: list[Player] = Player.query.filter(Player.id != player.id).all()
        for other_player in other_players:
            other_player.invalidate_recompute_and_dispatch_data_for_pages(technologies=True)


def deploy_available_workers(player: Player, family: str) -> None:
    """Ensure all free workers for `family` are in use, if possible.

    Workers are deployed only on projects that are waiting - paused projects are never unpaused, except by the player.
    The list of ongoing projects may be reordered to satisfy the priority list invariants.
    """
    if family == "Technologies":
        priority_list_name = "research_priorities"

        available_workers = player.available_lab_workers()

    else:
        priority_list_name = "construction_priorities"

        available_workers = player.available_construction_workers()

    if available_workers <= 0:
        return
    priority_list = player.read_list(priority_list_name)

    for priority_index, construction_id in enumerate(priority_list):
        construction: OngoingConstruction = db.session.get(OngoingConstruction, construction_id)
        if construction.status == ConstructionStatus.PAUSED:
            # Only the player can unpause a paused construction
            return
        if construction.is_ongoing():
            continue
        construction.recompute_prerequisites_and_level()  # force recompute
        if construction.cache.prerequisites:
            continue
        construction.set_ongoing()
        available_workers -= 1
        insertion_index = None
        for insertion_index_candidate, possibly_paused_construction_id in enumerate(priority_list[:priority_index]):
            possibly_paused_construction: OngoingConstruction = db.session.get(
                OngoingConstruction,
                possibly_paused_construction_id,
            )
            if not possibly_paused_construction.is_ongoing():
                insertion_index = insertion_index_candidate
                break
        if insertion_index is not None:
            priority_list.remove(construction_id)
            priority_list.insert(insertion_index, construction_id)
        if available_workers <= 0:
            return


# Utilities relating to managing facilities and assets


def upgrade_facility(player: Player, facility: ActiveFacility) -> None:
    """Upgrade a facility."""
    engine: GameEngine = current_app.config["engine"]
    if facility is None or facility.player_id != player.id:
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
    engine: GameEngine = current_app.config["engine"]
    if facility.facility in engine.extraction_facilities:
        facility.price_multiplier = technology_effects.price_multiplier(facility.player, facility.facility)
        facility.multiplier_1 = technology_effects.multiplier_1(facility.player, facility.facility)
        facility.multiplier_2 = technology_effects.multiplier_2(facility.player, facility.facility)
        facility.multiplier_3 = technology_effects.multiplier_3(facility.player, facility.facility)
    else:
        facility.price_multiplier = technology_effects.price_multiplier(facility.player, facility.facility)
        if facility.facility in engine.power_facilities + engine.storage_facilities:
            facility.multiplier_1 = technology_effects.multiplier_1(facility.player, facility.facility)
        if facility.facility in engine.storage_facilities:
            facility.multiplier_2 = technology_effects.multiplier_2(facility.player, facility.facility)
        if facility.facility in engine.controllable_facilities + engine.storage_facilities:
            facility.multiplier_3 = technology_effects.multiplier_3(facility.player, facility.facility)
    db.session.commit()
    player.data.capacities.update(player, facility.facility)


def upgrade_all_of_type(player: Player, facility_name: str) -> None:
    """Upgrade all facilities of a certain type."""
    facilities: list[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id, facility=facility_name).all()
    for facility in facilities:
        with contextlib.suppress(GameError):
            upgrade_facility(player, facility)


def remove_asset(player: Player, facility: ActiveFacility, *, decommissioning: bool = True) -> None:
    """Remove a facility.

    This function is executed when a facility is decommissioned.
    """
    engine = current_app.config["engine"]
    if facility is None or facility.player_id != player.id:
        msg = "Facility not found"
        raise GameError(msg)
    if facility.facility in engine.technologies + engine.functional_facilities:
        msg = "Cannot remove technologies or functional facilities"
        raise GameError(msg)
    if facility.facility in engine.storage_facilities and not decommissioning:
        facility.end_of_life = 0
        db.session.flush()
        player.data.capacities.update(player, facility.facility)
        db.session.commit()
        return
    db.session.delete(facility)
    db.session.flush()
    # The cost of decommissioning is 20% of the building cost.
    cost = facility.dismantle_cost
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
    engine.config.update_config_for_user(player)
    db.session.commit()


def facility_destroyed(player: Player, facility: ActiveFacility, event_name: str) -> None:
    """Destroyed a facility, by a climate event."""
    cost = 0.1 * facility.total_cost
    remove_asset(player, facility, decommissioning=False)
    player.notify(
        "Destruction",
        (
            f"The facility {facility.facility} was destroyed by the {event_name}. The cost of the cleanup was "
            f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
        ),
    )
    current_app.config["engine"].log(f"{player.username} : {facility.facility} destroyed by {event_name}.")


def dismantle_facility(player: Player, facility: ActiveFacility) -> None:
    """Dismantle a facility."""
    if facility is None or facility.player_id != player.id:
        msg = "Facility not found"
        raise GameError(msg)
    cost = facility.dismantle_cost
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.multiplier_2
    if player.money < cost:
        msg = "Not enough money"
        raise GameError(msg)
    remove_asset(player, facility, decommissioning=False)
    engine: GameEngine = current_app.config["engine"]
    engine.log(f"{player.username} dismantled the facility {facility.facility}.")


def dismantle_all_of_type(player: Player, facility_name: str) -> None:
    """Dismantle all facilities of a certain type."""
    facilities: list[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id, facility=facility_name).all()
    for facility in facilities:
        with contextlib.suppress(GameError):
            dismantle_facility(player, facility)


def package_projects_data(player: Player) -> dict:
    """Package ongoing constructions for a particular player."""
    # TODO(mglst): Rework the return dict structure (involves back + front end)
    projects = player.package_constructions()
    construction_priorities = player.read_list("construction_priorities")
    research_priorities = player.read_list("research_priorities")
    return {0: projects, 1: construction_priorities, 2: research_priorities}


def queue_project(
    engine: GameEngine,
    player: Player,
    asset: str,
    *,
    force: bool = False,
    ignore_requirements_and_money: bool = False,
    skip_notifications: bool = False,
) -> OngoingConstruction:
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
            if player.data.capacities[gen] is not None:
                capacity += player.data.capacities[gen]["power"]
        if construction_power > capacity:
            raise Confirm(capacity=capacity, construction_power=construction_power)

    if not ignore_requirements_and_money:
        player.money -= real_price

    # The construction is added as paused and then imediately unpaused in order to place it in the right place in the
    # priority list.
    new_construction: OngoingConstruction = OngoingConstruction(
        name=asset,
        family=engine.asset_family_by_name[asset],
        _end_tick_or_ticks_passed=0,
        duration=duration,
        status=ConstructionStatus.PAUSED,
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
    player.add_to_list(
        "research_priorities" if asset in engine.technologies else "construction_priorities",
        new_construction.id,
    )
    db.session.flush()
    toggle_pause_project(player, new_construction)

    if not skip_notifications:
        engine.log(f"{player.username} started the construction {asset}")
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(engine, player)
    db.session.commit()

    invalidate_data_on_project_update(engine, player, asset)
    return new_construction


def invalidate_data_on_project_update(engine: GameEngine, player: Player, asset_type: str) -> None:
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


def cancel_project(player: Player, construction: OngoingConstruction, *, force: bool = False):
    """Cancel an ongoing construction."""
    engine: GameEngine = current_app.config["engine"]
    if construction is None or construction.player_id != player.id:
        msg = "Construction not found"
        raise GameError(msg)
    priority_list_name = (
        "research_priorities" if construction.name in engine.technologies else "construction_priorities"
    )

    dependents = []
    priority_list = player.read_list(priority_list_name)
    construction_priority_index = priority_list.index(construction.id)
    for candidate_dependent_id in priority_list[construction_priority_index + 1 :]:
        candidate_dependent: OngoingConstruction = db.session.get(OngoingConstruction, candidate_dependent_id)
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
        * construction.price_multiplier
        * (1 - construction.progress())
    )
    if construction.name in ["small_water_dam", "large_water_dam", "watermill"]:
        refund *= construction.multiplier_2
    player.money += refund
    player.remove_from_list(priority_list_name, construction.id)
    db.session.delete(construction)
    engine.log(f"{player.username} cancelled the construction {construction.name}")
    db.session.commit()
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(engine, player)

    invalidate_data_on_project_update(engine, player, construction.name)


def decrease_project_priority(player, construction):
    """
    Decrease the priority of an ongoing construction.
    This function is executed when a player changes the order of ongoing constructions.
    Note : When a project is moved in the priority list, it may be paused or unpaused.
    """
    engine = current_app.config["engine"]
    if construction is None or construction.player_id != player.id:
        msg = "Construction not found"
        raise GameError(msg)
    attr = "research_priorities" if construction.name in engine.technologies else "construction_priorities"

    priority_list: list[int] = player.read_list(attr)
    index = priority_list.index(construction.id)
    if index == len(priority_list) - 1:
        return

    construction_1: OngoingConstruction = construction
    construction_2: OngoingConstruction = db.session.get(OngoingConstruction, priority_list[index + 1])

    # Here are all the possible cases for the two projects, construction_1 and construction_2:
    # 1. ongoing, ongoing (swap)
    # 2. ongoing, waiting (swap, modify status)
    # 3. ongoing, paused  DISALLOWED
    # 4. waiting, waiting (swap)
    # 5. waiting, paused  DISALLOWED
    # 6. paused , paused  (swap)

    if construction_1.id in construction_2.cache.prerequisites:
        raise GameError("requirementsPreventReorder")
    if not construction_1.was_paused_by_player() and construction_2.was_paused_by_player():
        msg = f"CannotSwapPausedProject"
        raise GameError(msg, construction_1=construction_1.name, construction_2=construction_2.name)

    if construction_1.status == ConstructionStatus.ONGOING and construction_2.status == ConstructionStatus.WAITING:
        # Case 2
        # This case can only happen when construction 1 is using the last available worker. (Indeed, the other case is
        # when construction 1 is a prerequisite of construction 2, but in this case, the swap is not possible)
        construction_1.set_waiting()
        construction_2.set_ongoing()

    priority_list[index + 1], priority_list[index] = (priority_list[index], priority_list[index + 1])
    setattr(player, attr, ",".join(map(str, priority_list)))
    db.session.commit()
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(engine, player)


def toggle_pause_project(player: Player, construction: OngoingConstruction) -> None:
    """
    This function is executed when a player pauses or unpauses an ongoing construction.
    Note : When a project is paused or unpaused, it's position in the priority list has to be updated.
    """
    engine: GameEngine = current_app.config["engine"]
    if construction is None or construction.player_id != player.id:
        msg = "Construction not found"
        raise GameError(msg)
    priority_list_name = (
        "research_priorities" if construction.name in engine.technologies else "construction_priorities"
    )

    if not construction.was_paused_by_player():
        # project is currently not paused by player, and should be paused
        priority_list: list[int] = player.read_list(priority_list_name)
        construction_index = priority_list.index(construction.id)
        construction.pause()
        dependency_ids = [construction.id]
        dependency_indices = [construction_index]
        insertion_index: int | None = None
        for index, other_construction_id in enumerate(priority_list[construction_index + 1 :]):
            other_construction_index = index + construction_index + 1
            other_construction: OngoingConstruction = db.session.get(OngoingConstruction, other_construction_id)
            if other_construction.was_paused_by_player():
                insertion_index = other_construction_index
                break
            for prerequisite_id in other_construction.cache.prerequisites:
                if prerequisite_id in dependency_ids:
                    other_construction.pause()
                    dependency_ids.append(other_construction_id)
                    dependency_indices.append(other_construction_index)
                    break
        # Remove all dependent constructions from the priority list, and reinsert them at the right place
        if insertion_index is None:
            # If insertion_index is None, then there are no preexisting paused constructions
            priority_list = [
                *[id for id in priority_list if id not in dependency_ids],
                *dependency_ids,
            ]
        else:
            # If insertion_index is not None, then there are preexisting paused constructions
            priority_list = [
                *[id for id in priority_list[:insertion_index] if id not in dependency_ids],
                *dependency_ids,
                *priority_list[insertion_index:],
            ]
        player.write_list(priority_list_name, priority_list)
        engine.log(f"{player.username} paused the construction {construction.id} {construction.name}")
    else:
        # project is currently pause, and should be unpaused
        if "_prerequisites_and_level" in construction.cache.__dict__:
            del construction.cache._prerequisites_and_level  # Needed to force recompute, as prerequisites aren't
        for prerequisite_id in construction.cache.prerequisites:
            prerequisite = OngoingConstruction.query.get(prerequisite_id)
            if prerequisite.status == ConstructionStatus.PAUSED:
                raise GameError("PausedPrerequisitePreventUnpause")

        # automatically removed when they are finished
        construction.unpause()
        # project status is now ONGOING or WAITING.
        # Reorder the priority list
        priority_list = player.read_list(priority_list_name)
        priority_list.remove(construction.id)
        insertion_index = None
        for new_index, other_construction_id in enumerate(priority_list):
            other_construction: OngoingConstruction = OngoingConstruction.query.get(other_construction_id)
            if other_construction.status < construction.status:
                insertion_index = new_index
                break
        if insertion_index is not None:
            priority_list.insert(insertion_index, construction.id)
        else:
            priority_list.append(construction.id)
        player.write_list(priority_list_name, priority_list)
        engine.log(f"{player.username} unpaused the construction {construction.id} {construction.name}")

    db.session.commit()
    # TODO(mglst): This should be re-enabled when the websocket is re-enabled
    # from energetica.api import websocket
    # websocket.rest_notify_constructions(engine, player)
