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
from .utils import notify

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
    players = Player.query.all()
    networks = Network.query.all()

    new_values = {}
    for player in players:
        new_values[player.id] = engine.data["current_data"][
            player.id
        ].init_new_data()

    for network in networks:
        market = init_market()
        for player in network.members:
            if player.tile is None:
                continue
            calculate_demand(engine, new_values[player.id], player, t)
            market = calculate_generation_with_market(
                engine, new_values[player.id], market, player, t
            )
        market_logic(engine, new_values, market, t)
        # Save market data
        new_network_values = {
            "price": market["market_price"],
            "quantity": market["market_quantity"],
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
            calculate_demand(engine, new_values[player.id], player, t)
            calculate_generation_without_market(engine, new_values, player, t)
        calculate_net_import(new_values[player.id], player.network is not None)
        update_storgage_lvls(engine, new_values[player.id], player, t)
        resources_and_pollution(engine, new_values[player.id], player, t)
        engine.data["current_data"][player.id].append_value(
            new_values[player.id]
        )
        # calculate moving average revenue
        player.average_revenues = (
            player.average_revenues
            + 60
            * 0.03
            * sum(
                [
                    new_values[player.id]["revenues"][rev]
                    for rev in new_values[player.id]["revenues"]
                ]
                + [
                    new_values[player.id]["op_costs"][rev]
                    for rev in new_values[player.id]["op_costs"]
                ]
            )
        ) / 1.03
        # send new data to clients
        player.send_new_data(new_values[player.id])

    # save changes
    db.session.commit()


def init_market():
    """Initialize an empty market"""
    return {
        "capacities": pd.DataFrame(
            {"player_id": [], "capacity": [], "price": [], "facility": []}
        ),
        "demands": pd.DataFrame(
            {"player_id": [], "capacity": [], "price": [], "facility": []}
        ),
    }


def update_storgage_lvls(engine, new_values, player, t):
    """Update storage levels according to the use of storage failities"""
    assets = engine.config[player.id]["assets"]
    generation = new_values["generation"]
    demand = new_values["demand"]
    storage = new_values["storage"]
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            storage[facility] = (
                storage[facility]
                - generation[facility]
                / 60
                / (
                    assets[facility]["efficiency"] ** 0.5
                )  # transform W to Wh and consider efficiency
                + demand[facility]
                / 60
                * (assets[facility]["efficiency"] ** 0.5)
            )


def calculate_net_import(new_values, network):
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


def extraction_facility_demand(engine, new_values, player, t, assets, demand):
    """Calculate power consumption of extraction facilites"""
    player_resources = new_values["resources"]
    warehouse_caps = engine.config[player.id]["warehouse_capacities"]
    for resource in resource_to_extraction:
        facility = resource_to_extraction[resource]
        if getattr(player, facility) > 0:
            max_warehouse = (
                warehouse_caps[resource] - player_resources[resource]
            )
            max_prod = (
                getattr(player, facility) * assets[facility]["amount produced"]
            )
            power_factor = min(1, max_warehouse / max(1, max_prod))
            demand[facility] = (
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
    demand["industry"] = min(
        engine.data["current_data"][player.id].get_last_data(
            "demand", "industry"
        )
        + 0.07 * industry_demand,
        industry_demand,
    )  # progressive demand change in case of restart
    # calculate income of industry
    industry_income = (
        engine.config[player.id]["assets"]["industry"]["income"] / 1440.0
    )
    if demand["industry"] < industry_demand:
        revenues["industry"] = (
            industry_income * demand["industry"] / industry_demand
        )
    else:
        revenues["industry"] = industry_income
    for ud in player.under_construction:
        # industry demand ramps up during construction
        if ud.name == "industry":
            if ud.suspension_time is None:
                time_fraction = (time.time() - ud.start_time) / (ud.duration)
            else:
                time_fraction = (ud.suspension_time - ud.start_time) / (
                    ud.duration
                )
            additional_demand = (
                time_fraction
                * industry_demand
                * (engine.const_config["industry"]["power factor"] - 1)
            )
            additional_revenue = (
                time_fraction
                * (industry_income - 2000 / 1440)
                * (engine.const_config["industry"]["income factor"] - 1)
            )
            demand["industry"] += additional_demand
            revenues["industry"] += additional_revenue
    player.money += revenues["industry"]


def construction_demand(player, t, assets, demand):
    """calculate power consumption for facilites under construction"""
    for ud in player.under_construction:
        if ud.suspension_time is None:
            construction = assets[ud.name]
            if ud.family == "Technologies":
                demand["research"] += construction["construction power"]
            else:
                demand["construction"] += construction["construction power"]


def shipment_demand(engine, player, t, demand):
    """calculate the power consumption for shipments"""
    transport = engine.config[player.id]["transport"]
    for shipment in player.shipments:
        if shipment.suspension_time is None:
            demand["transport"] += (
                transport["power consumption"]
                / transport["time"]
                * shipment.quantity
                * 3.6
            )


def calculate_demand(engine, new_values, player, t):
    """Calculates the electricity demand of one player"""

    assets = engine.config[player.id]["assets"]
    demand = new_values["demand"]
    revenues = new_values["revenues"]

    extraction_facility_demand(engine, new_values, player, t, assets, demand)
    industry_demand_and_revenues(engine, player, t, assets, demand, revenues)
    construction_demand(player, t, assets, demand)
    shipment_demand(engine, player, t, demand)


def calculate_generation_without_market(engine, new_values, player, t):
    internal_market = init_market()
    assets = engine.config[player.id]["assets"]
    generation = new_values[player.id]["generation"]
    demand = new_values[player.id]["demand"]
    # generation of non controllable facilities is calculated from weather data
    renewables_generation(engine, player, assets, generation, t)
    minimal_generation(engine, player, assets, generation)
    facilities = (
        engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
    )
    # Obligatory generation is put on the internal market at a price of -5
    for facility in facilities:
        if getattr(player, facility) > 0:
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

    # offer additional capacities of facilities on the internal market
    for facility in engine.storage_facilities + engine.controllable_facilities:
        if getattr(player, facility) > 0:
            max_prod = calculate_prod(
                "max",
                player,
                assets,
                facility,
                engine.data["current_data"][player.id],
                storage=facility in engine.storage_facilities,
            )
            price = getattr(player, "price_" + facility)
            capacity = max_prod - generation[facility]
            internal_market = offer(
                internal_market, player.id, capacity, price, facility
            )

    # Demand curve for storage (no ramping down constraint, only up)
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            demand_q = calculate_prod(
                "max",
                player,
                assets,
                facility,
                engine.data["current_data"][player.id],
                storage=True,
                filling=True,
            )
            price = getattr(player, "price_buy_" + facility)
            internal_market = bid(
                internal_market, player.id, demand_q, price, facility
            )
    market_logic(engine, new_values, internal_market, t)


def calculate_generation_with_market(engine, new_values, market, player, t):
    assets = engine.config[player.id]["assets"]
    generation = new_values["generation"]
    demand = new_values["demand"]

    excess_generation = 0
    renewables_generation(engine, player, assets, generation, t)
    minimal_generation(engine, player, assets, generation)
    facilities = (
        engine.storage_facilities
        + engine.controllable_facilities
        + engine.renewables
    )
    for facility in facilities:
        if getattr(player, facility) > 0:
            excess_generation += generation[facility]
            market = offer(
                market, player.id, generation[facility], -5, facility
            )

    # if demand is still not met, player has to bid on the market at the set prices
    demand_priorities = player.demand_priorities.split(",")
    for demand_type in demand_priorities:
        bid_q = demand[demand_type]
        price = getattr(player, "price_buy_" + demand_type)
        market = bid(market, player.id, bid_q, price, demand_type)

    # Sell capacities of remaining facilities on the market
    for facility in player.read_project_priority(
        "rest_of_priorities"
    ) + player.read_project_priority("self_consumption_priority"):
        if assets[facility]["ramping speed"] != 0:
            if getattr(player, facility) > 0:
                max_prod = calculate_prod(
                    "max",
                    player,
                    assets,
                    facility,
                    engine.data["current_data"][player.id],
                    storage=facility in engine.storage_facilities,
                )
                price = getattr(player, "price_" + facility)
                capacity = max_prod - generation[facility]
                market = offer(market, player.id, capacity, price, facility)

    # Demand curve for storage (no ramping down constraint, only up)
    for facility in engine.storage_facilities:
        if getattr(player, facility) > 0:
            demand_q = calculate_prod(
                "max",
                player,
                assets,
                facility,
                engine.data["current_data"][player.id],
                storage=True,
                filling=True,
            )
            price = getattr(player, "price_buy_" + facility)
            market = bid(market, player.id, demand_q, price, facility)
    return market


def market_logic(engine, new_values, market, t):
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
                sell(engine, new_values, row, market_price, quantity=sold_cap)
            # dumping electricity that is offered for negative price and not sold
            if row.price < 0:
                rest = max(0, min(row.capacity, row.capacity - sold_cap))
                dump_cap = rest
                player = Player.query.get(row.player_id)
                demand = new_values[row.player_id]["demand"]
                demand["dumping"] += dump_cap
                player.money -= dump_cap * 5 / 60000000
                revenue = new_values[row.player_id]["revenues"]
                revenue["dumping"] -= dump_cap * 5 / 60000000
                continue
            break
        sell(engine, new_values, row, market_price)
    # buy all demands over market price
    for row in demands.itertuples(index=False):
        if row.cumul_capacities > market_quantity:
            bought_cap = row.capacity - row.cumul_capacities + market_quantity
            if bought_cap > 0.1:
                buy(engine, new_values, row, market_price, quantity=bought_cap)
            # if demand is not a storage facility mesures a taken to reduce demand
            if row.facility not in engine.storage_facilities:
                reduce_demand(
                    engine,
                    new_values,
                    engine.data["current_data"][row.player_id],
                    row.facility,
                    row.player_id,
                    max(0, bought_cap),
                )
        else:
            buy(engine, new_values, row, market_price)
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
    demands.loc[len(demands) - 1, "price"] = -6

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
        if getattr(player, facility) > 0:
            generation[facility] = (
                power_factor
                * assets[facility]["power generation"]
                * getattr(player, facility)
            )
    # SOLAR
    power_factor = (
        engine.data["current_irradiation"][t] / 875 * player.tile.solar
    )  # 875 W/m2 is the maximim irradiation in Zürich
    for facility in ["CSP_solar", "PV_solar"]:
        if getattr(player, facility) > 0:
            generation[facility] = (
                power_factor
                * assets[facility]["power generation"]
                * getattr(player, facility)
            )
    # HYDRO
    power_factor = engine.data["current_discharge"][t]
    for facility in ["watermill", "small_water_dam", "large_water_dam"]:
        if getattr(player, facility) > 0:
            generation[facility] = (
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
    minmax,
    player,
    assets,
    facility,
    past_values,
    storage=False,
    filling=False,
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
    if not storage:
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
                    0.0,
                    assets[facility]["storage capacity"]
                    * getattr(player, facility)
                    - past_values.get_last_data("storage", facility),
                )
                * 60
                * (assets[facility]["efficiency"] ** 0.5)
            )  # max remaining storage space
        else:
            E = max(
                0.0,
                past_values.get_last_data("storage", facility)
                * 60
                * (assets[facility]["efficiency"] ** 0.5),
            )  # max available storge content
        max_resources = min(
            E, (2 * E * ramping_speed) ** 0.5 - 0.5 * ramping_speed
        )  # ramping down
    if minmax == "max":
        max_ramping = (
            past_values.get_last_data("generation", facility) + ramping_speed
        )
        return min(
            max_resources,
            max_ramping,
            getattr(player, facility) * assets[facility]["power generation"],
        )
    else:
        min_ramping = (
            past_values.get_last_data("generation", facility) - ramping_speed
        )
        return max(0.0, min(max_resources, min_ramping))


def minimal_generation(engine, player, assets, generation):
    for facility in engine.controllable_facilities + engine.storage_facilities:
        if getattr(player, facility) > 0:
            generation[facility] = calculate_prod(
                "min",
                player,
                assets,
                facility,
                engine.data["current_data"][player.id],
                storage=facility in engine.storage_facilities,
            )


def offer(market, player_id, capacity, price, facility):
    if capacity > 0:
        new_row = pd.DataFrame(
            {
                "player_id": [player_id],
                "capacity": [capacity],
                "price": [price],
                "facility": [facility],
            }
        )
        market["capacities"] = pd.concat(
            [market["capacities"], new_row], ignore_index=True
        )
    return market


def bid(market, player_id, demand, price, facility):
    if demand > 0:
        new_row = pd.DataFrame(
            {
                "player_id": [player_id],
                "capacity": [demand],
                "price": [price],
                "facility": [facility],
            }
        )
        market["demands"] = pd.concat(
            [market["demands"], new_row], ignore_index=True
        )
    return market


def sell(engine, new_values, row, market_price, quantity=None):
    player = Player.query.get(row.player_id)
    generation = new_values[player.id]["generation"]
    demand = new_values[player.id]["demand"]
    storage = new_values[player.id]["storage"]
    revenue = new_values[player.id]["revenues"]
    if quantity is None:
        quantity = row.capacity
    if row.price >= 0:
        generation[row.facility] += quantity
        if row.facility in engine.storage_facilities:
            assets = engine.config[player.id]["assets"]
            storage[row.facility] -= (
                quantity / 60 / (assets[row.facility]["efficiency"] ** 0.5)
            )  # Transform W in Wh + efficiency loss
    demand["exports"] += quantity
    player.money += quantity * market_price / 60000000
    revenue["exports"] += quantity * market_price / 60000000


def buy(engine, new_values, row, market_price, quantity=None):
    player = Player.query.get(row.player_id)
    generation = new_values[player.id]["generation"]
    storage = new_values[player.id]["storage"]
    demand = new_values[player.id]["demand"]
    revenue = new_values[player.id]["revenues"]
    if quantity is None:
        quantity = row.capacity
    if row.facility in engine.storage_facilities:
        assets = engine.config[player.id]["assets"]
        storage[row.facility] += (
            quantity / 60 * (assets[row.facility]["efficiency"] ** 0.5)
        )  # Transform W in Wh + efficiency loss
        demand[row.facility] += quantity
    generation["imports"] += quantity
    player.money -= quantity * market_price / 60000000
    revenue["imports"] -= quantity * market_price / 60000000


def resources_and_pollution(engine, new_values, player, t):
    """Calculate resource use and production, O&M costs and emissions"""
    assets = engine.config[player.id]["assets"]
    generation = new_values["generation"]
    op_costs = new_values["op_costs"]
    demand = new_values["demand"]
    # Calculate resource consumption and pollution of generation facilities
    for facility in engine.controllable_facilities:
        if getattr(player, facility) > 0:
            for resource, amount in assets[facility][
                "consumed resource"
            ].items():
                quantity = amount * generation[facility] / 60000000
                setattr(player, resource, getattr(player, resource) - quantity)
            facility_emmissions = (
                assets[facility]["pollution"] * generation[facility] / 60000000
            )
            add_emissions(
                engine, new_values, player, t, facility, facility_emmissions
            )

    if player.warehouse > 0:
        for extraction_facility in engine.extraction_facilities:
            resource = extraction_to_resource[extraction_facility]
            if getattr(player, extraction_facility) > 0:
                max_demand = assets[extraction_facility][
                    "power consumption"
                ] * getattr(player, extraction_facility)
                production_factor = demand[extraction_facility] / max_demand
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
                    player,
                    resource,
                    getattr(player, resource) + extracted_quantity,
                )
                db.session.commit()
                emissions = (
                    extracted_quantity
                    * assets[extraction_facility]["pollution"]
                )
                add_emissions(
                    engine,
                    new_values,
                    player,
                    t,
                    extraction_facility,
                    emissions,
                )
            new_values["resources"][resource] = getattr(player, resource)

    construction_emissions(engine, new_values, player, t, assets)

    # O&M costs
    for facility in (
        engine.controllable_facilities
        + engine.renewables
        + engine.storage_facilities
        + engine.extraction_facilities
    ):
        if getattr(player, facility) > 0:
            # the proportion of fixed cost is 100% for renewable and storage facilites, 50% for nuclear reactors and 20% for the rest
            operational_cost = (
                getattr(player, facility) * assets[facility]["O&M cost"]
            )
            if (
                facility
                in engine.controllable_facilities + engine.extraction_facilities
            ):
                fc = 0.2
                if facility in ["nuclear_reactor", "nuclear_reactor_gen4"]:
                    fc = 0.5
                if facility in engine.extraction_facilities:
                    capacity = demand[facility] / (
                        getattr(player, facility)
                        * assets[facility]["power consumption"]
                    )
                else:
                    capacity = generation[facility] / (
                        getattr(player, facility)
                        * assets[facility]["power generation"]
                    )
                operational_cost = (
                    getattr(player, facility)
                    * assets[facility]["O&M cost"]
                    * (fc + (1 - fc) * capacity)
                )
            player.money -= operational_cost
            op_costs[facility] -= operational_cost


