"""The game states update functions are defined here."""
# TODO(mglst): Many functions use player_id as argument, this should be changed to player object

from __future__ import annotations

import math
import pickle
from typing import Literal

import numpy as np
import pandas as pd

from energetica.config.assets import wind_power_curve
from energetica.database.active_facility import ActiveFacility
from energetica.database.network import Network
from energetica.database.ongoing_project import OngoingProject
from energetica.database.player import Player
from energetica.database.shipment import OngoingShipment
from energetica.enums import Fuel, fuels_by_extraction_facility
from energetica.globals import engine
from energetica.utils.misc import calculate_river_discharge, calculate_solar_irradiance, calculate_wind_speed

extraction_to_resource = {
    "coal_mine": "coal",
    "gas_drilling_site": "gas",
    "uranium_mine": "uranium",
}


def update_electricity() -> None:
    """Update the electricity generation and storage status for all players."""
    # calculate new co2 and temperature values
    engine.data["current_climate_data"].init_new_value()
    players: list[Player] = list(Player.all())
    networks = Network.all()

    new_values = {}
    for player in players:
        if player.tile is None:
            continue
        new_values[player.id] = player.rolling_history.init_new_data()

    # reset progress speeds fot all ongoing projects and shipments
    ongoing_projects = OngoingProject.filter_by(status=2)
    for op in ongoing_projects:
        op.reset_speed()
    ongoing_shipments = OngoingShipment.all()
    for os in ongoing_shipments:
        os.reset_speed()

    for network in networks:
        market = init_market()
        for player in network.members:
            calculate_demand(new_values[player.id], player)
            market = calculate_generation_with_market(new_values, market, player)
        market_logic(new_values, market)
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
        network.rolling_history.append_value(new_network_values)
        for player in network.members:
            player.emit(
                "new_network_values",
                {
                    "total_t": engine.data["total_t"],
                    "network_values": new_network_values,
                },
            )
        with open(f"instance/data/networks/{network.id}/charts/market_t{engine.data['total_t']}.pck", "wb") as file:
            pickle.dump(market, file)

    for player in players:
        if player.tile is None:
            continue
        # Power generation calculation for players that are not in a network
        if player.network is None:
            calculate_demand(new_values[player.id], player)
            calculate_generation_without_market(new_values, player)
        set_facilities_usage(new_values[player.id], player)
        calculate_net_import(new_values[player.id])
        update_storage_lvls(new_values[player.id], player)
        resources_and_pollution(new_values[player.id], player)
        player.rolling_history.append_value(new_values[player.id])
        # add industry revenues to player money
        player.money += new_values[player.id]["revenues"]["industry"]
        update_player_progress_values(player, new_values)
        # send new data to clients
        player.send_new_data(new_values[player.id])


def set_facilities_usage(new_values: dict, player: Player) -> None:
    """Set the usage of the facilities to the database."""
    for controllable_facility in engine.controllable_facilities:
        if controllable_facility in player.capacities:
            usage = new_values["generation"][controllable_facility] / player.capacities[controllable_facility]["power"]
            for af in ActiveFacility.filter_by(player=player, name=controllable_facility):
                af.usage = usage

    for storage_facility in engine.storage_facilities:
        if storage_facility in player.capacities:
            if player.capacities[storage_facility]["capacity"] == 0:
                usage = None  # TODO (Felix): update frontend to show "draining..."
            else:
                usage = new_values["storage"][storage_facility] / player.capacities[storage_facility]["capacity"]
            for af in ActiveFacility.filter_by(player=player, name=storage_facility):
                af.usage = usage

    for extraction_facility in engine.extraction_facilities:
        if extraction_facility in player.capacities:
            usage = new_values["demand"][extraction_facility] / player.capacities[extraction_facility]["power_use"]
            for af in ActiveFacility.filter_by(player=player, name=extraction_facility):
                af.usage = usage


