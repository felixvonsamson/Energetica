"""
The game states update functions are defined here
"""

import datetime
import pickle
import pandas as pd
import numpy as np
from .database import Network, Player
from . import db

# fuction that updates the ressources of all players according to extraction capacity (and trade)
def update_ressources(engine):
    t = datetime.datetime.today().time().hour
    players = Player.query.all()
    for player in players:
        assets = engine.config[player.id]["assets"]
        player_data = engine.current_data[player.username]

        coal = player.coal_mine * assets["coal_mine"]["amount produced"]
        player_data["ressources"]["coal"][t] = coal
        player.coal += coal

        oil = player.oil_field * assets["oil_field"]["amount produced"]
        player_data["ressources"]["oil"][t] = oil
        player.oil += oil

        gas = player.gas_drilling_site * assets["gas_drilling_site"]["amount produced"]
        player_data["ressources"]["gas"][t] = gas
        player.gas += gas

        uranium = player.uranium_mine * assets["uranium_mine"]["amount produced"]
        player_data["ressources"]["uranium"][t] = uranium
        player.uranium += uranium
    db.session.commit()

# function that updates the electricity generation and storage status for all players according to capacity and external factors (and trade)
def update_electricity(engine):
    t = engine.current_t
    print(f"t = {t}")
    networks = Network.query.all()
    for network in networks:
        market = {
            "capacities": pd.DataFrame(
                {'player': [], 'capacity': [], 'price': [], 'plant': []}),
            "demands" : pd.DataFrame(
                {'player': [], 'capacity': [], 'price': [], 'plant': []})
        }
        # For each player in the network, calculate the demand and the minimal amount of electricity generation at time t
        for player in network.members:
            total_demand = calculate_demand(engine, player, t)
            market = calculate_generation_with_market(engine, market, 
                                                      total_demand, player, t)
        market_logic(engine, market, t)

    # For players that are not in a network
    players = Player.query.all()
    for player in players:
        if player.network == None:
            total_demand = calculate_demand(engine , player, t)
            calculate_generation_without_market(engine, total_demand, player, t)
    
    #save changes 
    db.session.commit()
    # temporary for debugging
    with open("instance/engine_data.pck", "wb") as file:
        pickle.dump(engine.current_data, file)
        print("saved engine data")

# calculates the electricity demand of one player
def calculate_demand(engine, player, t):
    assets = engine.config[player.id]["assets"]
    demand = engine.current_data[player.username]["demand"]
    # demand form assets under construction
    demand_construction = 0
    for ud in player.under_construction:
        construction = assets[ud.name]
        demand_construction += (construction["construction energy"] 
            / construction["construction time"] * 60)
    # ADD DEMAND OF EXTRACTION PLANTS
    demand["construction"][t] = demand_construction
    return sum([demand[i][t] for i in demand])

# calculate generation of a player that doesn't belong to a network
# CURRENTLY NO STORAGE LOGIC
def calculate_generation_without_market(engine, total_demand, player, t):
    assets = engine.config[player.id]["assets"]
    generation = engine.current_data[player.username]["generation"]
    demand = engine.current_data[player.username]["demand"]
    storage = engine.current_data[player.username]["storage"]
    total_generation = 0
    # priority list of power plants according to SCP and price :
    priority_list = (player.self_consumption_priority.split(' ') 
        + player.rest_of_priorities.split(' '))
    for plant in priority_list:
        # If the plant is not contollable the generation level is given
        if assets[plant]["ramping speed"] == 0:
            generation[plant][t] = (generation[plant][t]
                                * assets[plant]["power generation"]
                                * getattr(player, plant))
            total_generation += generation[plant][t]
        # else the minimal generation level is given by the ramping down constraint
        else:
            generation[plant][t] = max(0,
                generation[plant][t - 1] - getattr(player, plant)
                * assets[plant]["ramping speed"])
            total_generation += generation[plant][t]
        # If the player is not able to use all the min. generated energy, it has to be dumped at a cost of 10 CHF per MWh
        if total_generation > total_demand:
            dumping = min(generation[plant][t], total_generation-total_demand)
            demand["dumping"] = dumping
            player.money -= dumping * 10 / 1000000
    # while the produced power is not sufficient for own demand, for each power plant following the priority list,
    # set the power to the maximum possible value (max upward power ramp). 
    # For the PP that overshoots the demand, find the equilibirum power generation value.
    for plant in priority_list:
        if assets[plant]["ramping speed"] != 0:
            max_prod = min(generation[plant][t - 1] + getattr(player, plant)
                * assets[plant]["ramping speed"],
                getattr(player, plant) * assets[plant]["power generation"])
            # range of possible power variation
            delta_prod = max_prod - generation[plant][t]
            # case where the plant is the one that could overshoot the equilibium :
            if total_demand - total_generation < delta_prod:
                generation[plant][t] += total_demand - total_generation
                total_generation = total_demand
            else:
                total_generation += delta_prod
                generation[plant][t] += delta_prod
    # if demand is still not met, players industry is leveled down
    if total_demand > total_generation:
        player.industry -= 1

