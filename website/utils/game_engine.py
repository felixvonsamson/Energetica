"""Util functions relating to the GameEngine class"""

import json
import pickle
import time
from datetime import datetime

import website.api.websocket as websocket
import website.production_update as production_update
import website.utils.assets as assets
from website import db
from website.database.engine_data import calculate_reference_gta, calculate_temperature_deviation
from website.database.player_assets import ActiveFacilities, Shipment, UnderConstruction
from website.utils.assets import remove_asset
from website.utils.misc import save_past_data_threaded
from website.utils.resource_market import store_import


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