def update_player_progress_values(player: Player, new_values: dict) -> None:
    """Update the player progress values and checks for new unlocks and achievements."""
    # calculate moving average revenue
    player.progression_metrics["average_revenues"] = (
        player.progression_metrics["average_revenues"]
        + 3600
        / engine.in_game_seconds_per_tick
        * 0.03
        * sum(
            [new_values[player.id]["revenues"][rev] for rev in new_values[player.id]["revenues"]]
            + [new_values[player.id]["op_costs"][rev] for rev in new_values[player.id]["op_costs"]],
        )
    ) / 1.03
    # update max power consumption
    total_demand = sum([new_values[player.id]["demand"][demand] for demand in new_values[player.id]["demand"]])
    if total_demand > player.progression_metrics["max_power_consumption"]:
        player.progression_metrics["max_power_consumption"] = total_demand
    # update max stored energy
    total_storage = sum([new_values[player.id]["storage"][storage] for storage in new_values[player.id]["storage"]])
    if total_storage > player.progression_metrics["max_energy_stored"]:
        player.progression_metrics["max_energy_stored"] = total_storage
    # update imported and exported energy and converting Wt to Wh
    player.progression_metrics["imported_energy"] += (
        new_values[player.id]["generation"]["imports"] / 3600 * engine.in_game_seconds_per_tick
    )
    player.progression_metrics["exported_energy"] += (
        new_values[player.id]["demand"]["exports"] / 3600 * engine.in_game_seconds_per_tick
    )

    player.check_continuous_achievements()


def init_market() -> dict:
    """Initialize an empty market."""
    return {
        "capacities": pd.DataFrame({"player_id": [], "capacity": [], "price": [], "facility": []}),
        "demands": pd.DataFrame({"player_id": [], "capacity": [], "price": [], "facility": []}),
    }


def update_storage_lvls(new_values: dict, player: Player) -> None:
    """Update storage levels according to the use of storage facilities."""
    generation = new_values["generation"]
    demand = new_values["demand"]
    storage = new_values["storage"]
    for facility in engine.storage_facilities:
        if player.capacities.get(facility) is not None:
            # the energy is converted from Wt to Wh
            storage[facility] = (
                storage[facility]
                - generation[facility]
                / 3600
                * engine.in_game_seconds_per_tick
                / (player.capacities[facility]["efficiency"] ** 0.5)
                + demand[facility]
                / 3600
                * engine.in_game_seconds_per_tick
                * (player.capacities[facility]["efficiency"] ** 0.5)
            )


def calculate_net_import(new_values) -> None:
    """
    Calculate the net import of a player.

    For players in network, subtract the difference between import and exports to ignore energy that has been bought
    from themselves.
    """
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


def extraction_facility_demand(new_values, player: Player, demand) -> None:
    """Calculate power consumption of extraction facilities."""
    assert player.tile is not None
    player_resources = new_values["resources"]
    warehouse_caps = player.config["warehouse_capacities"]
    for fuel in Fuel:
        extraction_facility = fuel.associated_mine()
        if player.capacities.get(extraction_facility) is not None:
            max_warehouse = warehouse_caps[fuel] - player_resources[fuel]
            max_prod = (
                player.capacities[extraction_facility]["extraction_rate_per_day"]
                * player.tile.fuel_reserves[fuel]
                * engine.in_game_seconds_per_tick
                / 86400  # 86400 seconds in a day
            )
            power_factor = min(1.0, max_warehouse / max(1.0, max_prod))
            demand[extraction_facility] = player.capacities[extraction_facility]["power_use"] * power_factor


