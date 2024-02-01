"""
The game states update functions are defined here
"""

import pickle
import time
import math
import pandas as pd
import numpy as np
from .database import Network, Player, Under_construction, Shipment
from . import db

resource_to_extraction = {
    "coal": "coal_mine",
    "oil": "oil_field",
    "gas": "gas_drilling_site",
    "uranium": "uranium_mine",
}

extraction_to_resource = {
    "coal_mine": "coal",
    "oil_field": "oil",
    "gas_drilling_site": "gas",
    "uranium_mine": "uranium",
}


def update_electricity(engine):
    """Update the electricity generation and storage status for all players"""
    t = engine.data["current_t"]
    # keep CO2 values for next t
    engine.data["current_CO2"][t] = engine.data["current_CO2"][t - 1]
    networks = Network.query.all()
    for network in networks:
        market = init_market()
        for player in network.members:
            if player.tile is None:
                continue
            total_demand = calculate_demand(engine, player, t)
            market = calculate_generation_with_market(
                engine, market, total_demand, player, t
            )
        market_logic(engine, market, t)
        # Save market data
        engine.data["network_data"][network.name]["price"][t] = market[
            "market_price"
        ]
        engine.data["network_data"][network.name]["quantity"][t] = market[
            "market_quantity"
        ]
        with open(
            f"instance/network_data/{network.id}/charts/market_t{engine.data['total_t']}.pck",
            "wb",
        ) as file:
            pickle.dump(market, file)

    players = Player.query.all()
    for player in players:
        current_data = engine.data["current_data"][player.username]
        if player.tile is None:
            continue
        # Power generation calculation for players that are not in a network
        if player.network is None:
            calculate_demand(engine, player, t)
            calculate_generation_without_market(engine, player, t)
        calculate_net_import(current_data, t, player.network is not None)
        update_storgage_lvls(engine, player, t)
        resources_and_pollution(engine, player, t)
        # calculate moving average revenue
        player.average_revenues = (
            player.average_revenues
            + 60
            * 0.03
            * sum(
                [
                    current_data["revenues"][rev][t]
                    for rev in current_data["revenues"]
                ]
            )
        ) / 1.03
        # update display of resources and money
        player.update_resources()

    # save changes
    db.session.commit()


def init_market():
    """Initialize an empty market"""
    return {
        "capacities": pd.DataFrame(
            {"player": [], "capacity": [], "price": [], "facility": []}
        ),
        "demands": pd.DataFrame(
            {"player": [], "capacity": [], "price": [], "facility": []}
        ),
    }


def update_storgage_lvls(engine, player, t):
    """Update storage levels according to the use of storage failities"""
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    demand = engine.data["current_data"][player.username]["demand"]
    storage = engine.data["current_data"][player.username]["storage"]
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            storage[facility][t] = (
                storage[facility][t - 1]
                - generation[facility][t]
                / 60
                / (
                    assets[facility]["efficiency"] ** 0.5
                )  # transform W to Wh and consider efficiency
                + demand[facility][t]
                / 60
                * (assets[facility]["efficiency"] ** 0.5)
            )


def calculate_net_import(current_data, t, network):
    """For players in network, subtract the difference between import and
    exports to ignore energy that has been bought from themselves"""
    exp = current_data["demand"]["exports"][t]
    imp = current_data["generation"]["imports"][t]
    current_data["demand"]["exports"][t] = max(0, exp - imp)
    current_data["generation"]["imports"][t] = max(0, imp - exp)
    exp_rev = current_data["revenues"]["exports"][t]
    imp_rev = current_data["revenues"]["imports"][t]
    if exp_rev < 0 or imp_rev > 0:
        current_data["revenues"]["exports"][t] = min(0, exp_rev + imp_rev)
        current_data["revenues"]["imports"][t] = max(0, exp_rev + imp_rev)
    else:
        current_data["revenues"]["exports"][t] = max(0, exp_rev + imp_rev)
        current_data["revenues"]["imports"][t] = min(0, exp_rev + imp_rev)


