"""
The game states update functions are defined here
"""

import pickle
import time
import math
import pandas as pd
import numpy as np
from sqlalchemy.sql.expression import func
from .database import Network, Player, Under_construction, Shipment, Hex
from . import db

ressource_to_extraction = {
    "coal": "coal_mine",
    "oil": "oil_field",
    "gas": "gas_drilling_site",
    "uranium": "uranium_mine",
}

extraction_to_ressource = {
    "coal_mine": "coal",
    "oil_field": "oil",
    "gas_drilling_site": "gas",
    "uranium_mine": "uranium",
}


# fuction that updates the ressources of all players according to extraction capacity
def update_ressources(engine):
    t = engine.data["current_t"]
    # keep CO2 values for next t
    engine.data["current_CO2"][t] = engine.data["current_CO2"][t - 1]

    # DO THIS AT THE END !
    players = Player.query.all()
    for player in players:
        if player.tile is None:
            continue
        assets = engine.config[player.id]["assets"]
        demand = engine.data["current_data"][player.username]["demand"]
        player_ressources = engine.data["current_data"][player.username]["ressources"]
        warehouse_caps = engine.config[player.id]["warehouse_capacities"]
        extraction_facility_demand(engine, player, t, assets, demand)
        for ressource in ressource_to_extraction:
            facility = ressource_to_extraction[ressource]
            if getattr(player, facility) > 0:
                max_warehouse = (
                    warehouse_caps[ressource] - player_ressources[ressource][t - 1]
                )
                max_prod = (
                    getattr(player, facility) * assets[facility]["amount produced"]
                )
                amount_produced = min(max_prod, max_warehouse)
                setattr(player, ressource, getattr(player, ressource) + 
                        amount_produced)
                setattr(player.tile, ressource, max(0, getattr(player.tile, 
                                                    ressource) - amount_produced))
                facility_emmissions = assets[facility]["pollution"] * amount_produced / 1000
                add_emissions(engine, player, t, facility, facility_emmissions)
            player_ressources[ressource][t] = getattr(player, ressource)

    db.session.commit()
    

# function that updates the electricity generation and storage status for all players according to capacity and external factors
def update_electricity(engine):
    t = engine.data["current_t"]
    networks = Network.query.all()
    for network in networks:
        market = {
            "capacities": pd.DataFrame(
                {"player": [], "capacity": [], "price": [], "facility": []}
            ),
            "demands": pd.DataFrame(
                {"player": [], "capacity": [], "price": [], "facility": []}
            ),
        }
        # For each player in the network, calculate the demand and the minimal amount of electricity generation at time t
        for player in network.members:
            if player.tile is None:
                continue
            init_storage(engine, player, t)
            total_demand = calculate_demand(engine, player, t)
            market = calculate_generation_with_market(
                engine, market, total_demand, player, t
            )
        market_logic(engine, market, t)
        engine.data["network_data"][network.name]["price"][t] = market["market_price"]
        engine.data["network_data"][network.name]["quantity"][t] = market[
            "market_quantity"
        ]
        with open(
            f"instance/network_data/{network.name}/charts/market_t{engine.data['total_t']}.pck",
            "wb",
        ) as file:
            pickle.dump(market, file)

    players = Player.query.all()
    for player in players:
        current_data = engine.data["current_data"][player.username]
        if player.tile is None:
            continue
        # Production update for players that are not in a network
        if player.network is None:
            init_storage(engine, player, t)
            total_demand = calculate_demand(engine, player, t)
            calculate_generation_without_market(engine, total_demand, player, t)
        # For players in network, subtract the difference between import and exports to ignore energy that has been bought from themselves
        else:
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
        # Ressource and pollution update for all players
        ressources_and_pollution(engine, player, t)
        # add money from industry income
        player.money += current_data["revenues"]["industry"][t]
        player.average_revenues = (
            player.average_revenues
            + 60
            * 0.03
            * sum(
                [current_data["revenues"][rev][t] for rev in current_data["revenues"]]
            )
        ) / 1.03
        # update display of resources and money
        player.update_resources()

    # save changes
    db.session.commit()