def industry_demand_and_revenues(player: Player, demand, revenues) -> None:
    """Calculate power consumption and revenues from industry."""
    # interpolating seasonal factor on the day
    ticks_per_day = 3600 * 24 / engine.in_game_seconds_per_tick
    real_t = engine.data["total_t"] + engine.data["delta_t"]  # this ensures that the year starts at real time midnight
    day = round(real_t // ticks_per_day)
    sf1 = engine.industry_seasonal[day % 72]
    sf2 = engine.industry_seasonal[(day + 1) % 72]
    seasonal_factor = (sf1 * (ticks_per_day - real_t % ticks_per_day) + sf2 * (real_t % ticks_per_day)) / ticks_per_day
    intra_day_t = real_t % ticks_per_day
    intra_day_factor = engine.industry_demand[round(intra_day_t * 1440 / ticks_per_day)]
    demand["industry"] = intra_day_factor * seasonal_factor * player.config["industry"]["power_consumption"]
    # calculate income of industry per tick
    revenues["industry"] = player.config["industry"]["income_per_day"] / ticks_per_day
    industry_upgrade = next(OngoingProject.filter_by(player=player, name="industry"), None)
    if industry_upgrade:
        additional_demand = (
            industry_upgrade.progress()
            * demand["industry"]
            * (engine.const_config["assets"]["industry"]["power_factor"] - 1)
        )
        additional_revenue = (
            industry_upgrade.progress()
            * (
                revenues["industry"]
                - engine.const_config["assets"]["industry"]["universal_income_per_day"] / ticks_per_day
            )
            * (engine.const_config["assets"]["industry"]["income_factor"] - 1)
        )
        demand["industry"] += additional_demand
        revenues["industry"] += additional_revenue


def projects_demand(player: Player, demand) -> None:
    """Calculate power consumption for ongoing projects."""
    for research in player.researches_by_priority:
        if research.is_ongoing():
            demand["research"] += research.project_power
    for construction in player.constructions_by_priority:
        if construction.is_ongoing():
            demand["construction"] += construction.project_power


def shipment_demand(player: Player, demand) -> None:
    """Calculate the power consumption for shipments."""
    transport = player.config["transport"]
    for shipment in player.shipments:
        demand["transport"] += transport["power_per_kg"] * shipment.quantity


def storage_demand(player: Player, demand) -> None:
    """Calculate the maximal demand of storage plants."""
    for facility in engine.storage_facilities:
        if player.capacities.get(facility) is not None:
            demand[facility] = calculate_prod(
                "max",
                player,
                facility,
                resource_reservations=None,
                filling=True,
            )


def climate_event_recovery_cost(player: Player, revenues) -> None:
    """Calculate the cost of climate events."""
    for cer in player.climate_events:
        revenues["climate_events"] -= cer.recovery_cost


def calculate_demand(new_values, player: Player) -> None:
    """Calculate the electricity demand of one player."""
    demand = new_values["demand"]
    revenues = new_values["revenues"]

    extraction_facility_demand(new_values, player, demand)
    industry_demand_and_revenues(player, demand, revenues)
    projects_demand(player, demand)
    shipment_demand(player, demand)
    storage_demand(player, demand)

    # consider cost of climate events if any
    climate_event_recovery_cost(player, revenues)

    if player.functional_facility_lvl["carbon_capture"] > 0:
        demand["carbon_capture"] = player.config["carbon_capture"]["power_consumption"]


def reset_resource_reservations() -> dict:
    """Reset resource reservations to 0."""
    return {
        "coal": 0,
        "gas": 0,
        "uranium": 0,
    }


def calculate_generation_without_market(new_values, player: Player) -> None:
    """Calculate the generation of a player that is not part of a network."""
    internal_market = init_market()
    generation = new_values[player.id]["generation"]
    demand = new_values[player.id]["demand"]
    resource_reservations = reset_resource_reservations()

    # generation of non controllable facilities is calculated from weather data
    renewables_generation(player, generation)
    minimal_generation(player, generation, resource_reservations)
    facilities = engine.storage_facilities + engine.power_facilities
    # Obligatory generation is put on the internal market at a price of -5
    for facility in facilities:
        if player.capacities.get(facility) is not None:
            internal_market = place_bid(
                internal_market,
                player.id,
                generation[facility],
                -5,
                facility,
            )

    # demands are demanded on the internal market
    for ask_type in player.network_prices.ask_prices.keys():
        if ask_type in demand:
            price = player.network_prices.ask_prices[ask_type]
            internal_market = place_ask(
                internal_market,
                player.id,
                demand[ask_type],
                price,
                ask_type,
            )

    resource_reservations = reset_resource_reservations()
    # offer additional capacities of facilities on the internal market
    for facility in engine.storage_facilities + engine.controllable_facilities:
        if player.capacities.get(facility) is not None:
            max_prod = calculate_prod(
                "max",
                player,
                facility,
                resource_reservations,
            )
            price = player.network_prices.bid_prices[facility]
            capacity = max_prod - generation[facility]
            internal_market = place_bid(internal_market, player.id, capacity, price, facility)

    market_logic(new_values, internal_market)


def calculate_generation_with_market(new_values, market, player: Player):
    """Calculate the generation of a player that is part of a network (before market logic)."""
    generation = new_values[player.id]["generation"]
    demand = new_values[player.id]["demand"]
    resource_reservations = reset_resource_reservations()

    renewables_generation(player, generation)
    minimal_generation(player, generation, resource_reservations)
    facilities = engine.storage_facilities + engine.power_facilities
    for facility in facilities:
        if player.capacities.get(facility) is not None:
            market = place_bid(market, player.id, generation[facility], -5, facility)

    # allow a maximum overdraft of the equivalent of the daily income of the industry
    max_overdraft = -player.config["industry"]["income_per_day"]
    if player.money < max_overdraft:
        player.notify(
            "Not Enough Money",
            "You exceeded your credit limit, you can't buy electricity on the market anymore.",
        )
    # ask demand on the market at the set prices
    for demand_type in player.network_prices.ask_prices.keys():
        if player.money >= max_overdraft:
            bid_q = demand[demand_type]
            price = player.network_prices.ask_prices[demand_type]
            market = place_ask(market, player.id, bid_q, price, demand_type)
        else:
            reduce_demand(new_values, demand_type, player.id, 0.0)

    resource_reservations = reset_resource_reservations()
    # Sell capacities of remaining facilities on the market
    for facility in (*player.network_prices.bid_prices.keys(), *player.network_prices.renewable_bids):
        if engine.const_config["assets"][facility]["ramping_time"] != 0:
            if player.capacities.get(facility) is not None:
                max_prod = calculate_prod(
                    "max",
                    player,
                    facility,
                    resource_reservations,
                )
                price = player.network_prices.bid_prices[facility]
                capacity = max_prod - generation[facility]
                market = place_bid(market, player.id, capacity, price, facility)

    return market


def market_logic(new_values, market) -> None:
    """
    Perform the market logic for a network.

    Calculate overall network demand,
    class all capacity offers in ascending order of price
    and find the market price of electricity.
    Sell all capacities that are below market price at market price.
    """

    def add_to_market_data(player_id, quantity, facility, export=True) -> None:
        """Add the exported or imported quantity to the market data so that it can be shown in the charts."""
        import_export = "player_imports"
        generation_consumption = "consumption"
        if export:
            import_export = "player_exports"
            generation_consumption = "generation"
        if player_id in market[import_export]:
            market[import_export][player_id] += quantity
        else:
            market[import_export][player_id] = quantity
        if facility in market[generation_consumption]:
            market[generation_consumption][facility] += quantity
        else:
            market[generation_consumption][facility] = quantity

    def sell(row, market_price, quantity=None) -> None:
        """Sell and produce offered power capacity."""
        player = Player.get(row.player_id)
        assert player is not None
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
        add_to_market_data(player.id, quantity, row.facility, export=True)

    def buy(row, market_price, quantity=None) -> None:
        """Buy demanded power capacity."""
        player = Player.get(row.player_id)
        assert player is not None
        generation = new_values[player.id]["generation"]
        revenue = new_values[player.id]["revenues"]
        if quantity is None:
            quantity = row.capacity
        generation["imports"] += quantity
        player.money -= quantity * market_price / 3600 * engine.in_game_seconds_per_tick / 1_000_000
        revenue["imports"] -= quantity * market_price / 3600 * engine.in_game_seconds_per_tick / 1_000_000
        add_to_market_data(player.id, quantity, row.facility, export=False)

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
                player = Player.get(row.player_id)
                assert player is not None
                demand = new_values[row.player_id]["demand"]
                demand["dumping"] += dump_cap
                player.money -= dump_cap * 5 / 3600 * engine.in_game_seconds_per_tick / 1_000_000
                revenue = new_values[row.player_id]["revenues"]
                revenue["dumping"] -= dump_cap * 5 / 3600 * engine.in_game_seconds_per_tick / 1_000_000
                add_to_market_data(player.id, dump_cap, "dumping", export=False)
                add_to_market_data(player.id, dump_cap, row.facility, export=True)
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
                new_values,
                row.facility,
                row.player_id,
                max(0.0, bought_cap),
            )
        else:
            buy(row, market_price)
    market["market_price"] = market_price
    market["market_quantity"] = market_quantity


