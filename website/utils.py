"""
I dumped all small helpful functions here
"""

import math
import threading
import pickle
import os
import numpy as np
import shutil
from datetime import datetime, timedelta
from pathlib import Path


from website.api import websocket
from .database.engine_data import CircularBufferNetwork, CircularBufferPlayer, CapacityData
from .database.messages import Chat, Notification, Message
from .database.player import Network, Player, PlayerUnreadMessages
from .database.player_assets import (
    Resource_on_sale,
    Shipment,
    Under_construction,
    Active_facilities,
)
from website import technology_effects
from . import db
from flask import current_app, flash

# Helper functions and data initialisation utilities


def flash_error(msg):
    return flash(msg, category="error")


def notify(title, message, player):
    """Creates a new notification"""
    new_notification = Notification(title=title, content=message, time=datetime.now(), player_id=player.id)
    db.session.add(new_notification)
    player.notifications.append(new_notification)
    player.emit(
        "new_notification",
        {
            "id": new_notification.id,
            "time": str(new_notification.time),
            "title": new_notification.title,
            "content": new_notification.content,
        },
    )
    db.session.commit()


def init_table(user_id):
    """initialize data table for new user and stores it as a .pck in the 'player_data' repo"""
    past_data = data_init()
    with open(f"instance/player_data/player_{user_id}.pck", "wb") as file:
        pickle.dump(past_data, file)


def add_player_to_data(engine, user_id):
    engine.data["current_data"][user_id] = CircularBufferPlayer()
    engine.data["player_capacities"][user_id] = CapacityData()
    engine.data["player_capacities"][user_id].update(user_id, None)


def data_init():
    def init_array():
        return [[0.0] * 360] * 5

    return {
        "revenues": {
            "industry": init_array(),
            "O&M_costs": init_array(),
            "exports": init_array(),
            "imports": init_array(),
            "dumping": init_array(),
        },
        "op_costs": {
            "steam_engine": init_array(),
        },
        "generation": {
            "steam_engine": init_array(),
            "imports": init_array(),
        },
        "demand": {
            "industry": init_array(),
            "construction": init_array(),
            "research": init_array(),
            "transport": init_array(),
            "exports": init_array(),
            "dumping": init_array(),
        },
        "storage": {},
        "resources": {},
        "emissions": {
            "steam_engine": init_array(),
            "construction": init_array(),
        },
    }


def save_past_data_threaded(app, engine):
    """Saves the past production data to files every hour AND remove network data older than 24h"""

    def save_data():
        with app.app_context():
            players = Player.query.all()
            for player in players:
                if player.tile is None:
                    continue
                past_data = {}
                with open(
                    f"instance/player_data/player_{player.id}.pck",
                    "rb",
                ) as file:
                    past_data = pickle.load(file)
                new_data = engine.data["current_data"][player.id].get_data()
                for category in new_data:
                    for element in new_data[category]:
                        new_el_data = new_data[category][element]
                        if element not in past_data[category]:
                            # if facility didn't exist in past data, initialize it
                            past_data[category][element] = [[0.0] * 360] * 5
                        past_el_data = past_data[category][element]
                        reduce_resolution(past_el_data, np.array(new_el_data))

                with open(
                    f"instance/player_data/player_{player.id}.pck",
                    "wb",
                ) as file:
                    pickle.dump(past_data, file)

            # remove old network files AND save past prices
            networks = Network.query.all()
            for network in networks:
                network_dir = f"instance/network_data/{network.id}/charts/"
                files = os.listdir(network_dir)
                for filename in files:
                    t_value = int(filename.split("market_t")[1].split(".pck")[0])
                    if t_value < engine.data["total_t"] - 1440:
                        os.remove(os.path.join(network_dir, filename))

                past_data = {}
                with open(
                    f"instance/network_data/{network.id}/time_series.pck",
                    "rb",
                ) as file:
                    past_data = pickle.load(file)

                new_data = engine.data["network_data"][network.id].get_data()
                for category in new_data:
                    for player_id, buffer in new_data[category].items():
                        if player_id not in past_data[category]:
                            past_data[category][player_id] = [[0.0] * 360] * 5
                        past_el_data = past_data[category][player_id]
                        reduce_resolution(past_el_data, np.array(buffer))

                with open(
                    f"instance/network_data/{network.id}/time_series.pck",
                    "wb",
                ) as file:
                    pickle.dump(past_data, file)

            # remove old notifications
            Notification.query.filter(
                Notification.title != "Tutorial",
                Notification.time < datetime.now() - timedelta(weeks=2),
            ).delete()
            db.session.commit()

            engine.log("last 216 datapoints have been saved to files")

    def reduce_resolution(array, new_values):
        """reduces resolution of current array x6, x36, x216 and x1296"""
        array[0] = array[0][len(new_values) :]
        array[0].extend(new_values)
        new_values_reduced = new_values
        for r in range(1, 4):
            new_values_reduced = np.mean(new_values_reduced.reshape(-1, 6), axis=1)
            array[r] = array[r][len(new_values_reduced) :]
            array[r].extend(new_values_reduced)
        if engine.data["total_t"] % 1296 == 0:
            array[4] = array[4][1:]
            array[4].append(np.mean(array[3][-6:]))

    thread = threading.Thread(target=save_data)
    thread.start()


