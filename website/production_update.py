"""The game states update functions are defined here"""

import math
import pickle
from datetime import datetime, timedelta
from typing import List

import numpy as np
import pandas as pd
from noise import pnoise3
from pvlib.location import Location

from . import db
from .config.assets import wind_power_curve
from .database.player import Network, Player
from .database.player_assets import ActiveFacility, OngoingConstruction, Shipment

resource_to_extraction = {
    "coal": "coal_mine",
    "gas": "gas_drilling_site",
    "uranium": "uranium_mine",
}

extraction_to_resource = {
    "coal_mine": "coal",
    "gas_drilling_site": "gas",
    "uranium_mine": "uranium",
}


def update_electricity(engine):
    """Update the electricity generation and storage status for all players"""
    # calculate new co2 and temperature values
    engine.data["current_climate_data"].init_new_value()
    players = Player.query.all()
    networks = Network.query.all()

    new_values = {}
    for player in players:
        if player.tile is None:
            continue
        new_values[player.id] = engine.data["current_data"][player.id].init_new_data()

    for network in networks:
        market = init_market()
        for player in network.members:
            calculate_demand(engine, new_values[player.id], player)
            market = calculate_generation_with_market(engine, new_values, market, player)
        market_logic(engine, new_values, market)
        # Save market data
        new_network_values = {
            "network_data": {
                "price": market["market_price"],
                "quantity": market["market_quantity"],
            },
            "exports": market["player_exports"],
            "imports": market["player_imports"],
            "generation": market["generation"],
            "consumption": market["consumption"],
        }
        engine.data["network_data"][network.id].append_value(new_network_values)
        for player in network.members:
            player.emit(
                "new_network_values",
                {
                    "total_t": engine.data["total_t"],
                    "network_values": new_network_values,
                },
            )
        with open(
            f"instance/network_data/{network.id}/charts/market_t{engine.data['total_t']}.pck",
            "wb",
        ) as file:
            pickle.dump(market, file)

    for player in players:
        if player.tile is None:
            continue
        # Power generation calculation for players that are not in a network
        if player.network is None:
            calculate_demand(engine, new_values[player.id], player)
            calculate_generation_without_market(engine, new_values, player)
        set_facilities_usage(engine, new_values[player.id], player)
        calculate_net_import(new_values[player.id])
        update_storage_lvls(engine, new_values[player.id], player)
        resources_and_pollution(engine, new_values[player.id], player)
        engine.data["current_data"][player.id].append_value(new_values[player.id])
        # add industry revenues to player money
        player.money += new_values[player.id]["revenues"]["industry"]
        update_player_progress_values(engine, player, new_values)
        # send new data to clients
        player.send_new_data(new_values[player.id])


def set_facilities_usage(engine, new_values, player):
    """Set the usage of the facilities to the database"""
    for facility in engine.controllable_facilities:
        if facility in new_values["generation"]:
            ActiveFacility.query.filter_by(player_id=player.id, facility=facility).update(
                {
                    ActiveFacility.usage: new_values["generation"][facility]
                    / engine.data["player_capacities"][player.id][facility]["power"]
                },
                synchronize_session=False,
            )
    for facility in engine.storage_facilities:
        if facility in new_values["storage"]:
            ActiveFacility.query.filter_by(player_id=player.id, facility=facility).update(
                {
                    ActiveFacility.usage: new_values["storage"][facility]
                    / engine.data["player_capacities"][player.id][facility]["capacity"]
                },
                synchronize_session=False,
            )
    for facility in engine.extraction_facilities:
        if facility in new_values["demand"]:
            ActiveFacility.query.filter_by(player_id=player.id, facility=facility).update(
                {
                    ActiveFacility.usage: new_values["demand"][facility]
                    / engine.data["player_capacities"][player.id][facility]["power_use"]
                },
                synchronize_session=False,
            )


def update_player_progress_values(engine, player, new_values):
    """This function updates the player progress values and checks for new unlocks and achievements"""
    # calculate moving average revenue
    player.average_revenues = (
        player.average_revenues
        + 3600
        / engine.in_game_seconds_per_tick
        * 0.03
        * sum(
            [new_values[player.id]["revenues"][rev] for rev in new_values[player.id]["revenues"]]
            + [new_values[player.id]["op_costs"][rev] for rev in new_values[player.id]["op_costs"]]
        )
    ) / 1.03
    # update max power consumption
    total_demand = sum([new_values[player.id]["demand"][demand] for demand in new_values[player.id]["demand"]])
    if total_demand > player.max_power_consumption:
        player.max_power_consumption = total_demand
    # update max stored energy
    total_storage = sum([new_values[player.id]["storage"][storage] for storage in new_values[player.id]["storage"]])
    if total_storage > player.max_energy_stored:
        player.max_energy_stored = total_storage
    # update imported and exported energy and converting Wt to Wh
    player.imported_energy += new_values[player.id]["generation"]["imports"] / 3600 * engine.in_game_seconds_per_tick
    player.exported_energy += new_values[player.id]["demand"]["exports"] / 3600 * engine.in_game_seconds_per_tick

    player.check_continuous_achievements()


