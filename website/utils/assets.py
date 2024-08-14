"""Utils relating to player assets"""

import math
from typing import List

from flask import current_app

from website import db, game_engine, technology_effects
from website.api import websocket
from website.database.player import Player
from website.database.player_assets import ActiveFacility, OngoingConstruction
from website.utils.misc import notify
from website.utils.network import reorder_facility_priorities


def add_asset(player_id, construction_id):
    """this function is executed when a construction or research project has finished"""
    engine = current_app.config["engine"]
    player: Player = Player.query.get(player_id)
    construction: OngoingConstruction = OngoingConstruction.query.get(construction_id)

    if construction.family in ["Technologies", "Functional facilities"]:
        if getattr(player, construction.name) == 0:
            current_data = engine.data["current_data"][player.id]
            if construction.name == "carbon_capture":
                current_data.new_subcategory("demand", construction.name)
                current_data.new_subcategory("emissions", construction.name)
                engine.data["player_cumul_emissions"][player.id].new_category(construction.name)
                player.add_to_list("demand_priorities", construction.name)
                reorder_facility_priorities(engine, player)
            if construction.name == "warehouse":
                for resource in ["coal", "gas", "uranium"]:
                    current_data.new_subcategory("resources", resource)

            # update advancements
            if "technology" not in player.advancements:
                if construction.name == "laboratory":
                    player.add_to_list("demand_priorities", "research")
                    reorder_facility_priorities(engine, player)
                    player.add_to_list("advancements", "technology")
                    notify(
                        "Tutorial",
                        (
                            "You have built a laboratory, you can now research <a href='/technology'>technologies</a> "
                            "to unlock and upgrade facilities."
                        ),
                        player,
                    )
            if "warehouse" not in player.advancements:
                if construction.name == "warehouse":
                    player.add_to_list("demand_priorities", "transport")
                    reorder_facility_priorities(engine, player)
                    player.add_to_list("advancements", "warehouse")
                    notify(
                        "Tutorial",
                        (
                            "You have built a warehouse to store natural resources, you can now buy resources on the "
                            "<a href='/resource_market'>resources market</a> or invest in "
                            "<a href='/extraction_facilities'>extraction facilities</a> to extract your own resources "
                            "from the ground."
                        ),
                        player,
                    )
            if "GHG_effect" not in player.advancements:
                if construction.name == "chemistry":
                    player.add_to_list("advancements", "GHG_effect")
                    notify(
                        "Tutorial",
                        (
                            "Scientists have discovered the greenhouse effect and have shown that climate change "
                            "increases the risks of natural and social catastrophes. You can now monitor your "
                            "emissions of CO<sub>2</sub> in the <a href='/production_overview/emissions'>emissions graph</a>."
                        ),
                        player,
                    )

        setattr(player, construction.name, getattr(player, construction.name) + 1)
        # check achievement
        if (
            construction.name == "laboratory"
            and getattr(player, construction.name) >= 4
            and "technology_1" not in player.achievements
        ):
            player.add_to_list("achievements", "technology_1")
            player.xp += 5
            notify(
                "Achievements",
                "Your lab is level 4, an additional lab worker is available. (+5 xp)",
                player,
            )
        if construction.family == "Technologies":
            player.total_technologies += 1
            server_tech = engine.data["technology_lvls"][construction.name]
            if len(server_tech) <= getattr(player, construction.name):
                server_tech.append(0)
            server_tech[getattr(player, construction.name) - 1] += 1
            if "technology_2" not in player.achievements and player.total_technologies >= 25:
                player.add_to_list("achievements", "technology_2")
                player.xp += 10
                notify(
                    "Achievements",
                    "You have researched a total of 25 levels of technologies. (+10 xp)",
                    player,
                )

    elif ActiveFacility.query.filter_by(facility=construction.name, player_id=player.id).count() == 0:
        # initialize array for facility if it is the first one built
        current_data = engine.data["current_data"][player.id]
        if construction.name in engine.storage_facilities + engine.power_facilities + engine.extraction_facilities:
            current_data.new_subcategory("op_costs", construction.name)
        if construction.name in engine.storage_facilities + engine.power_facilities:
            current_data.new_subcategory("generation", construction.name)
        if construction.name in engine.storage_facilities + engine.extraction_facilities:
            current_data.new_subcategory("demand", construction.name)
        if construction.name in engine.storage_facilities:
            current_data.new_subcategory("storage", construction.name)
        if construction.name in engine.controllable_facilities + engine.extraction_facilities:
            current_data.new_subcategory("emissions", construction.name)
            engine.data["player_cumul_emissions"][player.id].new_category(construction.name)
        if construction.name in engine.extraction_facilities + engine.storage_facilities:
            player.add_to_list("demand_priorities", construction.name)
            reorder_facility_priorities(engine, player)
        if construction.name in engine.renewables:
            player.add_to_list("self_consumption_priority", construction.name)
            reorder_facility_priorities(engine, player)
        if construction.name in engine.storage_facilities + engine.controllable_facilities:
            player.add_to_list("rest_of_priorities", construction.name)
            reorder_facility_priorities(engine, player)

        # update advancements
        if "storage_overview" not in player.advancements:
            if construction.name in engine.storage_facilities:
                player.add_to_list("advancements", "storage_overview")
                notify(
                    "Tutorial",
                    (
                        "You have built your first storage facility, you can monitor the stored energy in the "
                        "<a href='/production_overview/storage'>storage graph</a>."
                    ),
                    player,
                )

    priority_list_name = "construction_priorities"
    project_index = (
        OngoingConstruction.query.filter(
            OngoingConstruction.family != "Technologies",
            OngoingConstruction.player_id == player.id,
            OngoingConstruction.suspension_time.is_(None),
        ).count()
        - 1
    )
    if construction.family == "Technologies":
        priority_list_name = "research_priorities"
        project_index = (
            OngoingConstruction.query.filter(
                OngoingConstruction.family == "Technologies",
                OngoingConstruction.player_id == player.id,
                OngoingConstruction.suspension_time.is_(None),
            ).count()
            - 1
        )
    player.remove_from_list(priority_list_name, construction_id)
    project_priorities = player.read_list(priority_list_name)
    for priority_index, project_id in enumerate(project_priorities[:]):
        next_construction: OngoingConstruction = OngoingConstruction.query.get(project_id)
        if next_construction.suspension_time is not None:
            if next_construction.family in [
                "Functional facilities",
                "Technologies",
            ]:
                first_lvl: OngoingConstruction = (
                    OngoingConstruction.query.filter_by(name=next_construction.name, player_id=player.id)
                    .order_by(OngoingConstruction.duration)
                    .first()
                )
                if first_lvl.suspension_time is None:
                    if first_lvl.start_time + first_lvl.duration >= engine.data["total_t"]:
                        continue
                    else:
                        second_lvl: OngoingConstruction = (
                            OngoingConstruction.query.filter_by(name=next_construction.name, player_id=player.id)
                            .order_by(OngoingConstruction.duration)
                            .offset(1)
                            .first()
                        )
                        if second_lvl is None:
                            continue
                        else:
                            first_lvl = second_lvl
                else:
                    first_lvl.start_time += engine.data["total_t"] - first_lvl.suspension_time
                    first_lvl.suspension_time = None
                    index_first_lvl = project_priorities.index(first_lvl.id)
                    (
                        project_priorities[index_first_lvl],
                        project_priorities[project_index],
                    ) = (
                        project_priorities[project_index],
                        project_priorities[index_first_lvl],
                    )
                    break
            next_construction.start_time += engine.data["total_t"] - next_construction.suspension_time
            next_construction.suspension_time = None
            project_priorities[priority_index], project_priorities[project_index] = (
                project_priorities[project_index],
                project_priorities[priority_index],
            )
            break

    construction_name = engine.const_config["assets"][construction.name]["name"]
    if construction.family == "Technologies":
        notify("Technologies", f"+ 1 lvl <b>{construction_name}</b>.", player)
        engine.log(f"{player.username} : + 1 lvl {construction_name}")
    elif construction.family == "Functional facilities":
        notify("Constructions", f"+ 1 lvl <b>{construction_name}</b>", player)
        engine.log(f"{player.username} : + 1 lvl {construction_name}")
    else:
        notify("Constructions", f"+ 1 <b>{construction_name}</b>", player)
        engine.log(f"{player.username} : + 1 {construction_name}")
    if construction.family in [
        "Extraction facilities",
        "Power facilities",
        "Storage facilities",
    ]:
        eol = engine.data["total_t"] + math.ceil(
            engine.const_config["assets"][construction.name]["lifespan"] / engine.in_game_seconds_per_tick
        )
        new_facility: ActiveFacility = ActiveFacility(
            facility=construction.name,
            end_of_life=eol,
            player_id=player.id,
            price_multiplier=construction.price_multiplier,
            multiplier_1=construction.multiplier_1,
            multiplier_2=construction.multiplier_2,
            multiplier_3=construction.multiplier_3,
        )
        db.session.add(new_facility)
    if construction.family == "Technologies":
        engine.data["player_capacities"][player.id].update(player, None)
    else:
        engine.data["player_capacities"][player.id].update(player, construction.name)
    engine.config.update_config_for_user(player.id)
    player.emit("retrieve_player_data")