# Utilities relating to managing facilities and assets


def add_asset(player_id, construction_id):
    """this function is executed when a construction of research project has finished"""
    engine = current_app.config["engine"]
    player: Player = Player.query.get(player_id)
    construction = Under_construction.query.get(construction_id)

    if construction.family in ["Technologies", "Functional facilities"]:
        if getattr(player, construction.name) == 0:
            current_data = engine.data["current_data"][player.id]
            if construction.name == "carbon_capture":
                current_data.new_subcategory("demand", construction.name)
                current_data.new_subcategory("emissions", construction.name)
                player.add_to_list("demand_priorities", construction.name)
                set_network_prices(engine, player)
            if construction.name == "warehouse":
                for resource in ["coal", "oil", "gas", "uranium"]:
                    current_data.new_subcategory("resources", resource)
            db.session.commit()

            # update advancements
            if "technology" not in player.advancements:
                if construction.name == "laboratory":
                    player.add_to_list("demand_priorities", "research")
                    set_network_prices(engine, player)
                    player.add_to_list("advancements", "technology")
                    notify(
                        "Tutorial",
                        "You have built a laboratory, you can now reseach <a href='/technology'>technologies</a> to unlock and upgrade facilities.",
                        player,
                    )
            if "warehouse" not in player.advancements:
                if construction.name == "warehouse":
                    player.add_to_list("demand_priorities", "transport")
                    set_network_prices(engine, player)
                    player.add_to_list("advancements", "warehouse")
                    notify(
                        "Tutorial",
                        "You have built a warehouse to store natural resources, you can now buy resources on the <a href='/resource_market'>resources market</a> or invest in <a href='/extraction_facilities'>extraction facilites</a> to extract your own resources from the ground.",
                        player,
                    )
            if "GHG_effect" not in player.advancements:
                if construction.name == "chemistry":
                    player.add_to_list("advancements", "GHG_effect")
                    notify(
                        "Tutorial",
                        "Scientists have discovered the greenhouse effect and have shown that climate change increases the risks of natural and social catastrophies. You can now monitor your emissions of CO2 in the <a href='/production_overview/emissions'>emissions graph</a>.",
                        player,
                    )

        setattr(player, construction.name, getattr(player, construction.name) + 1)
        db.session.commit()
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

    if Active_facilities.query.filter_by(facility=construction.name, player_id=player.id).count() == 0:
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
        if construction.name in engine.extraction_facilities + engine.storage_facilities:
            player.add_to_list("demand_priorities", construction.name)
            set_network_prices(engine, player)
        if construction.name in engine.renewables:
            player.add_to_list("self_consumption_priority", construction.name)
            set_network_prices(engine, player)
        if construction.name in engine.storage_facilities + engine.controllable_facilities:
            player.add_to_list("rest_of_priorities", construction.name)
            set_network_prices(engine, player)
        db.session.commit()

        # update advancements
        if "storage_overview" not in player.advancements:
            if construction.name in engine.storage_facilities:
                player.add_to_list("advancements", "storage_overview")
                notify(
                    "Tutorial",
                    "You have built your first storage facility, you can monitor the stored energy in the <a href='/production_overview/storage'>storage graph</a>.",
                    player,
                )

    priority_list_name = "construction_priorities"
    project_index = (
        Under_construction.query.filter(
            Under_construction.family != "Technologies",
            Under_construction.player_id == player.id,
            Under_construction.suspension_time.is_(None),
        ).count()
        - 1
    )
    if construction.family == "Technologies":
        priority_list_name = "research_priorities"
        project_index = (
            Under_construction.query.filter(
                Under_construction.family == "Technologies",
                Under_construction.player_id == player.id,
                Under_construction.suspension_time.is_(None),
            ).count()
            - 1
        )
    player.remove_from_list(priority_list_name, construction_id)
    project_priorities = player.read_list(priority_list_name)
    for priority_index, project_id in enumerate(project_priorities[:]):
        next_construction = Under_construction.query.get(project_id)
        if next_construction is None:
            print(
                f"DATABASE MISMATCH : CONSTRUCTION {project_id} OF PLAYER {player.username} DOES NOT EXIST IN UNDER_CONSTRUCTION DATABASE !!!"
            )
            break
        if next_construction.suspension_time is not None:
            if next_construction.family in [
                "Functional facilities",
                "Technologies",
            ]:
                first_lvl = (
                    Under_construction.query.filter_by(name=next_construction.name, player_id=player.id)
                    .order_by(Under_construction.duration)
                    .first()
                )
                if first_lvl.suspension_time is None:
                    if first_lvl.start_time + first_lvl.duration >= engine.data["total_t"]:
                        continue
                    else:
                        second_lvl = (
                            Under_construction.query.filter_by(name=next_construction.name, player_id=player.id)
                            .order_by(Under_construction.duration)
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
                    db.session.commit()
                    break
            next_construction.start_time += engine.data["total_t"] - next_construction.suspension_time
            next_construction.suspension_time = None
            project_priorities[priority_index], project_priorities[project_index] = (
                project_priorities[project_index],
                project_priorities[priority_index],
            )
            db.session.commit()
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
            engine.const_config["assets"][construction.name]["lifespan"]
            * technology_effects.time_multiplier()
            / engine.clock_time
        )
        new_facility = Active_facilities(
            facility=construction.name,
            end_of_life=eol,
            player_id=player.id,
            price_multiplier=construction.price_multiplier,
            power_multiplier=construction.power_multiplier,
            capacity_multiplier=construction.capacity_multiplier,
            efficiency_multiplier=construction.efficiency_multiplier,
        )
        db.session.add(new_facility)
        db.session.commit()
    if construction.family == "Technologies":
        engine.data["player_capacities"][player.id].update(player.id, None)
    else:
        engine.data["player_capacities"][player.id].update(player.id, construction.name)
    engine.config.update_config_for_user(player.id)