def init_market():
    """Initialize an empty market"""
    return {
        "capacities": pd.DataFrame({"player_id": [], "capacity": [], "price": [], "facility": []}),
        "demands": pd.DataFrame({"player_id": [], "capacity": [], "price": [], "facility": []}),
    }


def update_storage_lvls(engine, new_values, player):
    """Update storage levels according to the use of storage facilities"""
    player_cap = engine.data["player_capacities"][player.id]
    generation = new_values["generation"]
    demand = new_values["demand"]
    storage = new_values["storage"]
    for facility in engine.storage_facilities:
        if player_cap[facility] is not None:
            # the energy is converted from Wt to Wh
            storage[facility] = (
                storage[facility]
                - generation[facility]
                / 3600
                * engine.in_game_seconds_per_tick
                / (player_cap[facility]["efficiency"] ** 0.5)
                + demand[facility]
                / 3600
                * engine.in_game_seconds_per_tick
                * (player_cap[facility]["efficiency"] ** 0.5)
            )


def calculate_net_import(new_values):
    """For players in network, subtract the difference between import and
    exports to ignore energy that has been bought from themselves"""
    exp = new_values["demand"]["exports"]
    imp = new_values["generation"]["imports"]
    new_values["demand"]["exports"] = max(0.0, exp - imp)
    new_values["generation"]["imports"] = max(0.0, imp - exp)
    exp_rev = new_values["revenues"]["exports"]
    imp_rev = new_values["revenues"]["imports"]
    if exp_rev < 0 or imp_rev > 0:
        new_values["revenues"]["exports"] = min(0.0, exp_rev + imp_rev)
        new_values["revenues"]["imports"] = max(0.0, exp_rev + imp_rev)
    else:
        new_values["revenues"]["exports"] = max(0.0, exp_rev + imp_rev)
        new_values["revenues"]["imports"] = min(0.0, exp_rev + imp_rev)


def extraction_facility_demand(engine, new_values, player, player_cap, demand):
    """Calculate power consumption of extraction facilities"""
    player_resources = new_values["resources"]
    warehouse_caps = engine.config[player.id]["warehouse_capacities"]
    for resource, facility in resource_to_extraction.items():
        if player_cap[facility] is not None:
            max_warehouse = warehouse_caps[resource] - player_resources[resource]
            max_prod = (
                player_cap[facility]["extraction_rate_per_day"]
                * getattr(player.tile, resource)
                * engine.in_game_seconds_per_tick
                / 86400  # 86400 seconds in a day
            )
            power_factor = min(1.0, max_warehouse / max(1.0, max_prod))
            demand[facility] = player_cap[facility]["power_use"] * power_factor