def init_storage(engine, player, t):
    """Keep t-1 level of storage at t"""
    storage = engine.data["current_data"][player.username]["storage"]
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            storage[facility][t] = storage[facility][t - 1]



def extraction_facility_demand(engine, player, t, assets, demand):
    """Calculate power consumption of extraction facilites"""
    player_ressources = engine.data["current_data"][player.username]["ressources"]
    warehouse_caps = engine.config[player.id]["warehouse_capacities"]
    for ressource in ressource_to_extraction:
        facility = ressource_to_extraction[ressource]
        if getattr(player, facility) > 0:
            max_warehouse = (warehouse_caps[ressource] - player_ressources[ressource][t-1])
            max_prod = getattr(player, facility) * assets[facility]["amount produced"]
            power_factor = 0.2 + 0.8 * min(1, max_warehouse/max_prod)
            demand[facility][t] = assets[facility]["power consumption"] * getattr(player, facility) * power_factor

def industry_demand_and_revenues(engine, player, t, assets, demand, revenues):
    """calculate power consumption and revenues from industry"""
    # interpolating seasonal factor on the day
    day = engine.data["total_t"]//1440
    seasonal_factor = (engine.industry_seasonal[day%51]*(1440-engine.data["total_t"]%1440)+engine.industry_seasonal[(day+1)%51]*(engine.data["total_t"]%1440))/1440
    industry_demand = engine.industry_demand[t-1]*seasonal_factor*assets["industry"]["power consumption"]
    demand["industry"][t] = min(demand["industry"][t-1]+0.05*industry_demand,industry_demand) # progressive demand change in case of restart
    # calculate income of industry
    industry_income = engine.config[player.id]["assets"]["industry"]["income"] / 1440.0
    revenues["industry"][t] = industry_income
    for ud in player.under_construction:
        if ud.start_time is not None:
            # industry demand ramps up during construction
            if ud.name == "industry":
                if ud.suspension_time is None:
                    time_fraction = (time.time() - ud.start_time) / (ud.duration)
                else:
                    time_fraction = (ud.suspension_time - ud.start_time) / (ud.duration)
                time_fraction = (time.time() - ud.start_time) / (ud.duration)
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

def construction_demand(player, t, assets, demand):
    """calculate power consumption for facilites under construction"""
    for ud in player.under_construction:
        if ud.start_time is not None:
            if ud.suspension_time is None:
                construction = assets[ud.name]
                if ud.family == "technologies":
                    demand["research"][t] += construction["construction power"]
                else:
                    demand["construction"][t] += construction["construction power"] 


def construction_emissions(engine, player, t, assets):
    """calculate emissions of facilites under construction"""       
    emissions_construction = 0
    for ud in player.under_construction:
        if ud.start_time is not None:
            if ud.suspension_time is None and ud.family != "technologies":
                construction = assets[ud.name]
                emissions_construction += construction["construction pollution"] / construction["construction time"]
    add_emissions(engine, player, t, "construction", emissions_construction)

def shipment_demand(engine, player, t, demand):
    """calculate the power consumption for shipments"""
    transport = engine.config[player.id]["transport"]
    for shipment in player.shipments:
        if shipment.suspension_time == None:
            demand["transport"][t] += transport["power consumption"] / transport["time"] * shipment.quantity * 3.6

# calculates the electricity demand of one player
def calculate_demand(engine, player, t):
    assets = engine.config[player.id]["assets"]
    demand = engine.data["current_data"][player.username]["demand"]
    revenues = engine.data["current_data"][player.username]["revenues"]
    extraction_facility_demand(engine, player, t, assets, demand)
    industry_demand_and_revenues(engine, player, t, assets, demand, revenues)
    construction_demand(player, t, assets, demand)
    shipment_demand(engine, player, t, demand)
    return sum([demand[i][t] for i in demand])


