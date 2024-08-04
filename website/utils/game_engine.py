"""Util functions relating to the GameEngine class"""

import json
import pickle
import random
import time
from calendar import c
from datetime import datetime
from sqlalchemy.sql import func
import numpy as np

import website.api.websocket as websocket
import website.production_update as production_update
import website.utils.assets as assets
from website import db
from website.config import climate_events
from website.database.engine_data import (calculate_reference_gta,
                                          calculate_temperature_deviation)
from website.database.map import Hex
from website.database.player_assets import (ActiveFacilities, Shipment,
                                            UnderConstruction)
from website.utils.assets import remove_asset
from website.utils.misc import save_past_data_threaded
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
        while True:
            random_tile_id = random.randint(1, Hex.query.count() + 1)
            if Hex.query.get(random_tile_id).hydro > 0.2:
                break
        engine.log(f"Flood on tile {random_tile_id}")
        tile = Hex.query.get(random_tile_id)
        flood_impact(engine, tile)

    # heatwaves
    heatwave_probability = 0
    if ref_temp > 15:
        heatwave_probability += climate_events["heat_wave"]["base_probability"] * (ref_temp-15) * climate_change**2
    if real_temp > 15:
        heatwave_probability += climate_events["heat_wave"]["base_probability"] * (real_temp-15)**2
    if random.random() < heatwave_probability:
        random_latitude = max(-10, min(10, round(np.random.normal(0, 4))))
        tile = Hex.query.filter(Hex.r == random_latitude).order_by(func.random()).first()
        engine.log(f"Heatwave on tile {tile.id}")
        heatwave_impact(engine, tile)

    # coldwaves
    coldwave_probability = 0
    if ref_temp < 12.5:
        coldwave_probability += climate_events["cold_wave"]["base_probability"] * (12.5-ref_temp) * climate_change**2
    if real_temp < 12.5:
        coldwave_probability += climate_events["cold_wave"]["base_probability"] * (12.5-real_temp)**2
    if random.random() < coldwave_probability:
        random_normal = max(-10, min(10, np.random.normal(0, 5)))
        if random_normal < 0:
            random_latitude = round(10 + random_normal)
        else:
            random_latitude = round(-10 + random_normal)
        tile = Hex.query.filter(Hex.r == random_latitude).order_by(func.random()).first()
        engine.log(f"Coldwave on tile {tile.id}")
        coldwave_impact(engine, tile)

    # hurricanes
    hurricane_probability = climate_events["hurricane"]["base_probability"] * climate_change**2
    if random.random() < hurricane_probability:
        random_tile_id = random.randint(1, Hex.query.count() + 1)
        tile = Hex.query.get(random_tile_id)
        engine.log(f"Hurricane on tile {tile.id}")
        hurricane_impact(engine, tile)

    # wildfires
    wildfire_probability = 0
    if real_temp > 14:
        wildfire_probability += climate_events["wildfire"]["base_probability"] * (real_temp-14)**2
    if random.random() < wildfire_probability:
        random_latitude = max(-10, min(10, round(np.random.normal(0, 5.5))))
        tile = Hex.query.filter(Hex.r == random_latitude).order_by(func.random()).first()
        engine.log(f"Wildfire on tile {tile.id}")
        wildfire_impact(engine, tile)


def flood_impact(engine, tile):
    pass

def heatwave_impact(engine, tile):
    pass

def coldwave_impact(engine, tile):
    pass

def hurricane_impact(engine, tile):
    pass

def wildfire_impact(engine, tile):
    pass

def data_init_climate(seconds_per_tick, random_seed, delta_t):
    """Initializes the data for the climate."""
    ref_temp = []
    temp_deviation = []
    for i in range(5):
        ref_temp.append([])
        temp_deviation.append([])
        for j in range(360):
            if i == 0 and j > 300:
                print(
                    f"res_id = {i}, tick = {delta_t - (359 - j) * pow(6, i)}, spt = {seconds_per_tick}, random_seed = {random_seed}, value = {calculate_temperature_deviation(delta_t - (359 - j) * pow(6, i), seconds_per_tick, 5e9, random_seed)}"
                )
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
    }