def upgrade_facility(player, facility_id):
    """this function is executed when a player upgrades a facility"""

    extraction_multiplier = {
        "price_multiplier": "price_multiplier",
        "extraction_multiplier": "capacity_multiplier",
        "power_use_multiplier": "power_multiplier",
        "pollution_multiplier": "efficiency_multiplier",
    }

    def is_upgradable(facility, new_multipliers):
        if facility.facility in engine.extraction_facilities:
            for key in extraction_multiplier:
                if getattr(facility, extraction_multiplier[key]) < new_multipliers[key]:
                    return True
        else:
            for key in ["price_multiplier", "power_multiplier", "capacity_multiplier", "efficiency_multiplier"]:
                if key in new_multipliers:
                    if getattr(facility, key) < new_multipliers[key]:
                        return True
        return False

    def apply_upgrade(facility, new_multipliers):
        if facility.facility in engine.extraction_facilities:
            for key in extraction_multiplier:
                setattr(facility, extraction_multiplier[key], new_multipliers[key])
        else:
            for key in ["price_multiplier", "power_multiplier", "capacity_multiplier", "efficiency_multiplier"]:
                if key in new_multipliers:
                    setattr(facility, key, new_multipliers[key])
        db.session.commit()

    engine = current_app.config["engine"]
    facility = Active_facilities.query.get(facility_id)
    new_multipliers = technology_effects.get_current_technology_values(player)
    const_config = engine.const_config["assets"][facility.facility]

    if is_upgradable(facility, new_multipliers[facility.facility]):
        price_diff = new_multipliers[facility.facility]["price_multiplier"] - facility.price_multiplier
        if price_diff > 0:
            upgrade_cost = const_config["base_price"] * price_diff
        else:
            upgrade_cost = 0.05 * const_config["base_price"]
        if player.money < upgrade_cost:
            return {"response": "notEnoughMoney"}
        player.money -= upgrade_cost
        apply_upgrade(facility, new_multipliers[facility.facility])
        engine.data["player_capacities"][player.id].update(player.id, facility.facility)
        return {"response": "success", "money": player.money}
    else:
        return {"response": "notUpgradable"}