def market_optimum(offers_og, demands_og):
    """Find market price and quantity by finding the intersection of demand and supply."""
    offers = offers_og.copy()
    demands = demands_og.copy()

    if len(demands) == 0 or len(offers) == 0:
        return 0, 0

    price_d = demands.loc[0, "price"]
    price_o = offers.loc[0, "price"]

    if price_o > price_d:
        return price_d, 0

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
            price = price_d
            if np.isnan(row.index_offer):
                price = price_o
            return price, row.cumul_capacities


def renewables_generation(player: Player, generation: dict) -> None:
    """Calculate the generation of renewable facilities."""
    in_game_seconds_passed: int = (engine.data["total_t"] + engine.data["delta_t"]) * engine.in_game_seconds_per_tick
    # WIND
    wind_generation(player, generation, in_game_seconds_passed)
    # SOLAR
    solar_generation(player, generation, in_game_seconds_passed)
    # HYDRO
    power_factor = calculate_river_discharge(in_game_seconds_passed) / 150
    for hydro_facility in ["watermill", "small_water_dam", "large_water_dam"]:
        if player.capacities.get(hydro_facility) is not None:
            generation[hydro_facility] = power_factor * player.capacities[hydro_facility]["power"]
        for af in ActiveFacility.filter_by(player=player, name=hydro_facility):
            af.usage = power_factor