# Utilities relating to managing facilities and assets


def upgrade_facility(player, facility_id):
    """this function is executed when a player upgrades a facility"""
    engine: game_engine.GameEngine = current_app.config["engine"]

    def is_upgradable(facility: ActiveFacility):
        """Returns true if any of the attributes of the built facility are outdated compared to current tech levels"""
        if facility.facility in engine.extraction_facilities:
            if facility.price_multiplier < technology_effects.price_multiplier(player, facility.facility):
                return True
            if facility.multiplier_1 < technology_effects.multiplier_1(player, facility.facility):
                return True
            if facility.multiplier_2 < technology_effects.multiplier_2(player, facility.facility):
                return True
            if facility.multiplier_3 < technology_effects.multiplier_3(player, facility.facility):
                return True
        else:  # power & storage facilities
            if facility.price_multiplier < technology_effects.price_multiplier(player, facility.facility):
                return True
            if facility.facility in engine.power_facilities + engine.storage_facilities:
                if facility.multiplier_1 < technology_effects.multiplier_1(player, facility.facility):
                    return True
            if facility.facility in engine.storage_facilities:
                if facility.multiplier_2 < technology_effects.multiplier_2(player, facility.facility):
                    return True
            if facility.facility in engine.controllable_facilities + engine.storage_facilities:
                if facility.multiplier_3 < technology_effects.multiplier_3(player, facility.facility):
                    return True
        return False

    def apply_upgrade(facility: ActiveFacility):
        """Updates the built facilities attributes to match current tech levels"""
        if facility.facility in engine.extraction_facilities:
            facility.price_multiplier = technology_effects.price_multiplier(player, facility.facility)
            facility.multiplier_1 = technology_effects.multiplier_1(player, facility.facility)
            facility.multiplier_2 = technology_effects.multiplier_2(player, facility.facility)
            facility.multiplier_3 = technology_effects.multiplier_3(player, facility.facility)
        else:
            facility.price_multiplier = technology_effects.price_multiplier(player, facility.facility)
            if facility.facility in engine.power_facilities + engine.storage_facilities:
                facility.multiplier_1 = technology_effects.multiplier_1(player, facility.facility)
            if facility.facility in engine.storage_facilities:
                facility.multiplier_2 = technology_effects.multiplier_2(player, facility.facility)
            if facility.facility in engine.controllable_facilities + engine.storage_facilities:
                facility.multiplier_3 = technology_effects.multiplier_3(player, facility.facility)
        db.session.commit()

    facility: ActiveFacility = ActiveFacility.query.get(facility_id)
    if facility.facility in engine.technologies + engine.functional_facilities:
        return {"response": "notUpgradable"}

    const_config = engine.const_config["assets"][facility.facility]

    if is_upgradable(facility):
        price_diff = technology_effects.price_multiplier(player, facility.facility) - facility.price_multiplier
        if price_diff > 0:
            upgrade_cost = const_config["base_price"] * price_diff
        else:
            upgrade_cost = 0.05 * const_config["base_price"]
        if player.money < upgrade_cost:
            return {"response": "notEnoughMoney"}
        player.money -= upgrade_cost
        apply_upgrade(facility)
        engine.data["player_capacities"][player.id].update(player, facility.facility)
        return {"response": "success", "money": player.money}
    else:
        return {"response": "notUpgradable"}


