"""Util functions relating to the GameEngine class"""

import json
import math
import pickle
import random
import time
from datetime import datetime

import numpy as np

import website.api.websocket as websocket
import website.production_update as production_update
import website.utils.assets as assets
from website import db
from website.config import climate_events
from website.database.engine_data import calculate_reference_gta, calculate_temperature_deviation
from website.database.map import Hex
from website.database.player import Player
from website.database.player_assets import ActiveFacilities, ClimateEventRecovery, Shipment, UnderConstruction
from website.utils.assets import facility_destroyed, remove_asset
from website.utils.formatting import display_money
from website.utils.misc import notify, save_past_data_threaded
from website.utils.resource_market import store_import


def state_update(engine, app):
    """This function is called every tick to update the state of the game"""
    total_t = (time.time() - engine.data["start_date"]) / engine.clock_time
    while engine.data["total_t"] < total_t - 1:
        engine.data["total_t"] += 1
        engine.log(f"t = {engine.data['total_t']}")
        if engine.data["total_t"] % 216 == 0:
            save_past_data_threaded(app, engine)
        with app.app_context():
            if engine.data["total_t"] % (600 / engine.clock_time) == 0:
                engine.data["weather"].update_weather(engine)
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "endpoint": "update_electricity",
                "total_t": engine.data["total_t"],
            }
            engine.action_logger.info(json.dumps(log_entry))
            production_update.update_electricity(engine=engine)
            check_finished_constructions(engine)
            check_climate_events(engine)

    # save engine every minute in case of server crash
    if engine.data["total_t"] % (60 / engine.clock_time) == 0:
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)
    with app.app_context():
        # TODO: perhaps only run the below code conditionally on there being active ws connections
        websocket.rest_notify_scoreboard(engine)
        websocket.rest_notify_weather(engine)
        websocket.rest_notify_global_data(engine)


def check_finished_constructions(engine):
    """function that checks if projects have finished, shipments have arrived or facilities arrived at end of life"""
    # check if constructions finished
    finished_constructions = UnderConstruction.query.filter(
        UnderConstruction.suspension_time.is_(None),
        UnderConstruction.start_time + UnderConstruction.duration <= engine.data["total_t"],
    ).all()
    if finished_constructions:
        for fc in finished_constructions:
            assets.add_asset(fc.player_id, fc.id)
            db.session.delete(fc)
        db.session.commit()

    # check if shipment arrived
    arrived_shipments = Shipment.query.filter(
        Shipment.departure_time.isnot(None),
        Shipment.suspension_time.is_(None),
        Shipment.departure_time + Shipment.duration <= engine.data["total_t"],
    ).all()
    if arrived_shipments:
        for a_s in arrived_shipments:
            store_import(a_s.player, a_s.resource, a_s.quantity)
            db.session.delete(a_s)
        db.session.commit()

    # check end of lifespan of facilities
    eolt_facilities = ActiveFacilities.query.filter(ActiveFacilities.end_of_life <= engine.data["total_t"]).all()
    if eolt_facilities:
        for facility in eolt_facilities:
            remove_asset(facility.player_id, facility)
        db.session.commit()


def check_climate_events(engine):
    """function that checks if a climate event happens on this tick"""
    climate_change = engine.data["current_climate_data"].get_last_data()["temperature"]["deviation"]
    ref_temp = engine.data["current_climate_data"].get_last_data()["temperature"]["reference"]
    real_temp = climate_change + ref_temp

    # floods
    flood_probability = climate_events["flood"]["base_probability"] * climate_change**2
    if random.random() < flood_probability:
        # the hydro value for a flood needs to be above 20%
        hydro_tiles = Hex.query.filter(Hex.hydro > 0.2).all()
        tile = random.choice(hydro_tiles)
        climate_event_impact(engine, tile, "flood")

    # heatwaves
    heatwave_probability = 0
    if ref_temp > 15:
        heatwave_probability += climate_events["heat_wave"]["base_probability"] * (ref_temp - 15) * climate_change**2
    if real_temp > 15:
        heatwave_probability += climate_events["heat_wave"]["base_probability"] * (real_temp - 15) ** 2
    if random.random() < heatwave_probability:
        # the tile for the heatwave is chosen based on a normal distribution around the equator
        random_latitude = max(-10, min(10, round(np.random.normal(0, 4))))
        latitude_tiles = Hex.query.filter(Hex.r == random_latitude).all()
        tile = random.choice(latitude_tiles)
        affected_tiles = tile.get_neighbors()
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "heat_wave")

    # coldwaves
    coldwave_probability = 0
    if ref_temp < 12.5:
        coldwave_probability += climate_events["cold_wave"]["base_probability"] * (12.5 - ref_temp) * climate_change**2
    if real_temp < 12.5:
        coldwave_probability += climate_events["cold_wave"]["base_probability"] * (12.5 - real_temp) ** 2
    if random.random() < coldwave_probability:
        # the tile for the coldwave is chosen based on a normal distribution around the poles
        random_normal = max(-10, min(10, np.random.normal(0, 5)))
        if random_normal < 0:
            random_latitude = round(10 + random_normal)
        else:
            random_latitude = round(-10 + random_normal)
        latitude_tiles = Hex.query.filter(Hex.r == random_latitude).all()
        tile = random.choice(latitude_tiles)
        affected_tiles = tile.get_neighbors()
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "cold_wave")

    # hurricanes
    hurricane_probability = climate_events["hurricane"]["base_probability"] * climate_change**2
    if random.random() < hurricane_probability:
        random_tile_id = random.randint(1, Hex.query.count() + 1)
        tile = Hex.query.get(random_tile_id)
        affected_tiles = tile.get_neighbors(n=2)
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "hurricane")

    # wildfires
    wildfire_probability = 0
    if real_temp > 14:
        wildfire_probability += climate_events["wildfire"]["base_probability"] * (real_temp - 14) ** 2
    if random.random() < wildfire_probability:
        # the tile for the wildfire is chosen based on a normal distribution around the equator
        random_latitude = max(-10, min(10, round(np.random.normal(0, 5.5))))
        latitude_tiles = Hex.query.filter(Hex.r == random_latitude).all()
        tile = random.choice(latitude_tiles)
        affected_tiles = tile.get_neighbors()
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "wildfire")