def solar_generation(player: Player, generation, in_game_seconds_passed) -> None:
    """
    Calculate the power generated by solar facilities.

    Each instance of facility generates a different amount of power depending on the position of the facility.
    The clear sky index is calculated using a 3D perlin noise that moves over time, simulating the movement of clouds.
    The csi is then multiplied by the clear sky value to get the actual irradiance at the location.
    The effective power of the solar facility is then calculated as irradiance / 950 * max_power.
    """
    for facility_type in ["CSP_solar", "PV_solar"]:
        if player.capacities.get(facility_type) is not None:
            for facility in ActiveFacility.filter_by(player=player, name=facility_type):
                irradiance = calculate_solar_irradiance(
                    facility.position,
                    in_game_seconds_passed,
                    engine.data["random_seed"],
                )
                max_power = (
                    engine.const_config["assets"][facility_type]["base_power_generation"]
                    * facility.multipliers["multiplier_1"]
                )
                facility.usage = irradiance / 950.0
                generation[facility_type] += facility.usage * max_power


def wind_generation(player: Player, generation: dict, in_game_seconds_passed: int) -> None:
    """
    Calculate the power generated by wind facilities.

    Each instance of facility generates a different amount of power depending on the position of the facility.
    The wind speed is calculated using a 3D perlin noise with a superposition of specific frequencies.
    Two sinusoidal functions are multiplied with the wind speed to simulate the day-night cycle and the seasonal cycle.
    A multiplier is applied to the wind speed depending on the 'performance' of the facility linked to its position.
    The characteristic power curve of wind facilities is interpolated to get the power generated by the facility.
    """

    def interpolate_wind(wind_speed: float) -> float:
        """Interpolate the wind power curve to get the exact power generated by a wind facility."""
        if wind_speed > 90:
            return 0
        i = math.floor(wind_speed)
        f = wind_speed - i
        pc = wind_power_curve
        return pc[i] + (pc[(i + 1) % 90] - pc[i]) * f

    for facility_type in ["windmill", "onshore_wind_turbine", "offshore_wind_turbine"]:
        if player.capacities.get(facility_type) is not None:
            for facility in ActiveFacility.filter_by(player=player, name=facility_type):
                wind_speed = calculate_wind_speed(facility.position, in_game_seconds_passed, engine.data["random_seed"])
                max_power = (
                    engine.const_config["assets"][facility_type]["base_power_generation"]
                    * facility.multipliers["multiplier_1"]
                )
                # multiplier_2 is the wind speed factor linked to the position of the facility:
                effective_wind_speed = wind_speed * facility.multipliers["multiplier_2"]
                facility.usage = interpolate_wind(effective_wind_speed)
                generation[facility_type] += facility.usage * max_power
                # The following value is the index of the last value in the wind_power_curve list in config.assets that
                # is 1 before the cut out taper.
                max_speed_before_cut_out = 85
                facility.cut_out_speed_exceeded = bool(effective_wind_speed >= max_speed_before_cut_out)


