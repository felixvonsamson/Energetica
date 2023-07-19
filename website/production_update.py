"""
The game states update functions are defined here
"""

import datetime
from .database import Player

# fuction that updates the ressources of all players according to extraction capacity (and trade)
def update_ressources(engine):
    t = datetime.datetime.today().time().hour
    players = Player.query.all()
    for player in players:
        assets = engine.config[player.id]["assets"]
        player.todays_production["ressources"]["coal"][t] = (
            player.coal_mine * assets["coal_mine"]["amount produced"]
        )
        player.todays_production["ressources"]["oil"][t] = (
            player.oil_field * assets["oil_field"]["amount produced"]
        )
        player.todays_production["ressources"]["gas"][t] = (
            player.gas_drilling_site * assets["gas_drilling_site"]["amount produced"]
        )
        player.todays_production["ressources"]["uranium"][t] = (
            player.uranium_mine * assets["uranium_mine"]["amount produced"]
        )

# function that updates the electricity production and storage status for all players according to capacity and external factors (and trade)
def update_electricity(engine):
    now = datetime.datetime.today().time()
    t = now.hour * 60 + now.minute
    players = Player.query.all()
    for player in players:
        assets = engine.config[player.id]["assets"]
        production = player.todays_production["production"]
        # calculate energy demand of assets under construction
        demand_construction = 0
        for ud in player.under_construction:
            construction = assets[ud.name]
            demand_construction += (
                construction["construction energy"] / construction["construction time"] * 60
            )
        player.todays_production["demand"]["construction"][t] = demand_construction
        total_demand = sum([player.todays_production["demand"][i][t]
                for i in player.todays_production["demand"]])

        # GENERATE NON CONTROLLABLE VARIABLES AS DAYLY UPDATES, SIMILARLY AS FOR INDUSTRY DEMAND
        # PUT ONLY UPDATE HERE
        total_production = 0
        for plant in [
            "windmill",
            "watermill",
            "small_water_dam",
            "wind_turbine",
            "large_water_dam",
            "CSP_solar",
            "PV_solar",
            "large_wind_turbine",
        ]:
            # GENERATE NON-CONTROLLABLE GENERATION DATA
            pass

        # list of controllable power plants :
        controllable_plants = [
            "steam_engine",
            "coal_burner",
            "oil_burner",
            "gas_burner",
            "shallow_geothermal_plant",
            "combined_cycle",
            "deep_geothermal_plant",
            "nuclear_reactor",
            "nuclear_reactor_gen4",
        ]
        # update production level of controllable power plants :
        # first : set production to lowest possible value for the next step (max downward power ramp)
        for plant in controllable_plants:
            player.todays_production["production"][plant][t] = max(
                0,
                production[plant][t - 1]
                - getattr(player, plant)
                * assets[plant]["ramping speed"],
            )
            total_production += production[plant][t]
        # temporary priority list of power plants :
        priority_list = [
            "steam_engine",
            "coal_burner",
            "oil_burner",
            "gas_burner",
            "shallow_geothermal_plant",
            "combined_cycle",
            "deep_geothermal_plant",
            "nuclear_reactor",
            "nuclear_reactor_gen4",
        ]
        i = 0
        # CHECK THIS LOGIC AGAIN WHEN YOU HAVE FRESH BRAIN CELLS 
        # while the produced power is not sufficient, for each power plant following the priority list,
        # set the power to the maximum possible value (max upward power ramp). 
        # For the PP that overshoots the demand, find the equilibirum power production value.
        while total_production < total_demand:
            plant = priority_list[i]
            delta_prod = (
                getattr(player, plant)
                * assets[plant]["ramping speed"]
                + production[plant][t - 1]
                - production[plant][t]
            )
            # case where the plant is the one that could overshoot the equilibium :
            if total_demand - total_production < delta_prod:
                max_prod = (
                    getattr(player, plant) * assets[plant]["power production"]
                )
                # case where the plant is, or will be at max power production :
                if (production[plant][t] + total_demand - total_production
                    > max_prod):
                    total_production += max_prod - production[plant][t]
                    production[plant][t] = max_prod
                else:
                    production[plant][t] += total_demand - total_production
                    total_production = total_demand
            else:
                total_production += delta_prod
                production[plant][t] += delta_prod
            i += 1
            # case where even with max power ramp on all PP the demand is not reached :
            if i >= len(priority_list):
                break
