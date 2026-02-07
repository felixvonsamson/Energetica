"""Utility functions relating to the GameEngine class."""

import time
from datetime import datetime

from energetica import production_update
from energetica.database.active_facility import ActiveFacility
from energetica.database.climate_event_recovery import ClimateEventRecovery
from energetica.database.ongoing_project import OngoingProject
from energetica.database.ongoing_shipment import OngoingShipment
from energetica.database.player import Player
from energetica.enums import StorageFacilityType
from energetica.globals import engine
from energetica.schemas.simulate import TickAction
from energetica.utils import projects
from energetica.utils.facilities import dismantle_facility, remove_facility
from energetica.utils.climate_helpers import check_climate_events
from energetica.utils.misc import save_past_data
from energetica.utils.resource_market import store_import


def state_update() -> None:
    """Update the game state on every tick."""
    total_t = (time.time() - engine.start_date.timestamp()) / engine.clock_time
    while engine.total_t < total_t - 1 or engine.total_t == 0:
        tick()


@engine.with_lock
def tick() -> None:
    start = datetime.now()
    # if first_tick_time == start_date then the first tick time has not been defined yet
    if engine.total_t == 0 and engine.first_tick_time == engine.start_date:
        engine.first_tick_time = datetime.now()
        engine.save()
    engine.total_t += 1
    engine.log(f"t = {engine.total_t}")
    if engine.total_t % 216 == 0:
        save_past_data()
    if (engine.total_t + engine.delta_t) % (24 * 60 * 60 / engine.clock_time) == 0:
        engine.new_daily_question()
    check_events_completion()
    check_climate_events()
    production_update.update_electricity()

    log_entry = TickAction(
        timestamp=start,
        action_type="tick",
        total_t=engine.total_t,
        elapsed=(datetime.now() - start).total_seconds(),
    )
    engine.log_action(log_entry)

    # save a checkpoint every 6 hours in case of data corruption
    if engine.total_t % (6 * 60 * 60 / engine.clock_time) == 0:
        engine.save_checkpoint()
    # save instance every 10 minutes in case of server crash or reload
    elif engine.total_t % (10 * 60 / engine.clock_time) == 0:
        engine.save()

    engine.emit("tick", {"tick": engine.total_t})


def check_events_completion() -> None:
    """Check if projects have finished, shipments have arrived or facilities arrived at end of life."""
    # check if constructions finished
    finished_constructions = list(
        OngoingProject.filter(
            lambda construction: construction.end_tick_or_ticks_passed <= engine.total_t and construction.status == 2,
        ),
    )
    for fc in finished_constructions:
        projects.complete_project(fc)

    # check if shipment arrived
    arrived_shipments = list(OngoingShipment.filter(lambda shipment: shipment.arrival_tick <= engine.total_t))
    for a_s in arrived_shipments:
        store_import(a_s.player, a_s.resource, a_s.quantity)
        player: Player = a_s.player
        a_s.delete()
        player.emit("finish_shipment", player.package_shipments())

    # check end of lifespan of facilities
    new_eolt_facilities = list(ActiveFacility.filter_by(remaining_lifespan=None, decommissioning=False))
    for facility in new_eolt_facilities:
        player = facility.player
        dismantle_facility(facility)
        player.notify(
            "Decommissioning",
            (
                f"The facility {facility.display_name} reached the end of its operational lifespan and had to be "
                "decommissioned. The cost of this operation was "
                f"{round(facility.dismantle_cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
            ),
        )
        engine.log(f"The facility {facility.display_name} from {player.username} has been decommissioned.")

    # check storage facilities that are decommissioning and empty
    decommissioned_storage_facilities = list(
        ActiveFacility.filter(lambda af: af.decommissioning == True and af.facility_type in StorageFacilityType)
    )
    for facility in decommissioned_storage_facilities:
        player = facility.player
        stored_energy = player.rolling_history.get_last_data("storage", facility.facility_type)
        available_capacity = player.capacities[facility.facility_type]["capacity"]
        if stored_energy < available_capacity:
            remove_facility(facility)

    # check end of climate events
    finished_climate_events = list(ClimateEventRecovery.filter(lambda event: event.end_tick <= engine.total_t))
    for fce in finished_climate_events:
        fce.delete()