def calculate_prod(
    minmax: Literal["min", "max"],
    player: Player,
    facility: str,
    resource_reservations: dict[str, float] | None,
    filling=False,
) -> float:
    """
    Calculate the min or max power production of controllable facilities for this tick.

    This takes into consideration :
    - ramping constraints
    - resources constraints
    - max power constraints
    - storage filling constraints
    """
    # TODO(mglst): remove 'engine' argument

    def reserve_resources(power):
        """Reserve resources for the production of power so that they are not used somewhere else."""
        if "fuel_use" in player.capacities[facility]:
            for resource, amount in player.capacities[facility]["fuel_use"].items():
                resource_reservations[resource] += amount * power / player.capacities[facility]["power"]

    max_resources = np.inf
    ramping_speed = (
        player.capacities[facility]["power"]
        / engine.const_config["assets"][facility]["ramping_time"]
        * engine.in_game_seconds_per_tick
    )
    if "fuel_use" in player.capacities[facility]:
        assert resource_reservations is not None
        for fuel, amount in player.capacities[facility]["fuel_use"].items():
            fuel = Fuel(fuel)
            available_resource = player.resources[fuel] - player.resources_on_sale[fuel] - resource_reservations[fuel]
            p_max_resources = available_resource / amount * player.capacities[facility]["power"]
            max_resources = min(p_max_resources, max_resources)
    else:
        if filling:
            energy_capacity = (
                max(
                    0.0,
                    player.capacities[facility]["capacity"] - player.rolling_history.get_last_data("storage", facility),
                )
                * 3600
                / engine.in_game_seconds_per_tick
                * (player.capacities[facility]["efficiency"] ** 0.5)
            )  # max remaining storage space
        else:
            energy_capacity = max(
                0.0,
                player.rolling_history.get_last_data("storage", facility)
                * 3600
                / engine.in_game_seconds_per_tick
                * (player.capacities[facility]["efficiency"] ** 0.5),
            )  # max available storage content
        max_resources = max(
            0.0,
            min(energy_capacity, (2 * energy_capacity * ramping_speed) ** 0.5 - 0.5 * ramping_speed),
        )  # ramping down
    if minmax == "max":
        if filling:
            max_ramping = player.rolling_history.get_last_data("demand", facility) + ramping_speed
        else:
            max_ramping = player.rolling_history.get_last_data("generation", facility) + ramping_speed
        max_generation = min(max_resources, max_ramping, player.capacities[facility]["power"])
        reserve_resources(max_generation)
        return max_generation
    else:
        min_ramping = player.rolling_history.get_last_data("generation", facility) - ramping_speed
        min_generation = max(0.0, min(max_resources, min_ramping, player.capacities[facility]["power"]))
        reserve_resources(min_generation)
        return min_generation