def upgrade_all_of_type(player, facility_id):
    """this function is executed when a player upgrades all facilities of a certain type"""
    facility_name = ActiveFacility.query.get(facility_id).facility
    facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id, facility=facility_name).all()
    for facility in facilities:
        upgrade_facility(player, facility.id)
    return {"response": "success", "money": player.money}


def remove_asset(player_id, facility, decommissioning=True):
    """this function is executed when a facility is decommissioned."""
    engine = current_app.config["engine"]
    if facility.facility in engine.technologies + engine.functional_facilities:
        return {"response": "notRemovable"}
    player = Player.query.get(player_id)
    db.session.delete(facility)
    # The cost of decommissioning is 20% of the building cost.
    cost = 0.2 * engine.const_config["assets"][facility.facility]["base_price"] * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.capacity_multiplier
    player.money -= cost
    facility_name = engine.const_config["assets"][facility.facility]["name"]
    if decommissioning:
        notify(
            "Decommissioning",
            (
                f"The facility {facility_name} reached the end of its operational lifespan and had to be "
                "decommissioned. The cost of this operation was "
                f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
            ),
            player,
        )
        engine.log(f"The facility {facility_name} from {player.username} has been decommissioned.")
    engine.data["player_capacities"][player.id].update(player, facility.facility)
    engine.config.update_config_for_user(player.id)
    db.session.commit()
    return {
        "response": "success",
        "facility_name": facility_name,
        "money": player.money,
    }


