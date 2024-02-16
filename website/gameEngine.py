"""
Here is the logic for the engine of the game
"""

import datetime
import pickle
import logging
import copy
import time
from . import db
from .database import Player, Network, Under_construction, Shipment

from .config import config, wind_power_curve, river_discharge

from .utils import (
    update_weather,
    save_past_data_threaded,
    add_asset,
    store_import,
)


# This is the engine object
class gameEngine(object):
    def __init__(engine):
        engine.config = config
        engine.socketio = None
        engine.clients = {}
        engine.websocket_dict = {}
        engine.logger = logging.getLogger("Energetica")  # Not sure what that is
        engine.init_logger()
        engine.log("engine created")

        engine.extraction_facilities = [
            "coal_mine",
            "oil_field",
            "gas_drilling_site",
            "uranium_mine",
        ]

        engine.storage_facilities = [
            "small_pumped_hydro",
            "compressed_air",
            "molten_salt",
            "large_pumped_hydro",
            "hydrogen_storage",
            "lithium_ion_batteries",
            "solid_state_batteries",
        ]

        engine.controllable_facilities = [
            "steam_engine",
            "nuclear_reactor",
            "nuclear_reactor_gen4",
            "combined_cycle",
            "gas_burner",
            "oil_burner",
            "coal_burner",
        ]

        engine.renewables = [
            "small_water_dam",
            "large_water_dam",
            "watermill",
            "onshore_wind_turbine",
            "offshore_wind_turbine",
            "windmill",
            "CSP_solar",
            "PV_solar",
        ]

        engine.wind_power_curve = wind_power_curve
        engine.river_discharge = river_discharge

        engine.data = {}
        # All data for the current day will be stored here :
        engine.data["current_data"] = {}
        engine.data["network_data"] = {}
        engine.data["current_windspeed"] = [0] * 1441  # daily windspeed in km/h
        engine.data["current_irradiation"] = [
            0
        ] * 1441  # daily irradiation in W/m2
        engine.data["current_discharge"] = [
            0
        ] * 1441  # daily river discharge rate factor
        engine.data["current_CO2"] = [0] * 1441
        now = datetime.datetime.today().time()
        engine.data["total_t"] = 0
        engine.data["current_t"] = (
            now.hour * 60 + now.minute + 1
        )  # +1 bc fist value of current day has to be last value of last day
        engine.data[
            "start_date"
        ] = datetime.datetime.today()  # 0 point of server time

        with open("website/static/data/industry_demand.pck", "rb") as file:
            engine.industry_demand = pickle.load(
                file
            )  # array of length 1440 of normalized daily industry demand variations
        with open("website/static/data/industry_demand_year.pck", "rb") as file:
            engine.industry_seasonal = pickle.load(
                file
            )  # array of length 51 of normalized yearly industry demand variations

        update_weather(engine)

    def init_logger(engine):
        engine.logger.setLevel(logging.INFO)
        s_handler = logging.StreamHandler()
        s_handler.setLevel(logging.INFO)
        engine.logger.addHandler(s_handler)

    # reload page for all users
    def refresh(engine):
        engine.socketio.emit("refresh")

    def display_new_message(engine, msg, players=None):
        if players:
            for player in players:
                player.emit("display_new_message", msg)

    # logs a message with the current time in the terminal and stores it in 'logs'
    def log(engine, message):
        log_message = datetime.datetime.now().strftime("%H:%M:%S : ") + message
        engine.logger.info(log_message)


def clear_current_data(engine, app):
    """reset current data and network data"""
    with app.app_context():
        engine.data["current_windspeed"] = [
            engine.data["current_windspeed"][-1]
        ] + [0.0] * 1440
        engine.data["current_irradiation"] = [
            engine.data["current_irradiation"][-1]
        ] + [0.0] * 1440
        engine.data["current_discharge"] = [
            engine.data["current_discharge"][-1]
        ] + [0.0] * 1440
        engine.data["current_CO2"] = [engine.data["current_CO2"][-1]] + [
            0
        ] * 1440

        networks = Network.query.all()
        network_data = copy.deepcopy(engine.data["network_data"])
        for network in networks:
            for element in engine.data["network_data"][network.id]:
                network_data[network.id][element].pop(0)
                data_array = engine.data["network_data"][network.id][element]
                last_value = data_array[-1]
                data_array.clear()
                data_array.extend([last_value] + [0] * 1440)


from .production_update import update_electricity  # noqa: E402


# function that is executed once every 1 minute :
def state_update_m(engine, app):
    total_t = (
        datetime.datetime.now() - engine.data["start_date"]
    ).total_seconds() / 5.0  # 60.0 or 5.0
    while engine.data["total_t"] < total_t:
        engine.data["current_t"] += 1
        # print(f"t = {engine.data['current_t']}")
        engine.data["total_t"] += 1
        if engine.data["total_t"] % 60 == 0:
            save_past_data_threaded(app, engine)
        if engine.data["current_t"] > 1440:
            engine.data["current_t"] = 1
            clear_current_data(engine, app)
        with app.app_context():
            if engine.data["current_t"] % 10 == 1:
                engine.config.update_mining_productivity()
                update_weather(engine)
            update_electricity(engine)

        # save engine every minute in case of server crash
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)


# function that is executed once every 1 second :
def check_upcoming_actions(app):
    with app.app_context():
        # check if constructions finished
        finished_constructions = Under_construction.query.filter(
            Under_construction.suspension_time.is_(None)
        ).filter(
            Under_construction.start_time + Under_construction.duration
            < time.time()
        )
        if finished_constructions:
            for fc in finished_constructions:
                add_asset(fc.player_id, fc.id)
            finished_constructions.delete()
            db.session.commit()

        # check if shipment arrived
        arrived_shipments = (
            Shipment.query.filter(Shipment.departure_time.isnot(None))
            .filter(Shipment.suspension_time.is_(None))
            .filter(Shipment.departure_time + Shipment.duration < time.time())
        )
        if arrived_shipments:
            for a_s in arrived_shipments:
                store_import(a_s.player, a_s.resource, a_s.quantity)
            arrived_shipments.delete()
            db.session.commit()