def minimal_generation(player: Player, generation, resource_reservations) -> None:
    """Calculate the minimal generation of controllable facilities."""
    for facility in engine.controllable_facilities + engine.storage_facilities:
        if player.capacities.get(facility) is not None:
            generation[facility] = calculate_prod(
                "min",
                player,
                facility,
                resource_reservations,
            )


def place_bid(market, player_id, capacity, price, facility):
    """Make an bid (offer, supply) on the market."""
    if capacity > 0:
        new_row = pd.DataFrame(
            {
                "player_id": [player_id],
                "capacity": [capacity],
                "price": [price],
                "facility": [facility],
            },
        )
        market["capacities"] = pd.concat([market["capacities"], new_row], ignore_index=True)
    return market


def place_ask(market, player_id, demand, price, facility):
    """Make an ask (demand) on the market."""
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


def resources_and_pollution(new_values, player: Player) -> None:
    """Calculate resource use and production, O&M costs and emissions."""
    assert player is not None
    assert player.tile is not None
    generation = new_values["generation"]
    op_costs = new_values["op_costs"]
    demand = new_values["demand"]
    # Calculate resource consumption and pollution of generation facilities
    for facility in engine.controllable_facilities:
        if player.capacities.get(facility) is not None:
            for fuel, amount in player.capacities[facility]["fuel_use"].items():
                fuel = Fuel(fuel)
                quantity = amount * generation[facility] / player.capacities[facility]["power"]
                player.resources[fuel] -= quantity
            facility_emissions = (
                engine.const_config["assets"][facility]["base_pollution"]
                * generation[facility]
                / 3600
                * engine.in_game_seconds_per_tick
                / 1_000_000
            )
            add_emissions(new_values, player, facility, facility_emissions)

    if player.functional_facility_lvl["warehouse"] > 0:
        for extraction_facility in engine.extraction_facilities:
            fuel = fuels_by_extraction_facility[extraction_facility]
            if player.capacities.get(extraction_facility) is not None:
                max_demand = player.capacities[extraction_facility]["power_use"]
                production_factor = demand[extraction_facility] / max_demand
                extracted_quantity = (
                    production_factor
                    * player.capacities[extraction_facility]["extraction_rate_per_day"]
                    * player.tile.fuel_reserves[fuel]
                    * engine.in_game_seconds_per_tick
                    / 86400  # 86400 seconds in a day
                )
                player.tile.fuel_reserves[fuel] -= extracted_quantity
                player.resources[fuel] += extracted_quantity
                player.progression_metrics["extracted_resources"] += extracted_quantity
                emissions = extracted_quantity * player.capacities[extraction_facility]["pollution"]
                add_emissions(
                    new_values,
                    player,
                    extraction_facility,
                    emissions,
                )
            new_values["resources"][fuel] = player.resources[fuel]

    # Carbon capture CO2 absorption
    if player.functional_facility_lvl["carbon_capture"] > 0:
        satisfaction = demand["carbon_capture"] / player.config["carbon_capture"]["power_consumption"]
        captured_co2 = (
            player.config["carbon_capture"]["absorption"]
            * engine.data["current_climate_data"].get_co2()
            * engine.in_game_seconds_per_tick
            / 86400
            * satisfaction
        )
        player.progression_metrics["captured_co2"] += captured_co2
        add_emissions(new_values, player, "carbon_capture", -captured_co2)

    construction_emissions(new_values, player)

    # O&M costs
    for facility in engine.power_facilities + engine.storage_facilities + engine.extraction_facilities:
        if player.capacities.get(facility) is not None:
            # the proportion of fixed cost is 100% for renewable and storage facilities,
            # 50% for nuclear reactors and 20% for the rest
            operational_cost = player.capacities[facility]["O&M_cost"]
            if facility in engine.controllable_facilities + engine.extraction_facilities:
                fc = 0.2
                if facility in ["nuclear_reactor", "nuclear_reactor_gen4"]:
                    fc = 0.5
                if facility in engine.extraction_facilities:
                    capacity = demand[facility] / player.capacities[facility]["power_use"]
                else:
                    capacity = generation[facility] / player.capacities[facility]["power"]
                operational_cost = operational_cost * (fc + (1 - fc) * capacity)
            player.money -= operational_cost
            op_costs[facility] -= operational_cost