# calculate generation of a player that doesn't belong to a network
# CURRENTLY NO STORAGE LOGIC
def calculate_generation_without_market(engine, total_demand, player, t):
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    demand = engine.data["current_data"][player.username]["demand"]
    storage = engine.data["current_data"][player.username]["storage"]
    # generation of non controllable facilities is calculated from weather data
    total_generation = 0
    renewables_generation(engine, player, assets, generation, t)
    # priority list of power facilities according to SCP and price :
    priority_list = read_priority_list(
        player.self_consumption_priority
    ) + read_priority_list(player.rest_of_priorities)
    for facility in priority_list:
        if assets[facility]["ramping speed"] != 0 and getattr(player, facility) > 0:
            generation[facility][t] = calculate_prod(
                "min",
                player,
                assets,
                facility,
                generation,
                t,
                storage=storage if facility in engine.storage_facilities else None,
            )
        total_generation += generation[facility][t]
    # If the player is not able to use all the min. generated energy, it has to be dumped at a cost of 5 ¤ per MWh
    if total_generation > total_demand:
        dumping = total_generation - total_demand
        demand["dumping"][t] = dumping
        player.money -= dumping * 5 / 1000000
        revenue = engine.data["current_data"][player.username]["revenues"]
        revenue["dumping"][t] -= dumping * 5 / 1000000
        return
    # while the produced power is not sufficient for own demand, for each power facility following the priority list,
    # set the power to the maximum possible value (max upward power ramp).
    # For the PP that overshoots the demand, find the equilibirum power generation value.
    if total_demand > total_generation:
        for facility in priority_list:
            if assets[facility]["ramping speed"] != 0:
                max_prod = calculate_prod(
                    "max",
                    player,
                    assets,
                    facility,
                    generation,
                    t,
                    storage=storage if facility in engine.storage_facilities else None,
                )
                # range of possible power variation
                delta_prod = max_prod - generation[facility][t]
                # case where the facility is the one that could overshoot the equilibium :
                if total_demand - total_generation < delta_prod:
                    generation[facility][t] += total_demand - total_generation
                    total_generation = total_demand
                    break
                else:
                    total_generation += delta_prod
                    generation[facility][t] += delta_prod
    # if demand is still not met, mesures have to be taken to reduce demand
    if total_demand > total_generation:
        cumul_demand = 0.2 * sum(
            [
                assets[mine]["power consumption"] * getattr(player, mine)
                for mine in [
                    "coal_mine",
                    "oil_field",
                    "gas_drilling_site",
                    "uranium_mine",
                ]
            ]
        )
        for demand_type in player.demand_priorities.split(" "):
            cumul_demand += demand[demand_type][t]
            if cumul_demand > total_generation:
                reduce_demand(engine, demand_type, player, demand, assets, t)