def industry_demand_and_revenues(engine, player, demand, revenues):
    """calculate power consumption and revenues from industry"""
    # interpolating seasonal factor on the day
    assets = engine.config[player.id]
    ticks_per_day = 3600 * 24 / engine.in_game_seconds_per_tick
    real_t = engine.data["total_t"] + engine.data["delta_t"]  # this ensures that the year starts at real time midnight
    day = round(real_t // ticks_per_day)
    sf1 = engine.industry_seasonal[day % 72]
    sf2 = engine.industry_seasonal[(day + 1) % 72]
    seasonal_factor = (sf1 * (ticks_per_day - real_t % ticks_per_day) + sf2 * (real_t % ticks_per_day)) / ticks_per_day
    intra_day_t = real_t % ticks_per_day
    intra_day_factor = engine.industry_demand[round(intra_day_t * 1440 / ticks_per_day)]
    demand["industry"] = intra_day_factor * seasonal_factor * assets["industry"]["power_consumption"]
    # calculate income of industry per tick
    revenues["industry"] = assets["industry"]["income_per_day"] / ticks_per_day
    for ud in player.under_construction:
        # industry demand ramps up during construction
        if ud.name == "industry":
            if ud.suspension_time is None:
                time_fraction = (engine.data["total_t"] - ud.start_time) / (ud.duration)
            else:
                time_fraction = (ud.suspension_time - ud.start_time) / (ud.duration)
            additional_demand = (
                time_fraction * demand["industry"] * (engine.const_config["assets"]["industry"]["power_factor"] - 1)
            )
            additional_revenue = (
                time_fraction
                * (
                    revenues["industry"]
                    - engine.const_config["assets"]["industry"]["universal_income_per_day"] / ticks_per_day
                )
                * (engine.const_config["assets"]["industry"]["income_factor"] - 1)
            )
            demand["industry"] += additional_demand
            revenues["industry"] += additional_revenue
            break


def construction_demand(player, demand):
    """calculate power consumption for facilities under construction"""
    for ud in player.under_construction:
        if ud.suspension_time is None:
            if ud.family == "Technologies":
                demand["research"] += ud.construction_power
            else:
                demand["construction"] += ud.construction_power


def shipment_demand(engine, player, demand):
    """calculate the power consumption for shipments"""
    transport = engine.config[player.id]["transport"]
    for shipment in player.shipments:
        if shipment.suspension_time is None:
            demand["transport"] += transport["power_per_kg"] * shipment.quantity


def storage_demand(engine, player, demand):
    """calculate the maximal demand of storage plants"""
    player_cap = engine.data["player_capacities"][player.id]
    for facility in engine.storage_facilities:
        if player_cap[facility] is not None:
            demand[facility] = calculate_prod(
                engine,
                "max",
                player,
                player_cap,
                facility,
                engine.data["current_data"][player.id],
                resource_reservations=None,
                storage=True,
                filling=True,
            )


def climate_event_recovery_cost(player, revenues):
    """Calculate the cost of climate events"""
    for cer in player.climate_events:
        revenues["climate_events"] -= cer.recovery_cost


def calculate_demand(engine, new_values, player):
    """Calculates the electricity demand of one player"""

    player_cap = engine.data["player_capacities"][player.id]
    demand = new_values["demand"]
    revenues = new_values["revenues"]

    extraction_facility_demand(engine, new_values, player, player_cap, demand)
    industry_demand_and_revenues(engine, player, demand, revenues)
    construction_demand(player, demand)
    shipment_demand(engine, player, demand)
    storage_demand(engine, player, demand)

    # consider cost of climate events if any
    climate_event_recovery_cost(player, revenues)

    if player.carbon_capture > 0:
        demand["carbon_capture"] = engine.config[player.id]["carbon_capture"]["power_consumption"]


def reset_resource_reservations():
    """Helper function to reset resource reservations to 0"""
    return {
        "coal": 0,
        "gas": 0,
        "uranium": 0,
    }


def calculate_generation_without_market(engine, new_values, player):
    """Calculate the generation of a player that is not part of a network"""
    internal_market = init_market()
    player_cap = engine.data["player_capacities"][player.id]
    generation = new_values[player.id]["generation"]
    demand = new_values[player.id]["demand"]
    resource_reservations = reset_resource_reservations()

    # generation of non controllable facilities is calculated from weather data
    renewables_generation(engine, player, player_cap, generation)
    minimal_generation(engine, player, player_cap, generation, resource_reservations)
    facilities = engine.storage_facilities + engine.power_facilities
    # Obligatory generation is put on the internal market at a price of -5
    for facility in facilities:
        if player_cap[facility] is not None:
            internal_market = offer(
                internal_market,
                player.id,
                generation[facility],
                -5,
                facility,
            )

    # demands are demanded on the internal market
    for demand_type in player.demand_priorities.split(","):
        if demand_type in demand:
            price = getattr(player, "price_buy_" + demand_type)
            internal_market = bid(
                internal_market,
                player.id,
                demand[demand_type],
                price,
                demand_type,
            )

    resource_reservations = reset_resource_reservations()
    # offer additional capacities of facilities on the internal market
    for facility in engine.storage_facilities + engine.controllable_facilities:
        if player_cap[facility] is not None:
            max_prod = calculate_prod(
                engine,
                "max",
                player,
                player_cap,
                facility,
                engine.data["current_data"][player.id],
                resource_reservations,
                storage=facility in engine.storage_facilities,
            )
            price = getattr(player, "price_" + facility)
            capacity = max_prod - generation[facility]
            internal_market = offer(internal_market, player.id, capacity, price, facility)

    market_logic(engine, new_values, internal_market)


def calculate_generation_with_market(engine, new_values, market, player):
    """Calculate the generation of a player that is part of a network (before market logic)"""
    player_cap = engine.data["player_capacities"][player.id]
    generation = new_values[player.id]["generation"]
    demand = new_values[player.id]["demand"]
    resource_reservations = reset_resource_reservations()

    renewables_generation(engine, player, player_cap, generation)
    minimal_generation(engine, player, player_cap, generation, resource_reservations)
    facilities = engine.storage_facilities + engine.power_facilities
    for facility in facilities:
        if player_cap[facility] is not None:
            market = offer(market, player.id, generation[facility], -5, facility)

    # bid demand on the market at the set prices
    demand_priorities = player.demand_priorities.split(",")

    # allow a maximum overdraft of the equivalent of the daily income of the industry
    max_overdraft = -engine.config[player.id]["industry"]["income_per_day"]
    if player.money < max_overdraft:
        player.notify(
            "Not Enough Money", "You exceeded your credit limit, you can't buy electricity on the market anymore."
        )
    for demand_type in demand_priorities:
        if player.money >= max_overdraft:
            bid_q = demand[demand_type]
            price = getattr(player, "price_buy_" + demand_type)
            market = bid(market, player.id, bid_q, price, demand_type)
        else:
            reduce_demand(engine, new_values, engine.data["current_data"][player.id], demand_type, player.id, 0.0)

    resource_reservations = reset_resource_reservations()
    # Sell capacities of remaining facilities on the market
    for facility in player.read_list("rest_of_priorities") + player.read_list("self_consumption_priority"):
        if engine.const_config["assets"][facility]["ramping_time"] != 0:
            if player_cap[facility] is not None:
                max_prod = calculate_prod(
                    engine,
                    "max",
                    player,
                    player_cap,
                    facility,
                    engine.data["current_data"][player.id],
                    resource_reservations,
                    storage=facility in engine.storage_facilities,
                )
                price = getattr(player, "price_" + facility)
                capacity = max_prod - generation[facility]
                market = offer(market, player.id, capacity, price, facility)

    return market


def market_logic(engine, new_values, market):
    """Calculate overall network demand,
    class all capacity offers in ascending order of price
    and find the market price of electricity.
    Sell all capacities that are below market price at market price."""

    def sell(row, market_price, quantity=None):
        """Sell and produce offered power capacity"""
        player = Player.query.get(row.player_id)
        generation = new_values[player.id]["generation"]
        demand = new_values[player.id]["demand"]
        revenue = new_values[player.id]["revenues"]
        if quantity is None:
            quantity = row.capacity
        if row.price > -5:
            generation[row.facility] += quantity
        demand["exports"] += quantity
        player.money += quantity * market_price / 3600 * engine.in_game_seconds_per_tick / 1_000_000
        revenue["exports"] += quantity * market_price / 3600 * engine.in_game_seconds_per_tick / 1_000_000

        if row.player_id in market["player_exports"]:
            market["player_exports"][row.player_id] += quantity
        else:
            market["player_exports"][row.player_id] = quantity
        if row.facility in market["generation"]:
            market["generation"][row.facility] += quantity
        else:
            market["generation"][row.facility] = quantity

    def buy(row, market_price, quantity=None):
        """Buy demanded power capacity"""
        player = Player.query.get(row.player_id)
        generation = new_values[player.id]["generation"]
        revenue = new_values[player.id]["revenues"]
        if quantity is None:
            quantity = row.capacity
        generation["imports"] += quantity
        player.money -= quantity * market_price / 3600 * engine.in_game_seconds_per_tick / 1_000_000
        revenue["imports"] -= quantity * market_price / 3600 * engine.in_game_seconds_per_tick / 1_000_000

        if row.player_id in market["player_imports"]:
            market["player_imports"][row.player_id] += quantity
        else:
            market["player_imports"][row.player_id] = quantity
        if row.facility in market["consumption"]:
            market["consumption"][row.facility] += quantity
        else:
            market["consumption"][row.facility] = quantity

    market["player_exports"] = {}
    market["player_imports"] = {}
    market["generation"] = {}
    market["consumption"] = {}

    offers = market["capacities"]
    offers = offers.sort_values("price").reset_index(drop=True)
    offers["cumul_capacities"] = offers["capacity"].cumsum()

    demands = market["demands"]
    demands = demands.sort_values(by="price", ascending=False).reset_index(drop=True)
    demands["cumul_capacities"] = demands["capacity"].cumsum()

    market["capacities"] = offers
    market["demands"] = demands

    if len(offers) == 0:
        total_market_capacity = 0
        max_supply_price = 0
    else:
        total_market_capacity = offers["cumul_capacities"].iloc[-1]
        max_supply_price = offers["price"].iloc[-1]
    demand_price = demands.loc[demands["cumul_capacities"] >= total_market_capacity, "price"]
    if len(demand_price) == 0:
        demand_price = 0
    else:
        demand_price = demand_price.iloc[0]
    if demand_price > max_supply_price:
        market_quantity = total_market_capacity
        market_price = demand_price if demand_price != np.inf else max_supply_price
    else:
        market_price, market_quantity = market_optimum(offers, demands)
    # sell all capacities under market price
    for row in offers.itertuples(index=False):
        if row.cumul_capacities > market_quantity:
            sold_cap = row.capacity - row.cumul_capacities + market_quantity
            if sold_cap > 0.1:
                sell(row, market_price, quantity=sold_cap)
            # dumping electricity that is offered for negative price and not sold
            if row.price < 0:
                dump_cap = max(0.0, min(row.capacity, row.capacity - sold_cap))
                player = Player.query.get(row.player_id)
                demand = new_values[row.player_id]["demand"]
                demand["dumping"] += dump_cap
                player.money -= dump_cap * 5 / 3600 * engine.in_game_seconds_per_tick / 1_000_000
                revenue = new_values[row.player_id]["revenues"]
                revenue["dumping"] -= dump_cap * 5 / 3600 * engine.in_game_seconds_per_tick / 1_000_000
                continue
            break
        sell(row, market_price)
    # buy all demands over market price
    for row in demands.itertuples(index=False):
        if row.cumul_capacities > market_quantity:
            bought_cap = row.capacity - row.cumul_capacities + market_quantity
            if bought_cap > 0.1:
                buy(row, market_price, quantity=bought_cap)
            # measures a taken to reduce demand
            reduce_demand(
                engine,
                new_values,
                engine.data["current_data"][row.player_id],
                row.facility,
                row.player_id,
                max(0.0, bought_cap),
            )
        else:
            buy(row, market_price)
    market["market_price"] = market_price
    market["market_quantity"] = market_quantity


def market_optimum(offers_og, demands_og):
    """Finding market price and quantity by finding the intersection of demand and supply"""
    offers = offers_og.copy()
    demands = demands_og.copy()

    if len(demands) == 0 or len(offers) == 0:
        return 0, 0

    price_d = demands.loc[0, "price"]
    price_o = offers.loc[0, "price"]

    offers["index_offer"] = range(len(offers))
    offers["price"] = offers["price"].shift(-1)
    offers.loc[len(offers) - 1, "price"] = np.inf
    demands["price"] = demands["price"].shift(-1)
    demands.loc[len(demands) - 1, "price"] = -6

    merged_table = pd.concat([offers, demands], ignore_index=True)
    merged_table = merged_table.sort_values(by="cumul_capacities")

    for row in merged_table.itertuples():
        if np.isnan(row.index_offer):
            price_d = row.price
        else:
            price_o = row.price
        if price_d < price_o:
            if row.Index == 0:
                return price_d, 0
            price = price_d
            if np.isnan(row.index_offer):
                price = price_o
            return price, row.cumul_capacities


def renewables_generation(engine, player, player_cap, generation):
    """Generation of non controllable facilities is calculated from weather data"""
    # WIND
    wind_generation(engine, player, player_cap, generation)
    # SOLAR
    solar_generation(engine, player, player_cap, generation)
    # HYDRO
    power_factor = engine.data["weather"]["river_discharge"]
    for facility in ["watermill", "small_water_dam", "large_water_dam"]:
        if player_cap[facility] is not None:
            generation[facility] = power_factor * player_cap[facility]["power"]
        ActiveFacility.query.filter_by(player_id=player.id, facility=facility).update(
            {ActiveFacility.usage: power_factor}, synchronize_session=False
        )


def solar_generation(engine, player, player_cap, generation):
    """Each instance of facility generates a different amount of power depending on the position of the facility"""

    def transformation(x, threshold=0, smoothness=2):
        """Sigmoid transformation"""
        return 1 / (1 + np.exp(-(x - threshold) * 10 / smoothness))

    # Calculate the real day and time in a year for a given tick
    start_date = datetime(2023, 1, 1)
    day_of_year = int(
        ((engine.data["total_t"] + engine.data["delta_t"]) * engine.in_game_seconds_per_tick / 3600 / 24 / 72) % 1 * 365
    )
    time_of_day = ((engine.data["total_t"] + engine.data["delta_t"]) * engine.in_game_seconds_per_tick) % (3600 * 24)
    weather_datetime = pd.DatetimeIndex([start_date + timedelta(days=day_of_year) + timedelta(seconds=time_of_day)])

    for facility_type in ["CSP_solar", "PV_solar"]:
        if player_cap[facility_type] is not None:
            solar_facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(
                player_id=player.id, facility=facility_type
            ).all()
            for facility in solar_facilities:
                x, y = facility.pos_x, facility.pos_y
                x_noise = x + engine.data["total_t"] * engine.in_game_seconds_per_tick / 2400
                y_noise = y + engine.data["total_t"] * engine.in_game_seconds_per_tick / 4000
                t = engine.data["total_t"] * engine.in_game_seconds_per_tick / 3600 / 24
                regional_noise = pnoise3(x_noise / 50, y_noise / 50, t, octaves=2, persistence=0.5, lacunarity=2.0)
                regional_noise = transformation(regional_noise, smoothness=1) * 2 - 1
                cloud_cover_noise = pnoise3(x_noise, y_noise, t, octaves=6, persistence=0.5, lacunarity=2.0)
                cloud_cover_noise = transformation(
                    cloud_cover_noise, threshold=0.5 * regional_noise, smoothness=max(0.3, 1 - regional_noise)
                )
                csi = 1 - min(0.9, 5 - regional_noise * 5) * cloud_cover_noise
                loc = Location(8 * y, 0)
                clear_sky = loc.get_clearsky(weather_datetime)["ghi"][0]
                max_power = (
                    engine.const_config["assets"][facility_type]["base_power_generation"] * facility.multiplier_1
                )
                facility.usage = clear_sky * csi / 1000
                generation[facility_type] += clear_sky * csi / 1000 * max_power


def wind_generation(engine, player, player_cap, generation):
    """Each wind facility has its own wind speed multiplier and therefore generates a different amount of power"""
    for facility_type in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
        if player_cap[facility_type] is not None:
            wind_facilities: List[ActiveFacility] = ActiveFacility.query.filter_by(
                player_id=player.id, facility=facility_type
            ).all()
            for facility in wind_facilities:
                wind_speed_factor = facility.multiplier_2
                max_power = (
                    engine.const_config["assets"][facility_type]["base_power_generation"] * facility.multiplier_1
                )
                facility.usage = interpolate_wind(engine, wind_speed_factor)
                generation[facility_type] += facility.usage * max_power


def interpolate_wind(engine, wind_speed_factor):
    """Interpolates the wind power curve to get the exact power generated by a wind facility"""
    if engine.data["weather"]["windspeed"] > 100:
        return 0
    windspeed = engine.data["weather"]["windspeed"] * wind_speed_factor
    i = math.floor(windspeed)
    f = windspeed - i
    pc = wind_power_curve
    return pc[i] + (pc[(i + 1) % 100] - pc[i]) * f


def calculate_prod(
    engine,
    minmax,
    player,
    player_cap,
    facility,
    past_values,
    resource_reservations,
    storage=False,
    filling=False,
):
    """
    Calculates the min or max power production of controllable facilities at time t considering :
    - ramping constraints
    - resources constraints
    - max power constraints
    - storage filling constraints
    """

    def reserve_resources(power):
        """Reserve resources for the production of power so that they are not used somewhere else"""
        if "fuel_use" in player_cap[facility]:
            for resource, amount in player_cap[facility]["fuel_use"].items():
                resource_reservations[resource] += amount * power / player_cap[facility]["power"]

    max_resources = np.inf
    ramping_speed = (
        player_cap[facility]["power"]
        / engine.const_config["assets"][facility]["ramping_time"]
        * engine.in_game_seconds_per_tick
    )
    if "fuel_use" in player_cap[facility]:
        for resource, amount in player_cap[facility]["fuel_use"].items():
            available_resource = (
                getattr(player, resource) - getattr(player, resource + "_on_sale") - resource_reservations[resource]
            )
            p_max_resources = available_resource / amount * player_cap[facility]["power"]
            max_resources = min(p_max_resources, max_resources)
    else:
        if filling:
            energy_capacity = (
                max(
                    0.0,
                    player_cap[facility]["capacity"] - past_values.get_last_data("storage", facility),
                )
                * 3600
                / engine.in_game_seconds_per_tick
                * (player_cap[facility]["efficiency"] ** 0.5)
            )  # max remaining storage space
        else:
            energy_capacity = max(
                0.0,
                past_values.get_last_data("storage", facility)
                * 3600
                / engine.in_game_seconds_per_tick
                * (player_cap[facility]["efficiency"] ** 0.5),
            )  # max available storage content
        max_resources = max(
            0.0, min(energy_capacity, (2 * energy_capacity * ramping_speed) ** 0.5 - 0.5 * ramping_speed)
        )  # ramping down
    if minmax == "max":
        if filling:
            max_ramping = past_values.get_last_data("demand", facility) + ramping_speed
        else:
            max_ramping = past_values.get_last_data("generation", facility) + ramping_speed
        max_generation = min(max_resources, max_ramping, player_cap[facility]["power"])
        reserve_resources(max_generation)
        return max_generation
    else:
        min_ramping = past_values.get_last_data("generation", facility) - ramping_speed
        min_generation = max(0.0, min(max_resources, min_ramping, player_cap[facility]["power"]))
        reserve_resources(min_generation)
        return min_generation


def minimal_generation(engine, player, player_cap, generation, resource_reservations):
    """Calculate the minimal generation of controllable facilities"""
    for facility in engine.controllable_facilities + engine.storage_facilities:
        if player_cap[facility] is not None:
            generation[facility] = calculate_prod(
                engine,
                "min",
                player,
                player_cap,
                facility,
                engine.data["current_data"][player.id],
                resource_reservations,
                storage=facility in engine.storage_facilities,
            )


def offer(market, player_id, capacity, price, facility):
    """Make an offer on the market"""
    if capacity > 0:
        new_row = pd.DataFrame(
            {
                "player_id": [player_id],
                "capacity": [capacity],
                "price": [price],
                "facility": [facility],
            }
        )
        market["capacities"] = pd.concat([market["capacities"], new_row], ignore_index=True)
    return market


def bid(market, player_id, demand, price, facility):
    """Make a bid on the market"""
    if demand > 0:
        new_row = pd.DataFrame(
            {
                "player_id": [player_id],
                "capacity": [demand],
                "price": [price],
                "facility": [facility],
            }
        )
        market["demands"] = pd.concat([market["demands"], new_row], ignore_index=True)
    return market


def resources_and_pollution(engine, new_values, player):
    """Calculate resource use and production, O&M costs and emissions"""
    player_cap = engine.data["player_capacities"][player.id]
    generation = new_values["generation"]
    op_costs = new_values["op_costs"]
    demand = new_values["demand"]
    # Calculate resource consumption and pollution of generation facilities
    for facility in engine.controllable_facilities:
        if player_cap[facility] is not None:
            for resource, amount in player_cap[facility]["fuel_use"].items():
                quantity = amount * generation[facility] / player_cap[facility]["power"]
                setattr(player, resource, getattr(player, resource) - quantity)
            facility_emissions = (
                engine.const_config["assets"][facility]["base_pollution"]
                * generation[facility]
                / 3600
                * engine.in_game_seconds_per_tick
                / 1_000_000
            )
            add_emissions(engine, new_values, player, facility, facility_emissions)

    if player.warehouse > 0:
        for extraction_facility in engine.extraction_facilities:
            resource = extraction_to_resource[extraction_facility]
            if player_cap[extraction_facility] is not None:
                max_demand = player_cap[extraction_facility]["power_use"]
                production_factor = demand[extraction_facility] / max_demand
                extracted_quantity = (
                    production_factor
                    * player_cap[extraction_facility]["extraction_rate_per_day"]
                    * getattr(player.tile, resource)
                    * engine.in_game_seconds_per_tick
                    / 86400  # 86400 seconds in a day
                )
                setattr(
                    player.tile,
                    resource,
                    getattr(player.tile, resource) - extracted_quantity,
                )
                setattr(
                    player,
                    resource,
                    getattr(player, resource) + extracted_quantity,
                )
                player.extracted_resources += extracted_quantity
                db.session.commit()
                emissions = extracted_quantity * player_cap[extraction_facility]["pollution"]
                add_emissions(
                    engine,
                    new_values,
                    player,
                    extraction_facility,
                    emissions,
                )
            new_values["resources"][resource] = getattr(player, resource)

    # Carbon capture CO2 absorption
    if player.carbon_capture > 0:
        assets = engine.config[player.id]
        satisfaction = demand["carbon_capture"] / assets["carbon_capture"]["power_consumption"]
        captured_co2 = (
            assets["carbon_capture"]["absorption"]
            * engine.data["current_climate_data"].get_co2()
            * engine.in_game_seconds_per_tick
            / 86400
            * satisfaction
        )
        player.captured_CO2 += captured_co2
        db.session.commit()
        add_emissions(engine, new_values, player, "carbon_capture", -captured_co2)

    construction_emissions(engine, new_values, player)

    # O&M costs
    for facility in engine.power_facilities + engine.storage_facilities + engine.extraction_facilities:
        if player_cap[facility] is not None:
            # the proportion of fixed cost is 100% for renewable and storage facilities,
            # 50% for nuclear reactors and 20% for the rest
            operational_cost = player_cap[facility]["O&M_cost"]
            if facility in engine.controllable_facilities + engine.extraction_facilities:
                fc = 0.2
                if facility in ["nuclear_reactor", "nuclear_reactor_gen4"]:
                    fc = 0.5
                if facility in engine.extraction_facilities:
                    capacity = demand[facility] / player_cap[facility]["power_use"]
                else:
                    capacity = generation[facility] / player_cap[facility]["power"]
                operational_cost = operational_cost * (fc + (1 - fc) * capacity)
            player.money -= operational_cost
            op_costs[facility] -= operational_cost


def construction_emissions(engine, new_values, player):
    """calculate emissions of facilities under construction"""
    emissions_construction = 0.0
    for ud in player.under_construction:
        if ud.start_time is not None:
            if ud.suspension_time is None and ud.family != "Technologies":
                emissions_construction += ud.construction_pollution
    add_emissions(engine, new_values, player, "construction", emissions_construction)


def reduce_demand(engine, new_values, past_data, demand_type, player_id, satisfaction):
    """Measures taken to reduce demand"""
    player = Player.query.get(player_id)
    demand = new_values[player.id]["demand"]
    if demand_type == "industry":
        # revenues of industry are reduced
        new_values[player.id]["revenues"]["industry"] *= satisfaction / demand["industry"]
        demand["industry"] = satisfaction
        return
    demand[demand_type] = satisfaction
    if demand_type in engine.extraction_facilities + engine.storage_facilities + ["carbon_capture"]:
        return
    if satisfaction > (1 + 0.0008 * engine.in_game_seconds_per_tick) * past_data.get_last_data("demand", demand_type):
        return
    if demand_type == "construction":
        construction_priorities = player.read_list("construction_priorities")
        cumul_demand = 0.0
        for i in range(min(len(construction_priorities), player.construction_workers)):
            construction_id = construction_priorities[i]
            construction: OngoingConstruction = OngoingConstruction.query.get(construction_id)
            if construction.suspension_time is not None:
                continue
            cumul_demand += construction.construction_power
            if cumul_demand > satisfaction:
                construction.suspension_time = engine.data["total_t"]
                player.emit(
                    "pause_construction",
                    {
                        "construction_id": construction_id,
                        "suspension_time": engine.data["total_t"],
                    },
                )
                player.notify(
                    "Energy shortage",
                    f"The construction of the facility {engine.const_config['assets'][construction.name]['name']} "
                    "has been suspended because of a lack of electricity.",
                )
        db.session.commit()
        return
    if demand_type == "research":
        research_priorities = player.read_list("research_priorities")
        cumul_demand = 0.0
        for i in range(min(len(research_priorities), player.lab_workers)):
            construction_id = research_priorities[i]
            construction: OngoingConstruction = OngoingConstruction.query.get(construction_id)
            if construction.suspension_time is not None:
                continue
            cumul_demand += construction.construction_power
            if cumul_demand > satisfaction:
                construction.suspension_time = engine.data["total_t"]
                player.emit(
                    "pause_construction",
                    {
                        "construction_id": construction_id,
                        "suspension_time": engine.data["total_t"],
                    },
                )
                player.notify(
                    "Energy shortage",
                    f"The research of the technology {engine.const_config['assets'][construction.name]['name']} "
                    "has been suspended because of a lack of electricity.",
                )
        db.session.commit()
        return
    if demand_type == "transport":
        last_shipment = (
            Shipment.query.filter(
                Shipment.suspension_time.is_(None),
                Shipment.player_id == player.id,
            )
            .order_by(Shipment.departure_time.desc())
            .first()
        )
        if last_shipment:
            last_shipment.suspension_time = engine.data["total_t"]
            player.emit(
                "pause_shipment",
                {
                    "shipment_id": last_shipment.id,
                    "suspension_time": engine.data["total_t"],
                },
            )
            player.notify(
                "Energy shortage",
                f"The shipment of {last_shipment.resource} has been suspended because of a lack of electricity.",
                player,
            )
        return


def add_emissions(engine, new_values, player, facility, amount):
    """Helper function to add emissions to the data"""
    new_values["emissions"][facility] += amount
    engine.data["player_cumul_emissions"][player.id].add(facility, amount)
    engine.data["current_climate_data"].add("CO2", amount)
