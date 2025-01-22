"""Util functions relating to the GameEngine class."""

import time
from datetime import datetime

from energetica import production_update
from energetica.database.active_facility import ActiveFacility
from energetica.database.climate_event_recovery import ClimateEventRecovery
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.database.shipment import OngoingShipment
from energetica.globals import engine
from energetica.utils import assets
from energetica.utils.assets import remove_asset
from energetica.utils.climate_helpers import check_climate_events
from energetica.utils.misc import save_past_data
from energetica.utils.resource_market import store_import


def state_update():
    """Update the game state on every tick."""
    total_t = (time.time() - engine.start_date) / engine.clock_time
    while engine.total_t < total_t - 1 or engine.total_t == 0:
        tick()


@engine.with_lock
def tick():
    start = datetime.now()
    log_entry = {
        "timestamp": start.isoformat(),
        "action_type": "tick",
        "total_t": engine.total_t,
    }
    if engine.total_t == 0:
        engine.first_tick_time = time.time()
    engine.total_t += 1
    engine.log(f"t = {engine.total_t}")
    if engine.total_t % 216 == 0:
        save_past_data()
    if (engine.total_t + engine.delta_t) % (24 * 60 * 60 / engine.clock_time) == 0:
        engine.new_daily_question()
    check_events_completion()
    check_climate_events()
    production_update.update_electricity()

    log_entry["ellapsed"] = (datetime.now() - start).total_seconds()
    engine.log_action(log_entry)

    # save a checkpoint every 6 hours in case of data corruption
    if engine.total_t % (6 * 60 * 60 / engine.clock_time) == 0:
        engine.save_checkpoint()
    # save instance every 10 minutes in case of server crash or reload
    elif engine.total_t % (10 * 60 / engine.clock_time) == 0:
        engine.save()

    # with app.app_context():
    #     # TODO: perhaps only run the below code conditionally on there being active ws connections
    #     websocket.rest_notify_scoreboard()
    #     websocket.rest_notify_weather()
    #     websocket.rest_notify_global_data()


def check_events_completion():
    """Check if projects have finished, shipments have arrived or facilities arrived at end of life."""
    # check if constructions finished
    finished_constructions = list(
        OngoingProject.filter(
            lambda construction: construction.end_tick_or_ticks_passed <= engine.total_t and construction.status == 2
        )
    )
    for fc in finished_constructions:
        assets.finish_project(fc)

    # check if shipment arrived
    arrived_shipments = OngoingShipment.filter(lambda shipment: shipment.arrival_tick <= engine.total_t)
    for a_s in arrived_shipments:
        store_import(a_s.player, a_s.resource, a_s.quantity)
        player: Player = a_s.player
        a_s.delete()
        player.emit("finish_shipment", player.package_shipments())

    # check end of lifespan of facilities
    eolt_facilities = list(ActiveFacility.filter(lambda facility: facility.end_of_life <= engine.total_t))
    for facility in eolt_facilities:
        player = facility.player
        if facility.name in engine.storage_facilities:
            if facility.end_of_life == engine.total_t:
                player.capacities.update(player, facility.name)
            stored_energy = player.rolling_history.get_last_data("storage", facility.name)
            available_capacity = player.capacities[facility.name]["capacity"]
            if stored_energy > available_capacity:
                continue
        remove_asset(player, facility)

    # check end of climate events
    finished_climate_events = list(ClimateEventRecovery.filter(lambda event: event.end_tick <= engine.total_t))
    for fce in finished_climate_events:
        fce.delete()