def facility_destroyed(player, facility, event_name):
    """this function is executed when a facility is destroyed by a climate event"""
    base_price = current_app.config["engine"].const_config["assets"][facility.facility]["base_price"]
    cost = 0.1 * base_price * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.capacity_multiplier
    response = remove_asset(player.id, facility, decommissioning=False)
    notify(
        "Destruction",
        (
            f"The facility {response['facility_name']} was destroyed by the {event_name}. The cost of the cleanup was "
            f"{round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
        ),
        player,
    )
    current_app.config["engine"].log(f"{player.username} : {response['facility_name']} destroyed by {event_name}.")


def dismantle_facility(player, facility_id):
    """this function is executed when a player dismantles a facility"""
    facility: ActiveFacility = ActiveFacility.query.get(facility_id)
    base_price = current_app.config["engine"].const_config["assets"][facility.facility]["base_price"]
    cost = 0.2 * base_price * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.multiplier_2
    if player.money < cost:
        return {"response": "notEnoughMoney"}
    response = remove_asset(player.id, facility, decommissioning=False)
    current_app.config["engine"].log(f"{player.username} dismantled the facility {response['facility_name']}.")
    return response


def dismantle_all_of_type(player, facility_id):
    """this function is executed when a player dismantles all facilities of a certain type"""
    facility_name = ActiveFacility.query.get(facility_id).facility
    facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(player_id=player.id, facility=facility_name).all()
    for facility in facilities:
        dismantle_facility(player, facility.id)
    return {"response": "success", "money": player.money}


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