def dismantle_facility(player, facility_id):
    """this function is executed when a player dismantles a facility"""
    facility = Active_facilities.query.get(facility_id)
    base_price = current_app.config["engine"].const_config["assets"][facility.facility]["base_price"]
    cost = 0.2 * base_price * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.capacity_multiplier
    if player.money < cost:
        return {"response": "notEnoughMoney"}
    remove_asset(player.id, facility, decommissioning=False)
    return {"response": "success", "money": player.money}


def remove_asset(player_id, facility, decommissioning=True):
    """this function is executed when a facility is decomissioned. The removal of the facility is logged and the"""
    engine = current_app.config["engine"]
    if facility.facility in engine.technologies + engine.functional_facilities:
        return
    player = Player.query.get(player_id)
    db.session.delete(facility)
    # The cost of decommissioning is 20% of the building cost.
    cost = 0.2 * engine.const_config["assets"][facility.facility]["base_price"] * facility.price_multiplier
    if facility.facility in ["watermill", "small_water_dam", "large_water_dam"]:
        cost *= facility.capacity_multiplier
    player.money -= cost
    construction_name = engine.const_config["assets"][facility.facility]["name"]
    if decommissioning:
        notify(
            "Decommissioning",
            f"The facility {construction_name} reached the end of its operational lifespan and had to be decommissioned. The cost of this operation was {round(cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>.",
            player,
        )
        engine.log(f"The facility {construction_name} from {player.username} has been decommissioned.")
    else:
        engine.log(f"{player.username} dismanteled the facility {construction_name}.")
    engine.data["player_capacities"][player.id].update(player.id, facility.facility)
    engine.config.update_config_for_user(player.id)
    db.session.commit()


def start_project(engine, player, facility, family, force=False):
    """this function is executed when a player clicks on 'start construction'"""
    facility_info = technology_effects.get_current_technology_values(player)
    player_cap = engine.data["player_capacities"][player.id]
    const_config = engine.const_config["assets"][facility]

    if facility_info[facility]["locked"]:
        return {"response": "locked"}

    if facility in ["small_water_dam", "large_water_dam", "watermill"]:
        price_factor = technology_effects.price_multiplier(player, facility) * technology_effects.capacity_multiplier(
            player, facility
        )
        if player.money < const_config["base_price"] * price_factor:
            return {"response": "notEnoughMoneyError"}

    ud_count = 0
    if family in ["Functional facilities", "Technologies"]:
        ud_count = Under_construction.query.filter_by(name=facility, player_id=player.id).count()
        if family == "Technologies":
            for req in facility_info[facility]["requirements"]:
                if getattr(player, facility) + ud_count + req[1] > getattr(player, req[0]):
                    return {"response": "requirementsNotFulfilled"}
        real_price = (
            const_config["base_price"]
            * technology_effects.price_multiplier(player, facility)
            * const_config["price multiplier"] ** ud_count
        )
        duration = technology_effects.construction_time(player, facility) * const_config["price multiplier"] ** (
            0.6 * ud_count
        )
    else:  # power facitlies, storage facilities, extractions facilities
        real_price = const_config["base_price"] * technology_effects.price_multiplier(player, facility)
        if facility in ["small_water_dam", "large_water_dam", "watermill"]:
            real_price *= technology_effects.capacity_multiplier(player, facility)
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
    duration = math.ceil(duration / engine.clock_time)
    new_construction = Under_construction(
        name=facility,
        family=family,
        start_time=engine.data["total_t"],
        duration=duration,
        suspension_time=suspension_time,
        construction_power=construction_power,
        construction_pollution=technology_effects.construction_pollution(player, facility),
        price_multiplier=technology_effects.price_multiplier(player, facility),
        power_multiplier=technology_effects.power_multiplier(player, facility),
        capacity_multiplier=technology_effects.capacity_multiplier(player, facility),
        efficiency_multiplier=technology_effects.efficiency_multiplier(player, facility),
        player_id=player.id,
    )
    db.session.add(new_construction)
    db.session.commit()
    player.add_to_list(priority_list_name, new_construction.id)
    if suspension_time is None:
        player.project_max_priority(priority_list_name, new_construction.id)
    engine.log(f"{player.username} started the construction {facility}")
    websocket.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "money": player.money,
        "constructions": package_projects_data(player),
    }