def construction_emissions(engine, new_values, player, t, assets):
    """calculate emissions of facilites under construction"""
    emissions_construction = 0.0
    for ud in player.under_construction:
        if ud.start_time is not None:
            if ud.suspension_time is None and ud.family != "Technologies":
                construction = assets[ud.name]
                emissions_construction += (
                    construction["construction pollution"]
                    / construction["construction time"]
                )
    add_emissions(
        engine, new_values, player, t, "construction", emissions_construction
    )


def reduce_demand(
    engine, new_values, past_data, demand_type, player_id, satisfaction
):
    """Mesures taken to reduce demand"""
    if demand_type == "extraction_facilities":
        return
    player = Player.query.get(player_id)
    demand = new_values[player.id]["demand"]
    demand[demand_type] = satisfaction
    if satisfaction > 1.05 * past_data.get_last_data("demand", demand_type):
        return
    if demand_type == "industry":
        if player.industry > 1:
            notify(
                "Energy shortage",
                f"Your industry has been downgraded to level {player.industry-1} because of a lack of electricity.",
                [player],
            )
        player.industry = max(1, player.industry - 1)
        engine.config.update_config_for_user(player.id)
        db.session.commit()
        return
    assets = engine.config[player.id]["assets"]
    if demand_type == "construction":
        construction_priorities = player.read_project_priority(
            "construction_priorities"
        )
        cumul_demand = 0.0
        for i in range(player.construction_workers):
            construction_id = construction_priorities[i]
            construction = Under_construction.query.get(construction_id)
            cumul_demand += assets[construction.name]["construction power"]
            if cumul_demand > satisfaction:
                construction.suspension_time = time.time()
                player.emit(
                    "pause_construction",
                    {
                        "construction_id": construction_id,
                        "suspension_time": time.time(),
                    },
                )
                notify(
                    "Energy shortage",
                    f"The construction of the facility {engine.const_config[construction.name]['name']} has been suspended because of a lack of electricity.",
                    [player],
                )
        db.session.commit()
        return
    if demand_type == "research":
        research_priorities = player.read_project_priority(
            "research_priorities"
        )
        cumul_demand = 0.0
        for i in range(player.lab_workers):
            construction_id = research_priorities[i]
            construction = Under_construction.query.get(construction_id)
            cumul_demand += assets[construction.name]["construction power"]
            if cumul_demand > satisfaction:
                construction.suspension_time = time.time()
                player.emit(
                    "pause_construction",
                    {
                        "construction_id": construction_id,
                        "suspension_time": time.time(),
                    },
                )
                notify(
                    "Energy shortage",
                    f"The research of the technology {engine.const_config[construction.name]['name']} has been suspended because of a lack of electricity.",
                    [player],
                )
        db.session.commit()
        return
    if demand_type == "transport":
        last_shipment = (
            Shipment.query.filter(Shipment.player_id == player.id)
            .order_by(Shipment.start_time.desc())
            .first()
        )
        if last_shipment:
            last_shipment.suspension_time = time.time()
            notify(
                "Energy shortage",
                f"The shipment of {last_shipment.resource} has been suspended because of a lack of electricity.",
                [player],
            )
            db.session.commit()
        return
    if demand_type in [
        "coal_mine",
        "oil_field",
        "gas_drilling_site",
        "uranium_mine",
    ]:
        demand[demand_type] = satisfaction


def add_emissions(engine, new_values, player, t, facility, amount):
    new_values["emissions"][facility] += amount
    player.emissions += amount
    engine.data["current_CO2"][t] += amount