def extraction_facility_demand(engine, player, t, assets, demand):
    """Calculate power consumption of extraction facilites"""
    player_resources = engine.data["current_data"][player.username]["resources"]
    warehouse_caps = engine.config[player.id]["warehouse_capacities"]
    for resource in resource_to_extraction:
        facility = resource_to_extraction[resource]
        if getattr(player, facility) > 0:
            max_warehouse = (
                warehouse_caps[resource] - player_resources[resource][t - 1]
            )
            max_prod = (
                getattr(player, facility) * assets[facility]["amount produced"]
            )
            power_factor = min(1, max_warehouse / max(1, max_prod))
            demand[facility][t] = (
                assets[facility]["power consumption"]
                * getattr(player, facility)
                * power_factor
            )


def industry_demand_and_revenues(engine, player, t, assets, demand, revenues):
    """calculate power consumption and revenues from industry"""
    # interpolating seasonal factor on the day
    day = engine.data["total_t"] // 1440
    seasonal_factor = (
        engine.industry_seasonal[day % 51]
        * (1440 - engine.data["total_t"] % 1440)
        + engine.industry_seasonal[(day + 1) % 51]
        * (engine.data["total_t"] % 1440)
    ) / 1440
    industry_demand = (
        engine.industry_demand[t - 1]
        * seasonal_factor
        * assets["industry"]["power consumption"]
    )
    demand["industry"][t] = min(
        demand["industry"][t - 1] + 0.05 * industry_demand, industry_demand
    )  # progressive demand change in case of restart
    # calculate income of industry
    industry_income = (
        engine.config[player.id]["assets"]["industry"]["income"] / 1440.0
    )
    revenues["industry"][t] = industry_income
    for ud in player.under_construction:
        if ud.start_time is not None:
            # industry demand ramps up during construction
            if ud.name == "industry":
                if ud.suspension_time is None:
                    time_fraction = (time.time() - ud.start_time) / (
                        ud.duration
                    )
                else:
                    time_fraction = (ud.suspension_time - ud.start_time) / (
                        ud.duration
                    )
                additional_demand = (
                    time_fraction
                    * industry_demand
                    * (assets["industry"]["power factor"] - 1)
                )
                additional_revenue = (
                    time_fraction
                    * industry_income
                    * (assets["industry"]["income factor"] - 1)
                )
                demand["industry"][t] += additional_demand
                revenues["industry"][t] += additional_revenue
    player.money += revenues["industry"][t]


def construction_demand(player, t, assets, demand):
    """calculate power consumption for facilites under construction"""
    for ud in player.under_construction:
        if ud.start_time is not None:
            if ud.suspension_time is None:
                construction = assets[ud.name]
                if ud.family == "technologies":
                    demand["research"][t] += construction["construction power"]
                else:
                    demand["construction"][t] += construction[
                        "construction power"
                    ]


def shipment_demand(engine, player, t, demand):
    """calculate the power consumption for shipments"""
    transport = engine.config[player.id]["transport"]
    for shipment in player.shipments:
        if shipment.suspension_time is None:
            demand["transport"][t] += (
                transport["power consumption"]
                / transport["time"]
                * shipment.quantity
                * 3.6
            )


def calculate_demand(engine, player, t):
    """Calculates the electricity demand of one player"""

    assets = engine.config[player.id]["assets"]
    demand = engine.data["current_data"][player.username]["demand"]
    revenues = engine.data["current_data"][player.username]["revenues"]

    extraction_facility_demand(engine, player, t, assets, demand)
    industry_demand_and_revenues(engine, player, t, assets, demand, revenues)
    construction_demand(player, t, assets, demand)
    shipment_demand(engine, player, t, demand)

    return sum([demand[i][t] for i in demand])