# calculates in-house satisfaction and sets the capacity offers and demands on the market
def calculate_generation_with_market(engine, market, total_demand, player, t):
    assets = engine.config[player.id]["assets"]
    generation = engine.current_data[player.username]["generation"]
    storage = engine.current_data[player.username]["storage"]
    total_generation = 0
    # priority list of power plants according to SCP and price :
    priority_list = player.self_consumption_priority.split(' ') 
    + player.rest_of_priorities.split(' ')
    for plant in priority_list:
        # If the plant is not contollable the generation level is given
        if assets[plant]["ramping speed"] == 0:
            generation[plant][t] = (generation[plant][t]
                                * assets[plant]["power generation"]
                                * getattr(player, plant))
            total_generation += generation[plant][t]
        # else the minimal generation level is given by the ramping down constraint
        else:
            generation[plant][t] = max(0,
                generation[plant][t - 1] - getattr(player, plant)
                * assets[plant]["ramping speed"])
            total_generation += generation[plant][t]
        # If the player is not able to use all the min. generated energy, it is put on the market for -10CHF/MWh
        if total_generation > total_demand:
            capacity = min(generation[plant][t], total_generation-total_demand)
            market = offer(market, player, capacity, -10, plant)
    # while the produced power is not sufficient for own demand, for each power plant following the priority list,
    # set the power to the maximum possible value (max upward power ramp). 
    # For the PP that overshoots the demand, find the equilibirum power generation value.
    # The additional available generation capacity is put on the market.
    for plant in player.self_consumption_priority.split(' '):
        if assets[plant]["ramping speed"] != 0:
            max_prod = min(generation[plant][t - 1] + getattr(player, plant)
                * assets[plant]["ramping speed"],
                getattr(player, plant) * assets[plant]["power generation"])
            # range of possible power variation
            delta_prod = max_prod - generation[plant][t]
            # case where the plant is the one that could overshoot the equilibium :
            if total_demand - total_generation < delta_prod:
                generation[plant][t] += total_demand - total_generation
                # additional capacity sold on the market
                capacity = delta_prod - total_demand + total_generation
                price = getattr(player, "price_" + plant)
                market = offer(market, player, capacity, price, plant)
                total_generation = total_demand
            else:
                total_generation += delta_prod
                generation[plant][t] += delta_prod

    # if demand is still not met, player has to by on the market
    if total_demand > total_generation:
        demand = total_demand - total_generation
        market = bid(market, player, demand)
    
    # Sell capacities of remaining plants on the market
    for plant in player.rest_of_priorities.split(' '):
        if assets[plant]["ramping speed"] != 0:
            max_power = getattr(player, plant) * assets[plant]["power generation"]
            max_ramping = generation[plant][t - 1] + getattr(player, plant) * assets[plant]["ramping speed"]
            max_prod = min(max_ramping, max_power)
            price = getattr(player, "price_" + plant)
            capacity = max_prod - generation[plant][t]
            market = offer(market, player, capacity, price, plant)
         
    # NO RAMPING SPEED TAKEN INTO ACCOUNT YET 
    for plant in engine.storage_plants :
        # Storage capacity sold on the market
        capacity = min(storage[plant][t - 1] * 60, # Transform W in Wh
                    getattr(player, plant) * assets[plant]["power generation"])
        price = getattr(player, "price_sell_" + plant)
        market = offer(market, player, capacity, price, plant)
        # Demand curve for storage
        demand = min((assets[plant]["storage capacity"] * 
                    getattr(player, plant) - storage[plant][t - 1]) * 60,
                    getattr(player, plant) * assets[plant]["power generation"])
        price = getattr(player, "price_buy_" + plant)
        market = bid(market, player, demand, price, plant)
    return market
        
