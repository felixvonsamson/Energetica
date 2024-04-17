"""
Here is the logic for the engine of the game
"""

from datetime import datetime
import pickle
import logging
import time

from .database.engine_data import EmissionData, WeatherData
from . import db
from .database.player_assets import (
    Under_construction,
    Shipment,
    Active_facilites,
)
from website.api import ws

from .config import config, const_config

from .utils import (
    save_past_data_threaded,
    add_asset,
    store_import,
    remove_asset,
    check_construction_parity,
)


# This is the engine object
class gameEngine(object):
    def __init__(engine, clock_time):
        engine.clock_time = clock_time
        engine.config = config
        engine.const_config = const_config["assets"]
        engine.socketio = None
        engine.clients = {}
        engine.websocket_dict = {}
        engine.logger = logging.getLogger("Energetica")  # Not sure what that is
        engine.init_logger()
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
        engine.data["delta_t"] = round(
            (engine.data["start_date"] - start_day).total_seconds()
            // engine.clock_time
        )
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
        formatted_datetime = datetime.now().strftime("%H:%M:%S : ")
        engine.logger.info(formatted_datetime + str(message))

    def warn(engine, message):
        formatted_datetime = datetime.now().strftime("%H:%M:%S : ")
        engine.logger.warn(formatted_datetime + str(message))


from .production_update import update_electricity  # noqa: E402


# function that is executed once every 1 minute :
def state_update(engine, app):
    check_upcoming_actions(engine, app)
    total_t = (
        datetime.now() - engine.data["start_date"]
    ).total_seconds() / engine.clock_time
    while engine.data["total_t"] < total_t:
        engine.data["total_t"] += 1
        # print(f"t = {engine.data['total_t']}")
        if engine.data["total_t"] % 60 == 0:
            save_past_data_threaded(app, engine)
        with app.app_context():
            if engine.data["total_t"] % (600 / engine.clock_time) == 0:
                engine.data["weather"].update_weather(engine)
            update_electricity(engine)

    # save engine every minute in case of server crash
    if engine.data["total_t"] % (60 / engine.clock_time) == 0:
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)
    with app.app_context():
        ws.rest_notify_scoreboard(engine)
        ws.rest_notify_weather(engine)


def check_upcoming_actions(engine, app):
    """function that checks if projects have finished, shipments have arrived or facilities arrived at end of life"""
    with app.app_context():
        # check if constructions finished
        finished_constructions = Under_construction.query.filter(
            Under_construction.suspension_time.is_(None),
            Under_construction.start_time + Under_construction.duration
            < time.time() + 0.8 * engine.clock_time,
        ).all()
        engine.log(finished_constructions)
        if finished_constructions:
            for fc in finished_constructions:
                add_asset(fc.player_id, fc.id)
                print(
                    f"removing construction {fc.id} from Under_construction (check_upcoming_actions)"
                )
                db.session.delete(fc)
            db.session.commit()
            check_construction_parity()

        # check if shipment arrived
        arrived_shipments = Shipment.query.filter(
            Shipment.departure_time.isnot(None),
            Shipment.suspension_time.is_(None),
            Shipment.departure_time + Shipment.duration
            < time.time() + 0.8 * engine.clock_time,
        ).all()
        if arrived_shipments:
            for a_s in arrived_shipments:
                store_import(a_s.player, a_s.resource, a_s.quantity)
                db.session.delete(a_s)
            db.session.commit()

        # check end of lifetime of facilites
        eolt_facilities = Active_facilites.query.filter(
            Active_facilites.end_of_life < time.time() + 0.8 * engine.clock_time
        ).all()
        if eolt_facilities:
            for facility in eolt_facilities:
                remove_asset(facility.player_id, facility.facility)
                db.session.delete(facility)
            db.session.commit()