def calculate_generation_without_market(engine, player, t):
    internal_market = init_market()
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    demand = engine.data["current_data"][player.username]["demand"]
    storage = engine.data["current_data"][player.username]["storage"]
    # generation of non controllable facilities is calculated from weather data
    renewables_generation(engine, player, assets, generation, t)
    minimal_generation(engine, player, assets, generation, t, storage)
    facilities = (
        engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
    )
    # Obligatory generation is put on the internal market at a price of -5
    for facility in facilities:
        if getattr(player, facility) > 0:
            internal_market = offer(
                internal_market, player, generation[facility][t], -5, facility
            )

    # demands are demanded on the internal market
    for demand_type in player.demand_priorities.split(" "):
        price = getattr(player, "price_buy_" + demand_type)
        internal_market = bid(
            internal_market, player, demand[demand_type][t], price, demand_type
        )

    # Sell capacities of facilities on the internal market
    for facility in engine.storage_facilities + engine.controllable_facilities:
        if getattr(player, facility) > 0:
            max_prod = calculate_prod(
                "max",
                player,
                assets,
                facility,
                generation,
                t,
                storage=storage
                if facility in engine.storage_facilities
                else None,
            )
            price = getattr(player, "price_" + facility)
            capacity = max_prod - generation[facility][t]
            internal_market = offer(
                internal_market, player, capacity, price, facility
            )

    # Demand curve for storage (no ramping down constraint, only up)
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            demand_q = calculate_prod(
                "max",
                player,
                assets,
                facility,
                demand,
                t,
                storage=storage,
                filling=True,
            )
            price = getattr(player, "price_buy_" + facility)
            internal_market = bid(
                internal_market, player, demand_q, price, facility
            )
    market_logic(engine, internal_market, t)


# calculates in-house satisfaction and sets the capacity offers and demands on the market
def calculate_generation_with_market(
    engine, market, remaining_demand, player, t
):
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    demand = engine.data["current_data"][player.username]["demand"]
    storage = engine.data["current_data"][player.username]["storage"]

    excess_generation = 0
    renewables_generation(engine, player, assets, generation, t)
    minimal_generation(engine, player, assets, generation, t, storage)
    facilities = (
        engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
    )
    for facility in facilities:
        if getattr(player, facility) > 0:
            # If the min. generated power is SCP, it is used for internal satisfaction else, it is put on the market for -5¤/MWh
            if facility in read_priority_list(player.self_consumption_priority):
                internal_satisfaction = min(
                    remaining_demand, generation[facility][t]
                )
                remaining_demand -= internal_satisfaction
                # If generation overshoots demand, put it on the market at -5¤/MWh
                if remaining_demand == 0:
                    capacity = generation[facility][t] - internal_satisfaction
                    market = offer(market, player, capacity, -5, facility)
            else:
                excess_generation += generation[facility][t]
                market = offer(
                    market, player, generation[facility][t], -5, facility
                )
    # # while the produced power is not sufficient for own demand, for each power facility following the priority list,
    # # set the power to the maximum possible value (max upward power ramp).
    # # For the PP that overshoots the demand, find the equilibirum power generation value.
    # # The additional available generation capacity is put on the market.
    # for facility in read_priority_list(player.self_consumption_priority):
    #     if assets[facility]["ramping speed"] != 0:
    #         max_prod = calculate_prod(
    #             "max",
    #             player,
    #             assets,
    #             facility,
    #             generation,
    #             t,
    #             storage=storage
    #             if facility in engine.storage_facilities
    #             else None,
    #         )
    #         # range of possible power variation
    #         delta_prod = max_prod - generation[facility][t]
    #         # case where the facility is the one that could overshoot the equilibium :
    #         if delta_prod > remaining_demand:
    #             generation[facility][t] += remaining_demand
    #             # additional capacity sold on the market
    #             capacity = delta_prod - remaining_demand
    #             price = getattr(player, "price_" + facility)
    #             market = offer(market, player, capacity, price, facility)
    #             remaining_demand = 0
    #         else:
    #             remaining_demand -= delta_prod
    #             generation[facility][t] += delta_prod

    # if demand is still not met, player has to bid on the market at the set prices
    if remaining_demand > 0:
        demand_priorities = player.demand_priorities.split(" ")
        demand_priorities.reverse()
        for demand_type in demand_priorities:
            if remaining_demand == 0:
                break
            if demand[demand_type][t] > remaining_demand:
                bid_q = remaining_demand
                remaining_demand = 0
            else:
                bid_q = demand[demand_type][t]
                remaining_demand -= demand[demand_type][t]
            price = getattr(player, "price_buy_" + demand_type)
            market = bid(market, player, bid_q, price, demand_type)

    # Sell capacities of remaining facilities on the market
    for facility in read_priority_list(
        player.rest_of_priorities
    ) + read_priority_list(player.self_consumption_priority):
        if assets[facility]["ramping speed"] != 0:
            if getattr(player, facility) > 0:
                max_prod = calculate_prod(
                    "max",
                    player,
                    assets,
                    facility,
                    generation,
                    t,
                    storage=storage
                    if facility in engine.storage_facilities
                    else None,
                )
                price = getattr(player, "price_" + facility)
                capacity = max_prod - generation[facility][t]
                market = offer(market, player, capacity, price, facility)

    # Demand curve for storage (no ramping down constraint, only up)
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            demand_q = calculate_prod(
                "max",
                player,
                assets,
                facility,
                demand,
                t,
                storage=storage,
                filling=True,
            )
            price = getattr(player, "price_buy_" + facility)
            market = bid(market, player, demand_q, price, facility)
    return market