def cancel_project(player, construction_id, force=False):
    """this function is executed when a player cancels an ongoing construction"""
    engine = current_app.config["engine"]
    construction = Under_construction.query.get(int(construction_id))

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
        refund *= construction.capacity_multiplier
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


def pause_project(player, construction_id):
    """this function is executed when a player pauses or unpauses an ongoing construction"""
    engine = current_app.config["engine"]
    construction = Under_construction.query.get(int(construction_id))

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
            first_lvl = (
                Under_construction.query.filter_by(name=construction.name, player_id=player.id)
                .order_by(Under_construction.duration)
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
                project_to_pause = Under_construction.query.get(research_priorities[player.lab_workers])
                project_to_pause.suspension_time = engine.data["total_t"]
        else:
            player.project_max_priority("construction_priorities", int(construction_id))
            if player.available_construction_workers() == 0:
                construction_priorities = player.read_list("construction_priorities")
                project_to_pause = Under_construction.query.get(construction_priorities[player.construction_workers])
                project_to_pause.suspension_time = engine.data["total_t"]
        construction.start_time += engine.data["total_t"] - construction.suspension_time
        construction.suspension_time = None
    db.session.commit()
    websocket.rest_notify_constructions(engine, player)
    return {
        "response": "success",
        "constructions": package_projects_data(player),
    }


def decrease_project_priority(player, construction_id, pausing=False):
    """this function is executed when a player changes the order of ongoing constructions"""
    engine = current_app.config["engine"]
    construction = Under_construction.query.get(int(construction_id))

    if construction.family == "Technologies":
        attr = "research_priorities"
    else:
        attr = "construction_priorities"

    id_list = player.read_list(attr)
    index = id_list.index(construction_id)
    if index >= 0 and index < len(id_list) - 1:
        construction_1 = Under_construction.query.get(id_list[index])
        construction_2 = Under_construction.query.get(id_list[index + 1])
        if construction_1.suspension_time is None and construction_2.suspension_time is not None:
            construction_1.suspension_time = engine.data["total_t"]
            if pausing:
                return {"response": "paused"}
            if construction_2.family in [
                "Functional facilities",
                "Technologies",
            ]:
                first_lvl = (
                    Under_construction.query.filter_by(name=construction_2.name, player_id=player.id)
                    .order_by(Under_construction.duration)
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


# Resource market utilities


def put_resource_on_market(player, resource, quantity, price):
    """Put an offer on the resource market"""
    if getattr(player, resource) - getattr(player, resource + "_on_sale") < quantity:
        flash_error(f"You have not enough {resource} available")
    else:
        setattr(
            player,
            resource + "_on_sale",
            getattr(player, resource + "_on_sale") + quantity,
        )
        new_sale = Resource_on_sale(
            resource=resource,
            quantity=quantity,
            price=price,
            creation_date=datetime.now(),
            player=player,
        )
        db.session.add(new_sale)
        db.session.commit()
        flash(
            f"You put {quantity/1000}t of {resource} on sale for {price*1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
            category="message",
        )


def buy_resource_from_market(player, quantity, sale_id):
    """Buy an offer from the resource market"""
    engine = current_app.config["engine"]
    sale = Resource_on_sale.query.filter_by(id=sale_id).first()
    if quantity is None or quantity <= 0 or quantity > sale.quantity:
        return {"response": "invalidQuantity"}
    total_price = sale.price * quantity
    if player == sale.player:
        # Player is buying their own resource
        sale.quantity -= quantity
        if sale.quantity == 0:
            Resource_on_sale.query.filter_by(id=sale_id).delete()
        setattr(
            player,
            sale.resource + "_on_sale",
            getattr(player, sale.resource + "_on_sale") - quantity,
        )
        db.session.commit()
        return {
            "response": "removedFromMarket",
            "quantity": quantity,
            "available_quantity": sale.quantity,
            "resource": sale.resource,
        }
    if total_price > player.money:
        return {"response": "notEnoughMoney"}
    else:
        # Player buys form another player
        sale.quantity -= quantity
        player.money -= total_price
        sale.player.money += total_price
        setattr(
            sale.player,
            sale.resource,
            getattr(sale.player, sale.resource) - quantity,
        )
        setattr(
            sale.player,
            sale.resource + "_on_sale",
            getattr(sale.player, sale.resource + "_on_sale") - quantity,
        )
        sale.player.sold_resources += quantity
        player.bought_resources += quantity
        # check achievements
        if "trading_1" not in player.achievements:
            player.add_to_list("achievements", "trading_1")
            player.xp += 5
            notify(
                "Achievements",
                "You have bought a resources on the market. (+5 xp)",
                player,
            )
        if "trading_2" not in sale.player.achievements:
            sale.player.add_to_list("achievements", "trading_2")
            sale.player.xp += 5
            notify(
                "Achievements",
                "You have sold a resources on the market. (+5 xp)",
                sale.player,
            )
        if "trading_3" not in player.achievements:
            if player.bought_resources >= 10000000:
                player.add_to_list("achievements", "trading_3")
                player.xp += 10
                notify(
                    "Achievements",
                    "You have bought more than 10'000 tons of resources. (+10 xp)",
                    player,
                )
        if "trading_3" not in sale.player.achievements:
            if sale.player.sold_resources >= 10000000:
                sale.player.add_to_list("achievements", "trading_3")
                sale.player.xp += 10
                notify(
                    "Achievements",
                    "You have sold more than 10'000 tons of resources. (+10 xp)",
                    sale.player,
                )
        dq = player.tile.q - sale.player.tile.q
        dr = player.tile.r - sale.player.tile.r
        distance = math.sqrt(2 * (dq**2 + dr**2 + dq * dr))
        shipment_duration = distance * engine.config[player.id]["transport"]["time"]
        shipment_duration = math.ceil(shipment_duration / engine.clock_time)
        new_shipment = Shipment(
            resource=sale.resource,
            quantity=quantity,
            departure_time=engine.data["total_t"],
            duration=shipment_duration,
            player_id=player.id,
        )
        db.session.add(new_shipment)
        notify(
            "Resource transaction",
            f"{player.username} bought {format_mass(quantity)} of {sale.resource} for a total cost of {display_money(total_price)}.",
            sale.player,
        )
        engine.log(
            f"{player.username} bought {format_mass(quantity)} of {sale.resource} from {sale.player.username} for a total cost of {display_money(total_price)}."
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            Resource_on_sale.query.filter_by(id=sale_id).delete()
        db.session.commit()
        return {
            "response": "success",
            "resource": sale.resource,
            "total_price": total_price,
            "quantity": quantity,
            "seller": sale.player.username,
            "available_quantity": sale.quantity,
            "shipments": player.package_shipments(),
        }


def store_import(player, resource, quantity):
    """This function is executed when a resource shippment arrives"""
    engine = current_app.config["engine"]
    max_cap = engine.config[player.id]["warehouse_capacities"][resource]
    if getattr(player, resource) + quantity > max_cap:
        setattr(player, resource, max_cap)
        # excess resources are stored in the ground
        setattr(
            player.tile,
            resource,
            getattr(player.tile, resource) + getattr(player, resource) + quantity - max_cap,
        )
        notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived, but only {format_mass(max_cap - getattr(player, resource))} could be stored in your warehouse.",
            player,
        )
        engine.log(
            f"{player.username} received a shipment of {format_mass(quantity)} {resource}, but could only store {format_mass(max_cap - getattr(player, resource))} in their warehouse."
        )
    else:
        setattr(player, resource, getattr(player, resource) + quantity)
        notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived.",
            player,
        )
        engine.log(f"{player.username} received a shipment of {format_mass(quantity)} {resource}.")


def pause_shipment(player, shipment_id):
    """this function is executed when a player pauses or unpauses an ongoing shipment"""
    engine = current_app.config["engine"]
    shipment = Shipment.query.get(int(shipment_id))

    if shipment.suspension_time is None:
        shipment.suspension_time = engine.data["total_t"]
    else:
        shipment.departure_time += engine.data["total_t"] - shipment.suspension_time
        shipment.suspension_time = None
    db.session.commit()
    return {
        "response": "success",
        "shipments": player.package_shipments(),
    }


# Text formatting utilities


def display_money(price):
    """Format for price display"""
    return f"{price:,.0f}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>".replace(",", "'")


def format_mass(mass):
    """Formats mass in kg into a string with corresponding unit."""
    if mass < 50000:
        formatted_mass = f"{int(mass):,d}".replace(",", "'") + " kg"
    else:
        formatted_mass = f"{mass / 1000:,.0f}".replace(",", "'") + " t"
    return formatted_mass


# Chat utilities


def hide_chat_disclaimer(player):
    player.show_disclamer = False
    db.session.commit()


def create_chat(player, buddy_username):
    """creates a chat with 2 players"""
    if buddy_username == player.username:
        return {"response": "cannotChatWithYourself"}
    buddy = Player.query.filter_by(username=buddy_username).first()
    if buddy is None:
        return {"response": "usernameIsWrong"}
    if check_existing_chats([player, buddy]):
        return {"response": "chatAlreadyExist"}
    new_chat = Chat(
        name=None,
        participants=[player, buddy],
    )
    db.session.add(new_chat)
    db.session.commit()
    engine = current_app.config["engine"]
    engine.log(f"{player.username} created a chat with {buddy.username}")
    return {"response": "success"}


def create_group_chat(player, title, group):
    """creates a group chat"""
    if len(title) == 0 or len(title) > 25:
        return {"response": "wrongTitleLength"}
    groupMembers = [player]
    for username in group:
        new_member = Player.query.filter_by(username=username).first()
        if new_member:
            groupMembers.append(new_member)
    if len(groupMembers) < 3:
        return {"response": "groupTooSmall"}
    if check_existing_chats(groupMembers):
        return {"response": "chatAlreadyExist"}
    new_chat = Chat(
        name=title,
        participants=groupMembers,
    )
    db.session.add(new_chat)
    db.session.commit()
    engine = current_app.config["engine"]
    engine.log(f"{player.username} created a group chat called {title} with {group}")
    return {"response": "success"}


def check_existing_chats(participants):
    """Checks if a chat with exactly these participants already exists"""
    participant_ids = [participant.id for participant in participants]
    conditions = [Chat.participants.any(id=participant_id) for participant_id in participant_ids]
    existing_chats = Chat.query.filter(*conditions)
    for chat in existing_chats:
        if len(chat.participants) == len(participants):
            return True
    return False


def add_message(player, message, chat_id):
    engine = current_app.config["engine"]
    if not chat_id:
        return {"response": "noChatID"}
    chat = Chat.query.filter_by(id=chat_id).first()
    new_message = Message(
        text=message,
        time=datetime.now(),
        player_id=player.id,
        chat_id=chat.id,
    )
    db.session.add(new_message)
    db.session.commit()
    for participant in chat.participants:
        if participant == player:
            continue
        player_read_message = PlayerUnreadMessages(player_id=participant.id, message_id=new_message.id)
        db.session.add(player_read_message)
    db.session.commit()
    engine.display_new_message(new_message, chat.participants)
    return {"response": "success"}


# Map


def confirm_location(engine, player, location):
    """This function is called when a player choses a location. It returns
    either success or an explanatory error message in the form of a dictionary.
    It is called when a web client uses the choose_location socket.io endpoint,
    or the REST websocket API."""
    if location.player_id is not None:
        # Location already taken
        return {"response": "locationOccupied", "by": location.player_id}
    if player.tile is not None:
        # Player has already chosen a location and cannot chose again
        return {"response": "choiceUnmodifiable"}
    # Checks have succeeded, proceed
    location.player_id = player.id
    eol = engine.data["total_t"] + math.ceil(
        engine.const_config["assets"]["steam_engine"]["lifespan"]
        * technology_effects.time_multiplier()
        / engine.clock_time
    )
    steam_engine = Active_facilities(
        facility="steam_engine",
        end_of_life=eol,
        player_id=player.id,
        price_multiplier=1.0,
        power_multiplier=1.0,
        capacity_multiplier=1.0,
        efficiency_multiplier=1.0,
    )
    db.session.add(steam_engine)
    db.session.commit()
    add_player_to_data(engine, player.id)
    init_table(player.id)
    websocket.rest_notify_player_location(engine, player)
    engine.log(f"{player.username} chose the location {location.id}")
    return {"response": "success"}


# Network utilities


def join_network(engine, player, network):
    """shared API method to join a network."""
    if network is None:
        # print("utils.join_network: argument network was `None`")
        return {"response": "noSuchNetwork"}
    if player.network is not None:
        # print("utils.join_network: argument network was `None`")
        return {"response": "playerAlreadyInNetwork"}
    player.network = network
    db.session.commit()
    engine.log(f"{player.username} joined the network {network.name}")
    websocket.rest_notify_network_change(engine)
    return {"response": "success"}


def create_network(engine, player, name):
    """shared API method to create a network. Network name must pass validation,
    namely it must not be too long, nor too short, and must not already be in
    use."""
    if len(name) < 3 or len(name) > 40:
        return {"response": "nameLengthInvalid"}
    if Network.query.filter_by(name=name).first() is not None:
        return {"response": "nameAlreadyUsed"}
    new_network = Network(name=name, members=[player])
    db.session.add(new_network)
    db.session.commit()
    network_path = f"instance/network_data/{new_network.id}"
    Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)
    engine.data["network_data"][new_network.id] = CircularBufferNetwork()
    past_data = data_init_network()
    Path(f"{network_path}").mkdir(parents=True, exist_ok=True)
    with open(f"{network_path}/time_series.pck", "wb") as file:
        pickle.dump(past_data, file)
    engine.log(f"{player.username} created the network {name}")
    websocket.rest_notify_network_change(engine)
    return {"response": "success"}


