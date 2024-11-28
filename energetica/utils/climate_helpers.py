import json
import math
import random
from datetime import datetime
from typing import TYPE_CHECKING

import numpy as np
from energetica.config.climate_events import climate_events
from energetica.database import db
from energetica.database.active_facility import ActiveFacility
from energetica.database.climate_event_recovery import ClimateEventRecovery
from energetica.database.engine_data import calculate_reference_gta, calculate_temperature_deviation
from energetica.database.map import Hex
from energetica.utils.assets import facility_destroyed
from energetica.utils.formatting import display_money

if TYPE_CHECKING:
    from energetica.database.player import Player


def climate_event_impact(engine, tile, event):
    """Creates a ClimateEventRecovery object for the event and some facilities may be destroyed by the climate event."""
    engine.log(f"{climate_events[event]['name']} on tile {tile.id}")
    engine.action_logger.info(
        json.dumps(
            {
                "timestamp": datetime.now().isoformat(),
                "action_type": "climate_event_impact",
                "tile_id": tile.id,
                "event": event,
            }
        )
    )
    if not tile.player_id:
        return
    player: Player = tile.player
    ticks_per_day = 3600 * 24 / engine.in_game_seconds_per_tick
    recovery_cost = (
        climate_events[event]["cost_fraction"] * player.config["industry"]["income_per_day"] / ticks_per_day
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
    player.notify(
        climate_events[event]["name"],
        climate_events[event]["description"].format(
            duration=round(climate_events[event]["duration"] / 3600 / 24),
            cost=display_money(recovery_cost * ticks_per_day / 24) + "/h",
        ),
    )

    # check destructions
    if random.random() < climate_events[event]["industry_destruction_chance"]:
        player.industry -= 1
        db.session.commit()
        engine.config.update_config_for_user(player)
        player.notify(
            "Destruction",
            f"Your industry hs been levelled down by 1 due to the {climate_events[event]['name']} event.",
        )
        engine.log(f"{player.username} : Industry levelled down by {climate_events[event]['name']}.")
    facilities_list = list(climate_events[event]["destruction_chance"].keys())
    facilities_at_risk = ActiveFacility.query.filter(
        ActiveFacility.player_id == player.id, ActiveFacility.facility.in_(facilities_list)
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


def check_climate_events(engine):
    """function that checks if a climate event happens on this tick"""

    def inv_cdf_sigmoid(p, inverse=False):
        latitude = 3 * np.log(math.exp((11.44 * p - 0.88) / 3) - math.exp(-1 / 3))
        latitude = max(-10.5, min(10.5, latitude))
        return round(-latitude) if inverse else round(latitude)

    def inv_cdf_normal(p):
        return round(2.5 - 3.5 * np.log(1 / (0.88 * (p + 0.02 / 0.88)) - 1))

    climate_change = engine.data["current_climate_data"].get_last_data()["temperature"]["deviation"]
    ref_temp = engine.data["current_climate_data"].get_last_data()["temperature"]["reference"]
    real_temp = climate_change + ref_temp
    ticks_per_day = 3600 * 24 / engine.in_game_seconds_per_tick

    # floods
    flood_probability = climate_events["flood"]["base_probability"] / ticks_per_day * climate_change**2
    if random.random() < flood_probability:
        # the hydro value for a flood needs to be above 20%
        hydro_tiles = Hex.query.filter(Hex.hydro > 0.2).all()
        tile = random.choice(hydro_tiles)
        climate_event_impact(engine, tile, "flood")

    # heatwaves
    heatwave_probability = 0
    if ref_temp > 14.8:
        heatwave_probability += (
            climate_events["heat_wave"]["base_probability"] / ticks_per_day * (ref_temp - 14.8) * climate_change**2
        )
    if real_temp > 14.8:
        heatwave_probability += (
            climate_events["heat_wave"]["base_probability"] / ticks_per_day * (real_temp - 14.8) ** 2
        )
    if random.random() < heatwave_probability:
        # the tile for the heatwave is chosen based on a sigmoid distribution around the equator
        random_latitude = round(inv_cdf_sigmoid(random.random()))
        latitude_tiles = Hex.query.filter(Hex.r == random_latitude).all()
        tile = random.choice(latitude_tiles)
        affected_tiles = tile.get_neighbors()
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "heat_wave")

    # coldwaves
    coldwave_probability = 0
    if ref_temp < 12.5:
        coldwave_probability += (
            climate_events["cold_wave"]["base_probability"] / ticks_per_day * (12.5 - ref_temp) * climate_change**2
        )
    if real_temp < 12.5:
        coldwave_probability += (
            climate_events["cold_wave"]["base_probability"] / ticks_per_day * (12.5 - real_temp) ** 2
        )
    if random.random() < coldwave_probability:
        # the tile for the coldwave is chosen based on a sigmoid distribution around the north pole
        random_normal = inv_cdf_sigmoid(random.random(), inverse=True)
        if random_normal < 0:
            random_latitude = math.ceil(10 + random_normal)
        else:
            random_latitude = math.floor(-10 + random_normal)
        latitude_tiles = Hex.query.filter(Hex.r == random_latitude).all()
        tile = random.choice(latitude_tiles)
        affected_tiles = tile.get_neighbors()
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "cold_wave")

    # hurricanes
    hurricane_probability = climate_events["hurricane"]["base_probability"] / ticks_per_day * climate_change**2
    if random.random() < hurricane_probability:
        random_tile_id = random.randint(1, Hex.query.count() + 1)
        tile = db.session.get(Hex, random_tile_id)
        affected_tiles = tile.get_neighbors(n=2)
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "hurricane")

    # wildfires
    wildfire_probability = 0
    if real_temp > 14:
        wildfire_probability += climate_events["wildfire"]["base_probability"] / ticks_per_day * (real_temp - 14) ** 2
    if random.random() < wildfire_probability:
        # releasing 10 kt of CO2 in the atmosphere
        engine.data["current_climate_data"].add("CO2", 10e6)
        # the tile for the wildfire is chosen based on a normal distribution around the equator
        random_latitude = inv_cdf_normal(random.random())
        latitude_tiles = Hex.query.filter(Hex.r == random_latitude).all()
        tile = random.choice(latitude_tiles)
        affected_tiles = tile.get_neighbors()
        for affected_tile in affected_tiles:
            climate_event_impact(engine, affected_tile, "wildfire")


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
                calculate_temperature_deviation(delta_t - (359 - j) * pow(6, i), seconds_per_tick, 4e10, random_seed)
            )

    return {
        "emissions": {
            "CO2": [[4e10] * 360] * 5,
        },
        "temperature": {
            "reference": ref_temp,
            "deviation": temp_deviation,
        },
    }