def market_logic(engine, market, t):
    """Calculate overall network demand,
    class all capacity offers in ascending order of price
    and find the market price of electricity.
    Sell all capacities that are below market price at market price."""
    offers = market["capacities"]
    offers = offers.sort_values("price").reset_index(drop=True)
    offers["cumul_capacities"] = offers["capacity"].cumsum()

    demands = market["demands"]
    demands = demands.sort_values(by="price", ascending=False).reset_index(
        drop=True
    )
    demands["cumul_capacities"] = demands["capacity"].cumsum()

    market["capacities"] = offers
    market["demands"] = demands

    if len(offers) == 0:
        total_market_capacity = 0
        max_supply_price = 0
    else:
        total_market_capacity = offers["cumul_capacities"].iloc[-1]
        max_supply_price = offers["price"].iloc[-1]
    demand_price = demands.loc[
        demands["cumul_capacities"] >= total_market_capacity, "price"
    ]
    if len(demand_price) == 0:
        demand_price = 0
    else:
        demand_price = demand_price.iloc[0]
    if demand_price > max_supply_price:
        market_quantity = total_market_capacity
        market_price = (
            demand_price if demand_price != np.inf else max_supply_price
        )
    else:
        market_price, market_quantity = market_optimum(offers, demands)
    # sell all capacities under market price
    for row in offers.itertuples(index=False):
        if row.cumul_capacities > market_quantity:
            sold_cap = row.capacity - row.cumul_capacities + market_quantity
            if sold_cap > 0.1:
                sell(engine, row, market_price, t, quantity=sold_cap)
            # dumping electricity that is offered for negative price and not sold
            if row.price < 0:
                rest = max(0, min(row.capacity, row.capacity - sold_cap))
                dump_cap = rest
                demand = engine.data["current_data"][row.player.username][
                    "demand"
                ]
                demand["dumping"][t] += dump_cap
                row.player.money -= dump_cap * 5 / 1000000
                revenue = engine.data["current_data"][row.player.username][
                    "revenues"
                ]
                revenue["dumping"][t] -= dump_cap * 5 / 1000000
                continue
            break
        sell(engine, row, market_price, t)
    # buy all demands over market price
    for row in demands.itertuples(index=False):
        if row.cumul_capacities > market_quantity:
            bought_cap = row.capacity - row.cumul_capacities + market_quantity
            if bought_cap > 0.1:
                buy(engine, row, market_price, t, quantity=bought_cap)
            # if demand is not a storage facility mesures a taken to reduce demand
            if row.facility not in engine.storage_facilities:
                reduce_demand(
                    engine, row.facility, row.player, t, max(0, bought_cap)
                )
        else:
            buy(engine, row, market_price, t)
    market["market_price"] = market_price
    market["market_quantity"] = market_quantity


