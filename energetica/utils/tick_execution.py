"""Util functions relating to the GameEngine class"""

import json
import pickle
import tarfile
import time
from datetime import datetime

from energetica import production_update
from energetica.api import websocket
from energetica.database import db
from energetica.database.active_facility import ActiveFacility
from energetica.database.climate_event_recovery import ClimateEventRecovery
from energetica.database.ongoing_construction import OngoingConstruction
from energetica.database.player import Player
from energetica.database.shipment import Shipment
from energetica.utils import assets
from energetica.utils.assets import remove_asset
from energetica.utils.climate_helpers import check_climate_events
from energetica.utils.misc import save_past_data_threaded
from energetica.utils.resource_market import store_import


def state_update(engine, app):
    with engine.lock:
        _state_update(engine, app)


def _state_update(engine, app):
    """This function is called every tick to update the state of the game"""
    total_t = (time.time() - engine.data["start_date"]) / engine.clock_time
    with app.app_context():
        while engine.data["total_t"] < total_t - 1 or engine.data["total_t"] == 0:
            engine.data["total_t"] += 1
            engine.log(f"t = {engine.data['total_t']}")
            if engine.data["total_t"] % 216 == 0:
                save_past_data_threaded(app, engine)
            if (engine.data["total_t"] + engine.data["delta_t"]) % (24 * 60 * 60 / engine.clock_time) == 0:
                engine.new_daily_question()
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "action_type": "tick",
                "total_t": engine.data["total_t"],
            }
            engine.action_logger.info(json.dumps(log_entry))
            check_events_completion(engine)
            check_climate_events(engine)
            production_update.update_electricity(engine=engine)
            db.session.commit()

    # save instance every minute in case of server crash
    if engine.data["total_t"] % (60 / engine.clock_time) == 0:
        with open("instance/engine_data.pck", "wb") as file:
            pickle.dump(engine.data, file)
        with tarfile.open("checkpoints/last_checkpoint.tar.gz", "w:gz") as tar:
            tar.add("instance/")
    with app.app_context():
        # TODO: perhaps only run the below code conditionally on there being active ws connections
        websocket.rest_notify_scoreboard(engine)
        websocket.rest_notify_weather(engine)
        websocket.rest_notify_global_data(engine)


def check_events_completion(engine):
    """function that checks if projects have finished, shipments have arrived or facilities arrived at end of life"""
    # check if constructions finished
    finished_constructions = OngoingConstruction.query.filter(
        OngoingConstruction.end_tick_or_ticks_passed <= engine.data["total_t"],
        OngoingConstruction.status == 2,
    ).all()
    for fc in finished_constructions:
        assets.finish_project(fc)

    # check if shipment arrived
    arrived_shipments = Shipment.query.filter(
        Shipment.pause_tick.is_(None),
        Shipment.arrival_tick <= engine.data["total_t"],
    ).all()
    for a_s in arrived_shipments:
        store_import(a_s.player, a_s.resource, a_s.quantity)
        db.session.delete(a_s)

    # check end of lifespan of facilities
    eolt_facilities: list[ActiveFacility] = ActiveFacility.query.filter(
        ActiveFacility.end_of_life <= engine.data["total_t"]
    ).all()
    for facility in eolt_facilities:
        player = db.session.get(Player, facility.player_id)
        if facility.facility in engine.storage_facilities:
            if facility.end_of_life == engine.data["total_t"]:
                player.data.capacities.update(player, facility.facility)
            stored_energy = player.data.rolling_history.get_last_data("storage", facility.facility)
            available_capacity = player.data.capacities[facility.facility]["capacity"]
            if stored_energy > available_capacity:
                continue
        remove_asset(player, facility)

    # check end of climate events
    finished_climate_events: list[ClimateEventRecovery] = ClimateEventRecovery.query.filter(
        ClimateEventRecovery.end_tick <= engine.data["total_t"]
    ).all()
    for fce in finished_climate_events:
        db.session.delete(fce)