def start_project(engine, player, facility, family, force=False):
    """this function is executed when a player clicks on 'start construction'"""
    player_cap = engine.data["player_capacities"][player.id]
    const_config = engine.const_config["assets"][facility]

    if technology_effects.player_can_launch_project(player, facility):
        return {"response": "locked"}

    if facility in ["small_water_dam", "large_water_dam", "watermill"]:
        price_factor = technology_effects.price_multiplier(
            player, facility
        ) * technology_effects.hydro_price_multiplier(player, facility)
        if player.money < const_config["base_price"] * price_factor:
            return {"response": "notEnoughMoneyError"}

    ud_count = 0
    if family in ["Functional facilities", "Technologies"]:
        ud_count = OngoingConstruction.query.filter_by(name=facility, player_id=player.id).count()
        real_price = (
            const_config["base_price"]
            * technology_effects.price_multiplier(player, facility)
            * const_config["price_multiplier"] ** ud_count
        )
        duration = technology_effects.construction_time(player, facility) * const_config["price_multiplier"] ** (
            0.6 * ud_count
        )
    else:  # power facilities, storage facilities, extractions facilities
        real_price = const_config["base_price"] * technology_effects.price_multiplier(player, facility)
        if facility in ["small_water_dam", "large_water_dam", "watermill"]:
            real_price *= technology_effects.hydro_price_multiplier(player, facility)
        duration = technology_effects.construction_time(player, facility)

    if player.money < real_price:
        return {"response": "notEnoughMoneyError"}
    construction_power = technology_effects.construction_power(player, facility)
    if not force and "network" not in player.advancements:
        capacity = 0
        for gen in engine.power_facilities:
            if player_cap[gen] is not None:
                capacity += player_cap[gen]["power"]
        if construction_power > capacity:
            return {
                "response": "areYouSure",
                "capacity": capacity,
                "construction_power": construction_power,
            }

    priority_list_name = "construction_priorities"
    suspension_time = engine.data["total_t"]
    if family == "Technologies":
        priority_list_name = "research_priorities"
        if player.available_lab_workers() > 0 and ud_count == 0:
            suspension_time = None
    else:
        if player.available_construction_workers() > 0 and ud_count == 0:
            suspension_time = None

    player.money -= real_price
    duration = math.ceil(duration)
    new_construction: OngoingConstruction = OngoingConstruction(
        name=facility,
        family=family,
        start_time=engine.data["total_t"],
        duration=duration,
        suspension_time=suspension_time,
        construction_power=construction_power,
        construction_pollution=technology_effects.construction_pollution_per_tick(player, facility),
        price_multiplier=technology_effects.price_multiplier(player, facility),
        multiplier_1=technology_effects.multiplier_1(player, facility),
        multiplier_2=technology_effects.multiplier_2(player, facility),
        multiplier_3=technology_effects.multiplier_3(player, facility),
        player_id=player.id,
    )
    db.session.add(new_construction)
    db.session.commit()
    player.add_to_list(priority_list_name, new_construction.id)
    if suspension_time is None:
        player.project_max_priority(priority_list_name, new_construction.id)
    engine.log(f"{player.username} started the construction {facility}")
    websocket.rest_notify_constructions(engine, player)
    db.session.commit()
    return {
        "response": "success",
        "money": player.money,
        "constructions": package_projects_data(player),
    }


def cancel_project(player, construction_id, force=False):
    """this function is executed when a player cancels an ongoing construction"""
    engine = current_app.config["engine"]
    construction: OngoingConstruction = OngoingConstruction.query.get(int(construction_id))

    priority_list_name = "construction_priorities"
    if construction.family == "Technologies":
        priority_list_name = "research_priorities"

    if construction.suspension_time is None:
        time_fraction = (engine.data["total_t"] - construction.start_time) / (construction.duration)
    else:
        time_fraction = (construction.suspension_time - construction.start_time) / (construction.duration)

    if not force:
        return {
            "response": "areYouSure",
            "refund": f"{round(80 * (1 - time_fraction))}%",
        }

    refund = (
        0.8
        * engine.const_config["assets"][construction.name]["base_price"]
        * construction.price_multiplier
        * (1 - time_fraction)
    )
    if construction.name in ["small_water_dam", "large_water_dam", "watermill"]:
        refund *= construction.multiplier_2
    player.money += refund
    player.remove_from_list(priority_list_name, construction_id)
    db.session.delete(construction)
    engine.log(f"{player.username} cancelled the construction {construction.name}")
    db.session.commit()
    websocket.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "money": player.money,
        "constructions": package_projects_data(player),
    }