def market_optimum(offers_og, demands_og):
    """Finding market price and quantity by finding the intersection of demand and suppply"""
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
    demands.loc[len(demands) - 1, "price"] = -5

    merged_table = pd.concat([offers, demands], ignore_index=True)
    merged_table = merged_table.sort_values(by="cumul_capacities")

    for row in merged_table.itertuples(index=False):
        if np.isnan(row.index_offer):
            price_d = row.price
        else:
            price_o = row.price
        if price_o == np.inf:
            return price_d, row.cumul_capacities
        if price_d < price_o:
            price = price_d
            if np.isnan(row.index_offer):
                price = price_o
            return price, row.cumul_capacities


def renewables_generation(engine, player, assets, generation, t):
    """Generation of non controllable facilities is calculated from weather data"""
    # WIND
    power_factor = interpolate_wind(engine, player, t)
    for facility in [
        "windmill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
    ]:
        generation[facility][t] = (
            power_factor
            * assets[facility]["power generation"]
            * getattr(player, facility)
        )
    # SOLAR
    power_factor = (
        engine.data["current_irradiation"][t] / 875 * player.tile.solar
    )  # 875 W/m2 is the maximim irradiation in Zürich
    for facility in ["CSP_solar", "PV_solar"]:
        generation[facility][t] = (
            power_factor
            * assets[facility]["power generation"]
            * getattr(player, facility)
        )
    # HYDRO
    power_factor = engine.data["current_discharge"][t]
    for facility in ["watermill", "small_water_dam", "large_water_dam"]:
        generation[facility][t] = (
            power_factor
            * assets[facility]["power generation"]
            * getattr(player, facility)
        )


def interpolate_wind(engine, player, t):
    if engine.data["current_windspeed"][t] > 100:
        return 0
    windspeed = engine.data["current_windspeed"][t] * pow(player.tile.wind, 0.5)
    i = math.floor(windspeed)
    f = windspeed - i
    pc = engine.wind_power_curve
    return pc[i] + (pc[(i + 1) % 100] - pc[i]) * f


def calculate_prod(
    minmax, player, assets, facility, generation, t, storage=None, filling=False
):
    """
    Calculates the min or max power production of contollable facilities at time t considering :
    - ramping constraints
    - resources constraints
    - max power constraints
    - storage filling constraints
    """
    max_resources = np.inf
    ramping_speed = (
        getattr(player, facility) * assets[facility]["ramping speed"]
    )
    if storage is None:
        for resource, amount in assets[facility]["consumed resource"].items():
            available_resource = getattr(player, resource) - getattr(
                player, resource + "_on_sale"
            )
            P_max_resources = available_resource / amount * 60000000
            max_resources = min(P_max_resources, max_resources)
    else:
        if filling:
            E = (
                max(
                    0,
                    assets[facility]["storage capacity"]
                    * getattr(player, facility)
                    - storage[facility][t - 1],
                )
                * 60
                * (assets[facility]["efficiency"] ** 0.5)
            )  # max remaining storage space
        else:
            E = max(
                0,
                storage[facility][t - 1]
                * 60
                * (assets[facility]["efficiency"] ** 0.5),
            )  # max available storge content
        max_resources = min(
            E, (2 * E * ramping_speed) ** 0.5 - 0.5 * ramping_speed
        )  # ramping down
    if minmax == "max":
        max_ramping = generation[facility][t - 1] + ramping_speed
        return min(
            max_resources,
            max_ramping,
            getattr(player, facility) * assets[facility]["power generation"],
        )
    else:
        min_ramping = generation[facility][t - 1] - ramping_speed
        return max(0, min(max_resources, min_ramping))