def climate_event_impact(engine, tile, event):
    """Creates a ClimateEventRecovery object for the event and some facilities may be destroyed by the climate event."""
    engine.log(f"{climate_events[event]['name']} on tile {tile.id}")
    if not tile.player_id:
        return
    player: Player = tile.player
    ticks_per_day = 3600 * 24 / engine.in_game_seconds_per_tick
    recovery_cost = (
        climate_events[event]["cost_fraction"] * engine.config[player.id]["industry"]["income_per_day"] / ticks_per_day
    )  # [¤/tick]
    duration_ticks = math.ceil(climate_events[event]["duration"] / engine.in_game_seconds_per_tick)
    new_climate_event = ClimateEventRecovery(
        event=event,
        start_time=engine.data["total_t"],
        duration=duration_ticks,
        recovery_cost=recovery_cost,
        player_id=player.id,
    )
    db.session.add(new_climate_event)
    db.session.commit()
    notify(
        climate_events[event]["name"],
        climate_events[event]["description"].format(
            duration=round(climate_events[event]["duration"] / 3600 / 24),
            cost=display_money(recovery_cost * ticks_per_day / 24) + "/h",
        ),
        player,
    )

    # check destructions
    if random.random() < climate_events[event]["industry_destruction_chance"]:
        player.industry -= 1
        db.session.commit()
        engine.config.update_config_for_user(player.id)
        notify(
            "Destruction",
            f"Your industry hs been levelled down by 1 due to the {climate_events[event]['name']} event.",
            player,
        )
        engine.log(f"{player.username} : Industry levelled down by {climate_events[event]['name']}.")
    facilities_list = list(climate_events[event]["destruction_chance"].keys())
    facilities_at_risk = ActiveFacilities.query.filter(
        ActiveFacilities.player_id == player.id, ActiveFacilities.facility.in_(facilities_list)
    ).all()
    for facility in facilities_at_risk:
        if random.random() < climate_events[event]["destruction_chance"][facility.facility]:
            facility_destroyed(player, facility, climate_events[event]["name"])
            # if a water dam is destroyed it will flood downstream tiles
            if facility.facility == "small_water_dam":
                affected_tiles = tile.get_downstream_tiles(3)
                for affected_tile in affected_tiles:
                    climate_event_impact(engine, affected_tile, "flood")
            elif facility.facility == "large_water_dam":
                affected_tiles = tile.get_downstream_tiles(15)
                for affected_tile in affected_tiles:
                    climate_event_impact(engine, affected_tile, "flood")


def data_init_climate(seconds_per_tick, random_seed, delta_t):
    """Initializes the data for the climate."""
    ref_temp = []
    temp_deviation = []
    for i in range(5):
        ref_temp.append([])
        temp_deviation.append([])
        for j in range(360):
            ref_temp[i].append(calculate_reference_gta(delta_t - (359 - j) * pow(6, i), seconds_per_tick))
            temp_deviation[i].append(
                calculate_temperature_deviation(delta_t - (359 - j) * pow(6, i), seconds_per_tick, 5e9, random_seed)
            )

    return {
        "emissions": {
            "CO2": [[5e9] * 360] * 5,
        },
        "temperature": {
            "reference": ref_temp,
            "deviation": temp_deviation,
        },
    }