# Calculate overall network demand, class all capacity offers in ascending order and find the market price of electricity
# Sell all capacities that are below market price at market price.
def market_logic(engine, market, t):
    offers = market["capacities"]
    offers.sort_values("price")
    offers['cumul_capacities'] = offers['capacity'].cumsum()

    demands = market["demands"]
    demands.sort_values(by="price", ascending=False, inplace=True)
    demands['cumul_capacities'] = demands['capacity'].cumsum()

    total_market_capacity = offers["capacity"].sum()
    network_demand = demands.groupby('price')['capacity'].sum()[np.inf]

    # If network prioritary demand is higher than total supply -> only partial satisfaction of demand and level down of industry.
    if total_market_capacity < network_demand:
        satisfaction = total_market_capacity / network_demand
        market_price = offers["price"][-1]
        for row in demands.itertuples(index=False):
            if row.plant == None:
                buy(engine, row, market_price, t, quantity=row.demand 
                    * satisfaction)
                row.player.industry -= 1
        for row in offers.itertuples(index=False):
            sell(engine, row, market_price, t)
    else:
        market_price, market_quantity = market_optimum(offers, demands)
        # sell all capacities under market price
        for row in offers.itertuples(index=False):
            if row.cumul_capacities > market_quantity:
                sold_cap = row.capacity - row.cumul_capacities + market_quantity
                if sold_cap > 0:
                    sell(engine, row, market_price, t, quantity=sold_cap)
                # dumping electricity that is not offered for negative price and not sold
                if row.price < 0:
                    rest = row.capacity-sold_cap
                    dump_cap = rest if rest>0 else row.capacity
                    demand = engine.current_data[row.player.username]["demand"]
                    demand["dumping"] = dump_cap
                    row.player.money -= dump_cap * 10 / 1000000
                    continue
                break
            sell(engine, row, market_price, t)
        # buy all demands over market price
        for row in demands.itertuples(index=False):
            if row.cumul_capacities > market_quantity:
                bought_cap = row.capacity - row.cumul_capacities + market_quantity
                buy(engine, row, market_price, t, quantity=bought_cap)
                break
            buy(engine, row, market_price, t)

# Finding market price and quantity by finding the intersection of demand and suppply
def market_optimum(offers_og, demands_og):
    offers = offers_og.copy()
    demands = demands_og.copy()

    offers["index_offer"] = range(len(offers))
    offers["price"] = offers["price"].shift(-1)
    offers.loc[len(offers) - 1, "price"] = np.inf
    demands["price"] = demands["price"].shift(-1)
    demands.loc[len(demands) - 1, "price"] = 0

    merged_table = pd.concat([offers, demands], ignore_index=True)
    merged_table = merged_table.sort_values(by="cumul_capacities")

    price_d = np.inf
    price_o = -10
    for row in merged_table.itertuples(index=False):
        if np.isnan(row.index_offer):
            price_d = row.price
        else:
            price_o = row.price
        if price_d < price_o:
            price = price_d
            if np.isnan(row.index_offer):
                price = price_o
            return price, row.cumulative_capacity
    return price_d, row.cumulative_capacity

def offer(market, player, capacity, price, plant):
    new_row = {'player': player, 'capacity': capacity, 'price': price, 
               'plant': plant}
    market["capacities"] = market["capacities"].append(new_row, 
                                                       ignore_index=True)
    return market

def bid(market, player, demand, price = np.inf, plant = None):
    new_row = {'player': player, 'capacity': demand, 'price': price, 
               'plant': plant}
    market["demands"] = market["demands"].append(new_row, ignore_index=True)
    return market

def sell(engine, row, market_price, t, quantity=None):
    generation = engine.current_data[row.player.username]["generation"]
    demand = engine.current_data[row.player.username]["demand"]
    storage = engine.current_data[row.player.username]["storage"]
    if quantity == None:
        quantity = row.capacity
    if row.plant in engine.storage_plants:
        storage[row.plant][t] -= quantity / 60 # Transform W in Wh
        generation[row.plant][t] += quantity
    else :
        generation[row.plant][t] += quantity
    demand["exports"][t] += quantity
    row.player.money += quantity * market_price / 1000000

def buy(engine, row, market_price, t, quantity=None):
    generation = engine.current_data[row.player.username]["generation"]
    storage = engine.current_data[row.player.username]["storage"]
    demand = engine.current_data[row.player.username]["demand"]
    if quantity == None:
        quantity = row.demand
    if row.plant != None:
        storage[row.plant][t] += quantity / 60 # Transform W in Wh
        demand[row.plant][t] += quantity
    generation["imports"][t] += quantity
    row.player.money -= quantity * market_price / 1000000