def minimal_generation(engine, player, assets, generation, t, storage):
    total_generation = 0
    for facility in engine.controllable_facilities + engine.storage_facilities:
        if getattr(player, facility) > 0:
            generation[facility][t] = calculate_prod(
                "min",
                player,
                assets,
                facility,
                generation,
                t,
                storage=storage
                if facility in engine.storage_facilities
                else None,
            )
        total_generation += generation[facility][t]
    return total_generation


def offer(market, player, capacity, price, facility):
    if capacity > 0:
        new_row = pd.DataFrame(
            {
                "player": [player],
                "capacity": [capacity],
                "price": [price],
                "facility": [facility],
            }
        )
        market["capacities"] = pd.concat(
            [market["capacities"], new_row], ignore_index=True
        )
    return market


def bid(market, player, demand, price, facility):
    if demand > 0:
        new_row = pd.DataFrame(
            {
                "player": [player],
                "capacity": [demand],
                "price": [price],
                "facility": [facility],
            }
        )
        market["demands"] = pd.concat(
            [market["demands"], new_row], ignore_index=True
        )
    return market


def sell(engine, row, market_price, t, quantity=None):
    generation = engine.data["current_data"][row.player.username]["generation"]
    demand = engine.data["current_data"][row.player.username]["demand"]
    storage = engine.data["current_data"][row.player.username]["storage"]
    revenue = engine.data["current_data"][row.player.username]["revenues"]
    if quantity is None:
        quantity = row.capacity
    if row.price >= 0:
        generation[row.facility][t] += quantity
        if row.facility in engine.storage_facilities:
            assets = engine.config[row.player.id]["assets"]
            storage[row.facility][t] -= (
                quantity / 60 / (assets[row.facility]["efficiency"] ** 0.5)
            )  # Transform W in Wh + efficiency loss
    demand["exports"][t] += quantity
    row.player.money += quantity * market_price / 60000000
    revenue["exports"][t] += quantity * market_price / 60000000


def buy(engine, row, market_price, t, quantity=None):
    generation = engine.data["current_data"][row.player.username]["generation"]
    storage = engine.data["current_data"][row.player.username]["storage"]
    demand = engine.data["current_data"][row.player.username]["demand"]
    revenue = engine.data["current_data"][row.player.username]["revenues"]
    if quantity is None:
        quantity = row.capacity
    if row.facility in engine.storage_facilities:
        assets = engine.config[row.player.id]["assets"]
        storage[row.facility][t] += (
            quantity / 60 * (assets[row.facility]["efficiency"] ** 0.5)
        )  # Transform W in Wh + efficiency loss
        demand[row.facility][t] += quantity
    generation["imports"][t] += quantity
    row.player.money -= quantity * market_price / 60000000
    revenue["imports"][t] -= quantity * market_price / 60000000


