"""Utility functions relating to the GameEngine class."""

import math
import time
from datetime import datetime, timezone
from pathlib import Path

from energetica import instance_config
from energetica import production_update
from energetica.database.active_facility import ActiveFacility
from energetica.database.climate_event_recovery import ClimateEventRecovery
from energetica.database.ongoing_project import OngoingProject
from energetica.database.ongoing_shipment import OngoingShipment
from energetica.database.player import Player
from energetica.enums import ProjectStatus, StorageFacilityType
from energetica.globals import engine
from energetica.schemas.simulate import TickAction
from energetica.utils import projects
from energetica.utils import recap
from energetica.schemas.notifications import FacilityDecommissionedPayload
from energetica.utils.facilities import dismantle_facility, remove_facility
from energetica.utils.climate_helpers import check_climate_events
from energetica.utils.misc import save_past_data
from energetica.utils.resource_market import store_import


def state_update() -> None:
    """Update the game state on every tick."""
    # active → freeze self-transition (#861): once this instance's own clock passes ``freeze_at`` the
    # sim halts — play is over. Checked here, around the catch-up loop, rather than inside ``tick()``:
    # a short-circuit *inside* ``tick()`` would never advance ``engine.total_t`` and spin the
    # ``while`` below forever. The named seam (tick_execution) is honoured; the loop is the correct
    # spot within it.
    #
    # One check before the loop (not inside it) is right: ``total_t`` is the wall-clock-now target
    # fixed at entry, and each ``tick()`` advances the sim counter *toward* it, so every tick
    # processed has simulated time ≤ now. If ``freeze_at ≤ now`` we return here; otherwise every tick
    # the loop runs is pre-``freeze_at`` in sim-time and legitimately belongs to the game — even if a
    # long post-downtime catch-up executes them a little after ``freeze_at`` in wall-clock. Re-checking
    # inside the loop would wrongly *drop* that valid pre-freeze catch-up.
    phase = instance_config.current_phase()
    if phase in ("freeze", "ended"):
        # Mint the recap on the way into freeze (T5, #863): the sim is now halted and the state is
        # final, so this is where the frozen tombstone is taken. mint-once by file existence, so the
        # repeated freeze-phase ticks (and a restart in freeze) don't re-photograph it.
        recap.mint_recap_if_needed()
        return
    # announced → active self-start (#862, T4): before ``starts_at`` the sim is paused. The process
    # runs from creation (fragment already advertised, whitelist editable) but must not tick. The
    # scheduler re-reads the phase every fire, so the instant ``now`` crosses ``starts_at`` this guard
    # clears and the loop below begins on its own — the exact mirror of the self-freeze above. The
    # guard is load-bearing, not cosmetic: the ``engine.total_t == 0`` clause in the loop would
    # otherwise fire tick 0 the moment the process comes up, starting the game during its announced
    # window.
    if phase == "announced":
        return
    # First-active re-anchor: fix the sim epoch (``start_date``) to the moment the game actually
    # becomes active, once, keyed off ``total_t == 0`` (the "never ticked" signal). At construction
    # ``start_date`` is process-start time — during an announced window that is well before
    # ``starts_at``, so leaving it there would make the catch-up ``total_t`` below span the whole
    # announced window and fast-forward the game across thousands of empty ticks the instant it
    # starts. Re-anchoring at activation (rather than at construction) also means an admin editing
    # ``starts_at`` during announced is honoured — the epoch is pinned only when play truly begins.
    # A running game (``total_t > 0``) keeps its epoch, so post-downtime catch-up is untouched; and
    # for an instance created already-active (``starts_at`` in the past, today's default) this simply
    # re-pins to ~now, matching the previous construction-time behaviour. Floored to ``clock_time`` to
    # preserve the alignment the daily-question schedule and tick math rely on (see GameEngine init).
    if engine.total_t == 0:
        with engine.lock:
            aligned = math.floor(time.time() / engine.clock_time) * engine.clock_time
            engine.start_date = datetime.fromtimestamp(aligned, tz=timezone.utc)
            engine.first_tick_time = engine.start_date  # keep the "first tick not yet defined" sentinel
            engine.save()
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
    engine.last_tick_at = datetime.now(timezone.utc)
    engine.recent_tick_timestamps.append(time.time())
    engine.log(f"t = {engine.total_t}")
    if engine.total_t % 216 == 0:
        save_past_data()
        # save_past_data() ends with engine.save(), but on coarse-mtime filesystems the
        # pickle could share a timestamp with the last data file written; touch ensures
        # engine_data.pck is strictly newest so engine.load()'s mtime check doesn't raise.
        Path("instance/engine_data.pck").touch()
    if (engine.total_t * engine.clock_time + int(engine.start_date.timestamp())) % 86400 == 9 * 3600:
        engine.new_daily_question()
    check_events_completion()
    production_update.update_electricity()
    check_climate_events()  # climate events should happen after electricity production because destruction of storage facilities will write directly into player's circular buffer, and this should write should happen on the new tick's data since values for old ticks should be considered read-only, since they represent the past, and we shouldn't rewrite the past retroactively.

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
            lambda construction: construction.end_tick_or_ticks_passed <= engine.total_t
            and construction.status == ProjectStatus.ONGOING,
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
            FacilityDecommissionedPayload(
                facility_type=facility.facility_type,
                dismantle_cost=float(facility.dismantle_cost),
            )
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
        if stored_energy <= available_capacity:
            remove_facility(facility)

    # check end of climate events
    finished_climate_events = list(ClimateEventRecovery.filter(lambda event: event.end_tick <= engine.total_t))
    for fce in finished_climate_events:
        fce.delete()