# calculates in-house satisfaction and sets the capacity offers and demands on the market
def calculate_generation_with_market(engine, market, total_demand, player, t):
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    demand = engine.data["current_data"][player.username]["demand"]
    storage = engine.data["current_data"][player.username]["storage"]
    # generation of non controllable facilities is calculated from weather data
    total_generation = 0
    renewables_generation(engine, player, assets, generation, t)
    # priority list of power facilities according to SCP and price :
    priority_list = read_priority_list(
        player.self_consumption_priority
    ) + read_priority_list(player.rest_of_priorities)
    for facility in priority_list:
        if getattr(player, facility) > 0:
            if assets[facility]["ramping speed"] != 0:
                generation[facility][t] = calculate_prod(
                    "min",
                    player,
                    assets,
                    facility,
                    generation,
                    t,
                    storage=storage if facility in engine.storage_facilities else None,
                )
                if facility in engine.storage_facilities:
                    storage[facility][t] -= (
                        generation[facility][t]
                        / 60
                        / (assets[facility]["efficiency"] ** 0.5)
                    )  # Transform W in Wh + efficiency loss
            total_generation += generation[facility][t]
            # If the player is not able to use all the min. generated energy, it is put on the market for -5¤/MWh
            if total_generation > total_demand:
                capacity = min(generation[facility][t], total_generation - total_demand)
                market = offer(market, player, capacity, -5, facility)
    # while the produced power is not sufficient for own demand, for each power facility following the priority list,
    # set the power to the maximum possible value (max upward power ramp).
    # For the PP that overshoots the demand, find the equilibirum power generation value.
    # The additional available generation capacity is put on the market.
    for facility in read_priority_list(player.self_consumption_priority):
        if assets[facility]["ramping speed"] != 0:
            max_prod = calculate_prod(
                "max",
                player,
                assets,
                facility,
                generation,
                t,
                storage=storage if facility in engine.storage_facilities else None,
            )
            # range of possible power variation
            delta_prod = max_prod - generation[facility][t]
            # case where the facility is the one that could overshoot the equilibium :
            if total_demand - total_generation < delta_prod:
                gen_frac = max(0, total_demand - total_generation)
                generation[facility][t] += gen_frac
                if facility in engine.storage_facilities:
                    storage[facility][t] -= (
                        gen_frac / 60 / (assets[facility]["efficiency"] ** 0.5)
                    )  # Transform W in Wh + efficiency loss
                # additional capacity sold on the market
                capacity = delta_prod - gen_frac
                price = getattr(player, "price_" + facility)
                market = offer(market, player, capacity, price, facility)
                total_generation = total_demand
            else:
                total_generation += delta_prod
                generation[facility][t] += delta_prod
                if facility in engine.storage_facilities:
                    storage[facility][t] -= (
                        delta_prod / 60 / (assets[facility]["efficiency"] ** 0.5)
                    )  # Transform W in Wh + efficiency loss

    # if demand is still not met, player has to bid on the market at the set prices
    if total_demand > total_generation:
        cumul_demand = 0.2 * sum(
            [
                assets[mine]["power consumption"] * getattr(player, mine)
                for mine in [
                    "coal_mine",
                    "oil_field",
                    "gas_drilling_site",
                    "uranium_mine",
                ]
            ]
        )
        if cumul_demand > total_generation:
            bid_q = cumul_demand - total_generation
            market = bid(market, player, bid_q)
        for demand_type in player.demand_priorities.split(" "):
            cumul_demand += demand[demand_type][t]
            if cumul_demand > total_generation:
                # mining facilities have 20% base demand (infinite price) and 80% variable demand
                if demand_type in [
                    "coal_mine",
                    "oil_field",
                    "gas_drilling_site",
                    "uranium_mine",
                ]:
                    bid_q = min(
                        cumul_demand - total_generation,
                        demand[demand_type][t]
                        - 0.2
                        * assets[demand_type]["power consumption"]
                        * getattr(player, demand_type),
                    )
                else:
                    bid_q = min(cumul_demand - total_generation, demand[demand_type][t])
                price = getattr(player, "price_buy_" + demand_type)
                market = bid(market, player, bid_q, price, demand_type)

    # Sell capacities of remaining facilities on the market
    for facility in read_priority_list(player.rest_of_priorities):
        if assets[facility]["ramping speed"] != 0:
            if getattr(player, facility) > 0:
                max_prod = calculate_prod(
                    "max",
                    player,
                    assets,
                    facility,
                    generation,
                    t,
                    storage=storage if facility in engine.storage_facilities else None,
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


# Calculate overall network demand, class all capacity offers in ascending order of price and find the market price of electricity
# Sell all capacities that are below market price at market price.
def market_logic(engine, market, t):
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
    demand_price = demands.loc[
        demands["cumul_capacities"] >= total_market_capacity, "price"
    ]
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
                sell(engine, row, market_price, t, quantity=sold_cap)
            # dumping electricity that is offered for negative price and not sold
            if row.price < 0:
                rest = max(0, min(row.capacity, row.capacity - sold_cap))
                dump_cap = rest
                demand = engine.data["current_data"][row.player.username]["demand"]
                demand["dumping"][t] += dump_cap
                row.player.money -= dump_cap * 5 / 1000000
                revenue = engine.data["current_data"][row.player.username]["revenues"]
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
            assets = engine.config[row.player.id]["assets"]
            reduce_demand(engine, row.facility, row.player, demand, assets, t)
        else:
            buy(engine, row, market_price, t)
    market["market_price"] = market_price
    market["market_quantity"] = market_quantity


# Finding market price and quantity by finding the intersection of demand and suppply
def market_optimum(offers_og, demands_og):
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
    demands.loc[len(demands) - 1, "price"] = -10

    merged_table = pd.concat([offers, demands], ignore_index=True)
    merged_table = merged_table.sort_values(by="cumul_capacities")

    for row in merged_table.itertuples(index=False):
        if np.isnan(row.index_offer):
            price_d = row.price
        else:
            price_o = row.price
        if price_o == np.inf:
            if price_d == np.inf:
                price = 2 * max(offers_og["price"])
            else:
                price = price_d
            return price, row.cumul_capacities
        if price_d < price_o:
            price = price_d
            if np.isnan(row.index_offer):
                price = price_o
            return price, row.cumul_capacities


# Calculates the min or max power production of a facility in at time t considering ramping constraints, ressources constraints and max and min power constraints
def calculate_prod(
    minmax, player, assets, facility, generation, t, storage=None, filling=False
):
    max_ressources = np.inf
    ramping_speed = getattr(player, facility) * assets[facility]["ramping speed"]
    if storage is None:
        if facility == "combined_cycle":
            available_gas = player.gas - player.gas_on_sale
            available_coal = player.coal - player.coal_on_sale
            max_ressources = min(
                available_gas / assets[facility]["amount consumed"][0] * 60000000,
                available_coal / assets[facility]["amount consumed"][1] * 60000000,
            )
        elif assets[facility]["amount consumed"] != 0:
            ressource = assets[facility]["consumed ressource"]
            available_ressource = getattr(player, ressource) - getattr(
                player, ressource + "_on_sale"
            )
            max_ressources = (
                available_ressource / assets[facility]["amount consumed"] * 60000000
            )
    else:
        if filling:
            E = (
                max(
                    0,
                    assets[facility]["storage capacity"] * getattr(player, facility)
                    - storage[facility][t - 1],
                )
                * 60
                * (assets[facility]["efficiency"] ** 0.5)
            )  # max remaining storage space
        else:
            E = max(
                0,
                storage[facility][t - 1] * 60 * (assets[facility]["efficiency"] ** 0.5),
            )  # max available storge content
        max_ressources = min(
            E, (2 * E * ramping_speed) ** 0.5 - 0.5 * ramping_speed
        )  # ramping down
    if minmax == "max":
        max_ramping = generation[facility][t - 1] + ramping_speed
        return min(
            max_ressources,
            max_ramping,
            getattr(player, facility) * assets[facility]["power generation"],
        )
    else:
        min_ramping = generation[facility][t - 1] - ramping_speed
        return max(0, min(max_ressources, min_ramping))


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


def bid(market, player, demand, price=np.inf, facility=None):
    if demand > 0:
        new_row = pd.DataFrame(
            {
                "player": [player],
                "capacity": [demand],
                "price": [price],
                "facility": [facility],
            }
        )
        market["demands"] = pd.concat([market["demands"], new_row], ignore_index=True)
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


def ressources_and_pollution(engine, player, t):
    assets = engine.config[player.id]["assets"]
    generation = engine.data["current_data"][player.username]["generation"]
    revenue = engine.data["current_data"][player.username]["revenues"]
    # Calculate ressource consumption
    for facility in [
        "coal_burner",
        "oil_burner",
        "gas_burner",
        "nuclear_reactor",
        "nuclear_reactor_gen4",
    ]:
        ressource = assets[facility]["consumed ressource"]
        quantity = (
            assets[facility]["amount consumed"] * generation[facility][t] / 60000000
        )
        setattr(player, ressource, getattr(player, ressource) - quantity)
    # Special case steam engine costs money and if it is not used it costs half of the maximum
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
    # special case of combined cycle
    quantity_gas = (
        assets["combined_cycle"]["amount consumed"][0]
        * generation["combined_cycle"][t]
        / 60000000
    )
    quantity_coal = (
        assets["combined_cycle"]["amount consumed"][1]
        * generation["combined_cycle"][t]
        / 60000000
    )
    player.gas -= quantity_gas
    player.coal -= quantity_coal
    # emissions (emissions of extraction facilities are calculated in update_ressources)
    for facility in [
        "steam_engine",
        "coal_burner",
        "oil_burner",
        "gas_burner",
        "combined_cycle",
        "nuclear_reactor",
        "nuclear_reactor_gen4",
    ]:
        facility_emmissions = (
            assets[facility]["pollution"] * generation[facility][t] / 60000000
        )
        add_emissions(engine, player, t, facility, facility_emmissions)


def renewables_generation(engine, player, assets, generation, t):
    # WIND
    power_factor = interpolate_wind(engine, player, t)
    for facility in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
        generation[facility][t] = (power_factor
                                * assets[facility]["power generation"]
                                * getattr(player, facility))
    #SOLAR
    power_factor = engine.data["current_irradiation"][t]/875 * player.tile.solar # 875 W/m2 is the maximim irradiation in Zürich
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


def read_priority_list(list):
    if list == "":
        return []
    else:
        return list.split(" ")


# mesures taken to reduce demand
def reduce_demand(engine, demand_type, player, demand, assets, t):
    if demand_type == "industry":
        player.industry = max(1, player.industry - 1)
        engine.config.update_config_for_user(player.id)
        db.session.commit()
    if demand_type == "construction":
        last_construction = (
            Under_construction.query.filter(Under_construction.player_id == player.id)
            .filter(Under_construction.family != "technologies")
            .filter(Under_construction.start_time is not None)
            .filter(Under_construction.suspension_time is None)
            .order_by(Under_construction.start_time.desc())
            .first()
        )
        if last_construction:
            last_construction.suspension_time = time.time()
            db.session.commit()
    if demand_type == "research":
        last_research = (
            Under_construction.query.filter(Under_construction.player_id == player.id)
            .filter(Under_construction.family == "technologies")
            .filter(Under_construction.start_time is not None)
            .filter(Under_construction.suspension_time is None)
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
            random_tile = Hex.query.order_by(func.random()).first()
            setattr(
                random_tile,
                last_shipment.resource,
                getattr(random_tile, last_shipment.resource) + last_shipment.quantity,
            )
            last_shipment.suspension_time = time.time()
            db.session.commit()
    # complicated logic to adjust resource production
    if demand_type in ["coal_mine", "oil_field", "gas_drilling_site", "uranium_mine"]:
        resource_name = extraction_to_ressource[demand_type]
        q_resource = engine.data["current_data"][player.username]["ressources"][resource_name]
        takeback = q_resource[t]-q_resource[t-1]
        setattr(player, resource_name, getattr(player, resource_name)-takeback)
        setattr(player.tile, resource_name, getattr(player.tile, resource_name)+takeback)
        q_resource[t] = getattr(player, resource_name)
        energy_demand = (
            0.2
            * assets[demand_type]["power consumption"]
            * getattr(player, demand_type)
        )
        demand[demand_type][t] = min(
            demand[demand_type][t - 1] + 0.2 * energy_demand, energy_demand
        )  # for smooth demand changes
        emmissions_takeback = engine.data["current_data"][player.username]["emissions"][
            demand_type
        ][t]
        add_emissions(engine, player, t, demand_type, -emmissions_takeback)
        db.session.commit()


def add_emissions(engine, player, t, facility, amount):
    engine.data["current_data"][player.username]["emissions"][facility][t] += amount
    player.emissions += amount
    engine.data["current_CO2"][t] += amount