def resources_and_pollution(engine, player, t):
    """Calculate resource use and production, O&M costs and emissions"""
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    revenue = engine.data["current_data"][player.username]["revenues"]
    demand = engine.data["current_data"][player.username]["demand"]
    # Calculate resource consumption and pollution of generation facilities
    for facility in [
        "steam_engine",
        "coal_burner",
        "oil_burner",
        "gas_burner",
        "combined_cycle",
        "nuclear_reactor",
        "nuclear_reactor_gen4",
    ]:
        if getattr(player, facility) > 0:
            for resource, amount in assets[facility][
                "consumed resource"
            ].items():
                quantity = amount * generation[facility][t] / 60000000
                setattr(player, resource, getattr(player, resource) - quantity)
                facility_emmissions = (
                    assets[facility]["pollution"]
                    * generation[facility][t]
                    / 60000000
                )
                add_emissions(engine, player, t, facility, facility_emmissions)

    for extraction_facility in [
        "coal_mine",
        "oil_field",
        "gas_drilling_site",
        "uranium_mine",
    ]:
        resource = extraction_to_resource[extraction_facility]
        if getattr(player, extraction_facility) > 0:
            max_demand = assets[extraction_facility][
                "power consumption"
            ] * getattr(player, extraction_facility)
            production_factor = demand[extraction_facility][t] / max_demand
            extracted_quantity = (
                production_factor
                * getattr(player, extraction_facility)
                * assets[extraction_facility]["amount produced"]
            )
            setattr(
                player.tile,
                resource,
                getattr(player.tile, resource) - extracted_quantity,
            )
            setattr(
                player, resource, getattr(player, resource) + extracted_quantity
            )
            db.session.commit()
            emissions = (
                extracted_quantity * assets[extraction_facility]["pollution"]
            )
            add_emissions(engine, player, t, extraction_facility, emissions)
        engine.data["current_data"][player.username]["resources"][resource][
            t
        ] = getattr(player, resource)

    construction_emissions(engine, player, t, assets)

    # O&M costs, currently only for steam engine
    # Special case steam engine costs money and if it is not used it costs 20% of the maximum
    steam_engine_cost = (
        player.steam_engine
        * assets["steam_engine"]["O&M cost"]
        / 60
        * (
            0.2
            + 0.8
            * generation["steam_engine"][t]
            / (player.steam_engine * assets["steam_engine"]["power generation"])
        )
    )
    player.money -= steam_engine_cost
    revenue["O&M_costs"][t] -= steam_engine_cost


def construction_emissions(engine, player, t, assets):
    """calculate emissions of facilites under construction"""
    emissions_construction = 0
    for ud in player.under_construction:
        if ud.start_time is not None:
            if ud.suspension_time is None and ud.family != "technologies":
                construction = assets[ud.name]
                emissions_construction += (
                    construction["construction pollution"]
                    / construction["construction time"]
                )
    add_emissions(engine, player, t, "construction", emissions_construction)


def read_priority_list(list):
    if list == "":
        return []
    else:
        return list.split(" ")


def reduce_demand(engine, demand_type, player, t, satisfaction):
    """Mesures taken to reduce demand"""
    if demand_type == "extraction_facilities":
        return
    demand = engine.data["current_data"][player.username]["demand"]
    if satisfaction > 1.05 * demand[demand_type][t - 1]:
        demand[demand_type][t] = satisfaction
        return
    if demand_type == "industry":
        player.industry = max(1, player.industry - 1)
        engine.config.update_config_for_user(player.id)
        db.session.commit()
    if demand_type == "construction":
        last_construction = (
            Under_construction.query.filter(
                Under_construction.player_id == player.id
            )
            .filter(Under_construction.family != "technologies")
            .filter(Under_construction.start_time != None)
            .filter(Under_construction.suspension_time == None)
            .order_by(Under_construction.start_time.desc())
            .first()
        )
        if last_construction:
            last_construction.suspension_time = time.time()
            db.session.commit()
    if demand_type == "research":
        last_research = (
            Under_construction.query.filter(
                Under_construction.player_id == player.id
            )
            .filter(Under_construction.family == "technologies")
            .filter(Under_construction.start_time != None)
            .filter(Under_construction.suspension_time == None)
            .order_by(Under_construction.start_time.desc())
            .first()
        )
        if last_research:
            last_research.suspension_time = time.time()
            db.session.commit()
    if demand_type == "transport":
        last_shipment = (
            Shipment.query.filter(Shipment.player_id == player.id)
            .order_by(Shipment.start_time.desc())
            .first()
        )
        if last_shipment:
            last_shipment.suspension_time = time.time()
            db.session.commit()
    if demand_type in [
        "coal_mine",
        "oil_field",
        "gas_drilling_site",
        "uranium_mine",
    ]:
        demand[demand_type][t] = satisfaction


def add_emissions(engine, player, t, facility, amount):
    engine.data["current_data"][player.username]["emissions"][facility][
        t
    ] += amount
    player.emissions += amount
    engine.data["current_CO2"][t] += amount
