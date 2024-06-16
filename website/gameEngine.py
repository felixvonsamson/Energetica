"""
Here is the logic for the engine of the game
"""

from collections import defaultdict
from datetime import datetime
import pickle
import json
import logging

from .database.engine_data import EmissionData, WeatherData
from . import db
from .database.player_assets import (
    Under_construction,
    Shipment,
    Active_facilities,
)
from website import utils
from website.api import websocket

from .config import config, const_config


# This is the engine object
class gameEngine(object):
    def __init__(engine, clock_time):
        engine.clock_time = clock_time
        engine.config = config
        engine.const_config = const_config
        engine.socketio = None
        engine.clients = defaultdict(list)
        engine.websocket_dict = {}
        engine.console_logger = logging.getLogger("console")  # logs events in the terminal
        engine.action_logger = logging.getLogger("action_history")  # logs all called functions to a file
        engine.init_loggers()
        engine.log("engine created")

        engine.power_facilities = [
            "steam_engine",
            "windmill",
            "watermill",
            "coal_burner",
            "oil_burner",
            "gas_burner",
            "small_water_dam",
            "onshore_wind_turbine",
            "combined_cycle",
            "nuclear_reactor",
            "large_water_dam",
            "CSP_solar",
            "PV_solar",
            "offshore_wind_turbine",
            "nuclear_reactor_gen4",
        ]

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

        engine.functional_facilities = [
            "laboratory",
            "warehouse",
            "industry",
            "carbon_capture",
        ]

        engine.technologies = [
            "mathematics",
            "mechanical_engineering",
            "thermodynamics",
            "physics",
            "building_technology",
            "mineral_extraction",
            "transport_technology",
            "materials",
            "civil_engineering",
            "aerodynamics",
            "chemistry",
            "nuclear_engineering",
        ]

        engine.data = {}
        # All data for the current day will be stored here :
        engine.data["player_capacities"] = {}
        engine.data["current_data"] = {}
        engine.data["network_data"] = {}
        engine.data["weather"] = WeatherData()
        engine.data["emissions"] = EmissionData()
        engine.data["total_t"] = 0
        engine.data["start_date"] = datetime.today()
        # 0 point of server time
        start_day = datetime(
            engine.data["start_date"].year,
            engine.data["start_date"].month,
            engine.data["start_date"].day,
        )
        engine.data["delta_t"] = round((engine.data["start_date"] - start_day).total_seconds() // engine.clock_time)
        # time shift for daily industry variation

        # stored the levels of technology of the server
        # for each tech an array stores [# players with lvl 1, # players with lvl 2, ...]
        engine.data["technology_lvls"] = {
            "mathematics": [0],
            "mechanical_engineering": [0],
            "thermodynamics": [0],
            "physics": [0],
            "building_technology": [0],
            "mineral_extraction": [0],
            "transport_technology": [0],
            "materials": [0],
            "civil_engineering": [0],
            "aerodynamics": [0],
            "chemistry": [0],
            "nuclear_engineering": [0],
        }

        with open("website/static/data/industry_demand.pck", "rb") as file:
            engine.industry_demand = pickle.load(
                file
            )  # array of length 1440 of normalized daily industry demand variations
        with open("website/static/data/industry_demand_year.pck", "rb") as file:
            engine.industry_seasonal = pickle.load(
                file
            )  # array of length 51 of normalized yearly industry demand variations

        engine.data["weather"].update_weather(engine)

    def init_loggers(engine):
        engine.console_logger.setLevel(logging.INFO)
        s_handler = logging.StreamHandler()
        s_handler.setLevel(logging.INFO)
        console_format = logging.Formatter("%(asctime)s : %(message)s", datefmt="%H:%M:%S")
        s_handler.setFormatter(console_format)
        engine.console_logger.addHandler(s_handler)

        engine.action_logger.setLevel(logging.INFO)
        f_handler = logging.FileHandler("instance/actions_history.log")
        f_handler.setLevel(logging.INFO)
        engine.action_logger.addHandler(f_handler)

    # reload page for all users
    def refresh(engine):
        engine.socketio.emit("refresh")

    def display_new_message(engine, message, players=None):
        if players:
            for player in players:
                player.emit(
                    "display_new_message",
                    {
                        "time": message.time.isoformat(),
                        "player_id": message.player_id,
                        "text": message.text,
                        "chat_id": message.chat_id,
                    },
                )

    # logs a message with the current time in the terminal
    def log(engine, message):
        engine.console_logger.info(message)

    def warn(engine, message):
        engine.console_logger.warn(message)


from .production_update import update_electricity  # noqa: E402


# function that is executed once every 1 minute :
def state_update(engine, app):
    total_t = (datetime.now() - engine.data["start_date"]).total_seconds() / engine.clock_time
    while engine.data["total_t"] < total_t:
        engine.data["total_t"] += 1
        # print(f"t = {engine.data['total_t']}")
        if engine.data["total_t"] % 216 == 0:
            utils.save_past_data_threaded(app, engine)
        with app.app_context():
            if engine.data["total_t"] % (600 / engine.clock_time) == 0:
                engine.data["weather"].update_weather(engine)
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "endpoint": "update_electricity",
                "total_t": engine.data["total_t"],
            }
            engine.action_logger.info(json.dumps(log_entry))
            update_electricity(engine=engine)
            check_finished_constructions(engine, app)

    # save engine every minute in case of server crash
    if engine.data["total_t"] % (60 / engine.clock_time) == 0:
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)
    with app.app_context():
        websocket.rest_notify_scoreboard(engine)
        websocket.rest_notify_weather(engine)


def check_finished_constructions(engine, app):
    """function that checks if projects have finished, shipments have arrived or facilities arrived at end of life"""
    # check if constructions finished
    finished_constructions = Under_construction.query.filter(
        Under_construction.suspension_time.is_(None),
        Under_construction.start_time + Under_construction.duration <= engine.data["total_t"],
    ).all()
    engine.log(finished_constructions)
    if finished_constructions:
        for fc in finished_constructions:
            utils.add_asset(fc.player_id, fc.id)
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
            utils.store_import(a_s.player, a_s.resource, a_s.quantity)
            db.session.delete(a_s)
        db.session.commit()

    # check end of lifespan of facilites
    eolt_facilities = Active_facilities.query.filter(Active_facilities.end_of_life <= engine.data["total_t"]).all()
    if eolt_facilities:
        for facility in eolt_facilities:
            utils.remove_asset(facility.player_id, facility)
        db.session.commit()