def decrease_project_priority(player, construction_id, pausing=False):
    """this function is executed when a player changes the order of ongoing constructions"""
    engine = current_app.config["engine"]
    construction: OngoingConstruction = OngoingConstruction.query.get(int(construction_id))

    if construction.family == "Technologies":
        attr = "research_priorities"
    else:
        attr = "construction_priorities"

    id_list = player.read_list(attr)
    index = id_list.index(construction_id)
    if index >= 0 and index < len(id_list) - 1:
        construction_1: OngoingConstruction = OngoingConstruction.query.get(id_list[index])
        construction_2: OngoingConstruction = OngoingConstruction.query.get(id_list[index + 1])
        if construction_1.suspension_time is None and construction_2.suspension_time is not None:
            construction_1.suspension_time = engine.data["total_t"]
            if pausing:
                return {"response": "paused"}
            if construction_2.family in [
                "Functional facilities",
                "Technologies",
            ]:
                first_lvl: OngoingConstruction = (
                    OngoingConstruction.query.filter_by(name=construction_2.name, player_id=player.id)
                    .order_by(OngoingConstruction.duration)
                    .first()
                )
                if first_lvl.suspension_time is None:
                    return {
                        "response": "parallelization not allowed",
                    }
                else:
                    index_first_lvl = id_list.index(first_lvl.id)
                    id_list[index + 1], id_list[index_first_lvl] = (
                        id_list[index_first_lvl],
                        id_list[index + 1],
                    )
                    construction_2 = first_lvl
            construction_2.start_time += engine.data["total_t"] - construction_2.suspension_time
            construction_2.suspension_time = None
        id_list[index + 1], id_list[index] = (
            id_list[index],
            id_list[index + 1],
        )
        setattr(player, attr, ",".join(map(str, id_list)))
        db.session.commit()
        websocket.rest_notify_constructions(engine, player)

    return {
        "response": "success",
        "constructions": package_projects_data(player),
    }


def pause_project(player, construction_id):
    """this function is executed when a player pauses or unpauses an ongoing construction"""
    engine = current_app.config["engine"]
    construction: OngoingConstruction = OngoingConstruction.query.get(int(construction_id))

    if construction.suspension_time is None:
        while construction.suspension_time is None:
            response = decrease_project_priority(player, construction_id, pausing=True)
            if response["response"] == "paused":
                break
            if construction.family == "Technologies":
                last_project = response["constructions"][2][-1]
            else:
                last_project = response["constructions"][1][-1]
            if last_project == int(construction_id):
                construction.suspension_time = engine.data["total_t"]
    else:
        if construction.family in ["Functional facilities", "Technologies"]:
            first_lvl: OngoingConstruction = (
                OngoingConstruction.query.filter_by(name=construction.name, player_id=player.id)
                .order_by(OngoingConstruction.duration)
                .first()
            )
            if first_lvl.suspension_time is None:
                return {
                    "response": "parallelization not allowed",
                }
            else:
                construction = first_lvl
        if construction.family == "Technologies":
            player.project_max_priority("research_priorities", int(construction_id))
            if player.available_lab_workers() == 0:
                research_priorities = player.read_list("research_priorities")
                project_to_pause: OngoingConstruction = OngoingConstruction.query.get(
                    research_priorities[player.lab_workers]
                )
                project_to_pause.suspension_time = engine.data["total_t"]
        else:
            player.project_max_priority("construction_priorities", int(construction_id))
            if player.available_construction_workers() == 0:
                construction_priorities = player.read_list("construction_priorities")
                project_to_pause: OngoingConstruction = OngoingConstruction.query.get(
                    construction_priorities[player.construction_workers]
                )
                project_to_pause.suspension_time = engine.data["total_t"]
        construction.start_time += engine.data["total_t"] - construction.suspension_time
        construction.suspension_time = None
    db.session.commit()
    websocket.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "constructions": package_projects_data(player),
    }