def construction_emissions(new_values, player: Player) -> None:
    """Calculate emissions of ongoing projects."""
    # TODO (0.12): Max suggestion : Change the satisfaction logic to redirect to 3 cases :
    # 1. Total satisfaction
    # 2. Partial satisfaction
    # 3. No satisfaction
    # Call project_emissions respectively
    # (for now this is wrong)
    emissions_of_constructions = 0.0
    for ud in OngoingProject.filter_by(player=player):
        if ud.is_ongoing() and ud.family != "Technologies":
            emissions_of_constructions += ud.project_pollution
    add_emissions(new_values, player, "construction", emissions_of_constructions)


def reduce_demand(new_values, demand_type, player_id, satisfaction) -> None:
    """
    Take measures to reduce power demand.

    Arguments:
    @param demand_type: type of the power demand (eg. industry, construction, research, transport)
    @param satisfaction: the amount of power that can be provided (in W)

    """
    # TODO(mglst): Add argument description for new_values
    player = Player.get(player_id)
    assert player is not None
    demand = new_values[player.id]["demand"]
    if demand_type == "industry":
        # revenues of industry are reduced
        new_values[player.id]["revenues"]["industry"] *= satisfaction / demand["industry"]
        demand["industry"] = satisfaction
        return
    demand[demand_type] = satisfaction
    if demand_type in engine.extraction_facilities + engine.storage_facilities + ["carbon_capture"]:
        return
    if satisfaction > (1 + 0.0008 * engine.in_game_seconds_per_tick) * player.rolling_history.get_last_data(
        "demand",
        demand_type,
    ):
        return
    if demand_type == "construction":
        cumul_demand = 0.0
        for i in range(min(len(player.constructions_by_priority), player.workers[demand_type])):
            construction = player.constructions_by_priority[i]
            if not construction.is_ongoing():
                continue
            cumul_demand += construction.project_power
            if cumul_demand > satisfaction:
                progress_speed_factor = max(0, 1 + (satisfaction - cumul_demand) / construction.project_power)
                construction.delay_by(1 - progress_speed_factor)
        return

    if demand_type == "research":
        researches_by_priority = player.researches_by_priority
        cumul_demand = 0.0
        for i in range(min(len(researches_by_priority), player.workers["laboratory"])):
            construction = researches_by_priority[i]
            if not construction.is_ongoing():
                continue
            cumul_demand += construction.project_power
            if cumul_demand > satisfaction:
                progress_speed_factor = max(0, 1 + (satisfaction - cumul_demand) / construction.project_power)
                construction.delay_by(1 - progress_speed_factor)
        return

    if demand_type == "transport":
        # TODO (Felix): This should be updated and use a similar logic as above.
        # Note(mglst): The below uses filter to get an iterable, which the sorted function then converts to a list,
        # which is then converted back to an iterable by iter, which next then gets the first element of, or None.
        last_shipment = next(
            iter(
                sorted(
                    OngoingShipment.filter_by(player=player),
                    key=lambda shipment: shipment.arrival_tick,
                    reverse=True,
                ),
            ),
            None,
        )
        if last_shipment:
            # TODO(mglst): OngoingShipment has no member called power!
            last_shipment.delay_by(1 - satisfaction / last_shipment.power)
        return


def add_emissions(new_values, player: Player, type, amount) -> None:
    """Add emissions to the data."""
    new_values["emissions"][type] += amount
    player.cumul_emissions.add(type, amount)
    engine.data["current_climate_data"].add("CO2", amount)