def data_init_network():
    return {
        "network_data": {
            "price": [[0.0] * 360] * 5,
            "quantity": [[0.0] * 360] * 5,
        },
        "exports": {},
        "imports": {},
    }


def leave_network(engine, player):
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        return {"response": "playerNotInNetwork"}
    player.network_id = None
    remaining_members_count = Player.query.filter_by(network_id=network.id).count()
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        shutil.rmtree(f"instance/network_data/{network.id}")
        db.session.delete(network)
    db.session.commit()
    engine.log(f"{player.username} left the network {network.name}")
    websocket.rest_notify_network_change(engine)
    return {"response": "success"}


def set_network_prices(engine, player, prices={}):
    """this function is executed when a player changes the value the enegy selling prices"""

    def sort_priority(priority_list, prefix="price_"):
        return sorted(priority_list, key=lambda x: getattr(player, prefix + x))

    def sort_SCP(SCP_list):
        return sorted(SCP_list, key=lambda x: engine.renewables.index(x))

    for price in prices:
        if prices[price] <= -5:
            return {"response": "priceTooLow"}
        setattr(player, price, prices[price])

    rest_list = sort_priority(player.read_list("rest_of_priorities"))
    SCP_list = sort_SCP(player.read_list("self_consumption_priority"))
    demand_list = sort_priority(player.read_list("demand_priorities"), prefix="price_buy_")
    demand_list.reverse()

    engine.log(f"{player.username} updated their prices")

    comma = ","
    player.self_consumption_priority = comma.join(SCP_list)
    player.rest_of_priorities = comma.join(rest_list)
    player.demand_priorities = comma.join(demand_list)
    db.session.commit()
    return {"response": "success"}


# Misc


def change_facility_priority(engine, player, priority):
    price_list = []
    for facility in priority:
        price_list.append(getattr(player, "price_" + facility))
    price_list.sort()
    prices = {}
    for i, facility in enumerate(priority):
        prices["price_" + facility] = price_list[i]
    return set_network_prices(engine, player, prices)
