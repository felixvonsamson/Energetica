"""This module is used to initialize the database with test players and networks."""

import pickle
from pathlib import Path

from werkzeug.security import generate_password_hash

from website import technology_effects

from . import db
from .database.engine_data import CapacityData, CircularBufferNetwork, CircularBufferPlayer, CumulativeEmissionsData
from .database.map import Hex
from .database.messages import Chat
from .database.player import Network, Player
from .database.player_assets import OngoingConstruction
from .utils.misc import add_player_to_data, init_table
from .utils.network import data_init_network


def init_test_players(engine):
    """This function initializes the database with test players and networks."""
    climate_events_scenario(engine)
    # player = create_player(engine, "user", "password")
    # if player:
    #     Hex.query.filter_by(id=35).first().player_id = player.id

    #     player.money = 1_000_000
    #     player.coal = 4_500_000
    #     player.gas = 80_000_000
    #     player.uranium = 4_500
    #     player.rest_of_priorities = ""

    #     add_asset(player, "industry", 21)
    #     add_asset(player, "laboratory", 5)
    #     add_asset(player, "mathematics", 1)
    #     add_asset(player, "mineral_extraction", 5)
    #     add_asset(player, "building_technology", 1)
    #     add_asset(player, "civil_engineering", 1)
    #     add_asset(player, "coal_mine", 10)
    #     add_asset(player, "coal_burner", 25)
    #     # add_asset(player, "uranium_mine", 1)
    #     add_asset(player, "warehouse", 10)
    #     add_asset(player, "small_pumped_hydro", 1)
    #     add_asset(player, "hydrogen_storage", 1)
    #     add_asset(player, "onshore_wind_turbine", 15)
    #     # add_asset(player, "offshore_wind_turbine", 2)
    #     # add_asset(player, "nuclear_reactor_gen4", 1)
    #     # add_asset(player, "nuclear_reactor", 1)
    #     add_asset(player, "combined_cycle", 8)
    #     add_asset(player, "gas_burner", 5)
    #     add_asset(player, "steam_engine", 1)
    #     add_asset(player, "chemistry", 2)
    #     # add_asset(player, "carbon_capture", 4)
    #     add_asset(player, "mechanical_engineering", 3)
    #     add_asset(player, "physics", 2)
    #     add_asset(player, "thermodynamics", 2)
    #     add_asset(player, "nuclear_engineering", 3)
    #     db.session.commit()

    # player2 = create_player(engine, "user2", "password")
    # if player2:
    #     Hex.query.filter_by(id=84).first().player_id = player2.id
    #     player2.rest_of_priorities = ""
    #     add_asset(player2, "industry", 19)
    #     add_asset(player2, "warehouse", 1)
    #     add_asset(player2, "steam_engine", 10)
    #     add_asset(player2, "small_water_dam", 1)
    #     db.session.commit()

    # player3 = create_player(engine, "user3", "password")
    # if player3:
    #     Hex.query.filter_by(id=143).first().player_id = player3.id
    #     player3.rest_of_priorities = ""
    #     add_asset(player3, "industry", 8)
    #     add_asset(player3, "onshore_wind_turbine", 5)
    #     db.session.commit()

    # player4 = create_player(engine, "user4", "password")
    # if player4:
    #     Hex.query.filter_by(id=28).first().player_id = player4.id
    #     player4.rest_of_priorities = ""
    #     add_asset(player4, "warehouse", 1)
    #     add_asset(player4, "watermill", 1)
    #     add_asset(player4, "steam_engine", 1)
    #     add_asset(player4, "small_pumped_hydro", 1)
    #     add_asset(player4, "coal_burner", 1)
    #     add_asset(player4, "coal_mine", 1)
    #     db.session.commit()

    # create_network(engine, "net", [player, player2, player3])
    # db.session.commit()


def add_asset(player, asset, n):
    """This function adds an asset as an instant construction."""
    asset_to_family = {
        "coal_mine": "Extraction facilities",
        "gas_drilling_site": "Extraction facilities",
        "uranium_mine": "Extraction facilities",
        "small_pumped_hydro": "Storage facilities",
        "molten_salt": "Storage facilities",
        "large_pumped_hydro": "Storage facilities",
        "hydrogen_storage": "Storage facilities",
        "lithium_ion_batteries": "Storage facilities",
        "solid_state_batteries": "Storage facilities",
        "steam_engine": "Power facilities",
        "nuclear_reactor": "Power facilities",
        "nuclear_reactor_gen4": "Power facilities",
        "combined_cycle": "Power facilities",
        "gas_burner": "Power facilities",
        "coal_burner": "Power facilities",
        "small_water_dam": "Power facilities",
        "large_water_dam": "Power facilities",
        "watermill": "Power facilities",
        "onshore_wind_turbine": "Power facilities",
        "offshore_wind_turbine": "Power facilities",
        "windmill": "Power facilities",
        "CSP_solar": "Power facilities",
        "PV_solar": "Power facilities",
        "laboratory": "Functional facilities",
        "warehouse": "Functional facilities",
        "industry": "Functional facilities",
        "carbon_capture": "Functional facilities",
        "mathematics": "Technologies",
        "mechanical_engineering": "Technologies",
        "thermodynamics": "Technologies",
        "physics": "Technologies",
        "building_technology": "Technologies",
        "mineral_extraction": "Technologies",
        "transport_technology": "Technologies",
        "materials": "Technologies",
        "civil_engineering": "Technologies",
        "aerodynamics": "Technologies",
        "chemistry": "Technologies",
        "nuclear_engineering": "Technologies",
    }
    priority_list_name = "construction_priorities"
    if asset_to_family[asset] == "Technologies":
        priority_list_name = "research_priorities"

    new_constructions = []
    for i in range(n):
        new_construction: OngoingConstruction = OngoingConstruction(
            name=asset,
            family=asset_to_family[asset],
            start_time=0,
            duration=1,
            suspension_time=None,
            construction_power=0,
            construction_pollution=technology_effects.construction_pollution_per_tick(player, asset),
            price_multiplier=technology_effects.price_multiplier(player, asset),
            multiplier_1=technology_effects.multiplier_1(player, asset),
            multiplier_2=technology_effects.multiplier_2(player, asset),
            multiplier_3=technology_effects.multiplier_3(player, asset),
            player_id=player.id,
        )
        new_constructions.append(new_construction)
    db.session.add_all(new_constructions)
    db.session.flush()
    for new_construction in new_constructions:
        player.add_to_list(priority_list_name, new_construction.id)


def create_player(engine, username, password):
    """This function creates and initializes a player."""
    p = Player.query.filter_by(username=username).first()
    if p is None:
        new_player = Player(
            username=username,
            pwhash=generate_password_hash(password, method="scrypt"),
        )
        db.session.add(new_player)
        general_chat = Chat.query.get(1)
        new_player.chats.append(general_chat)
        db.session.commit()
        engine.data["current_data"][new_player.id] = CircularBufferPlayer()
        engine.data["player_capacities"][new_player.id] = CapacityData()
        engine.data["player_cumul_emissions"][new_player.id] = CumulativeEmissionsData()
        add_player_to_data(engine, new_player)
        init_table(new_player.id)
        db.session.commit()
        return new_player
    engine.log(f"create_player: player {username} already exists")
    return None


def create_network(engine, name, members):
    """This function creates and initializes a network."""
    n = Network.query.filter_by(name=name).first()
    if n is None:
        new_network = Network(name=name, members=members)
        db.session.add(new_network)
        db.session.commit()
        Path(f"instance/network_data/{new_network.id}/charts").mkdir(parents=True, exist_ok=True)
        engine.data["network_data"][new_network.id] = CircularBufferNetwork()
        engine.data["network_capacities"][new_network.id] = CapacityData()
        engine.data["network_capacities"][new_network.id].update_network(new_network)
        past_data = data_init_network()
        Path(f"instance/network_data/{new_network.id}").mkdir(parents=True, exist_ok=True)
        with open(
            f"instance/network_data/{new_network.id}/time_series.pck",
            "wb",
        ) as file:
            pickle.dump(past_data, file)


def climate_events_scenario(engine):
    """This scenario fills the map with players that use coal to see climate change events."""
    for i in range(1, 2):
        print("creating player", i)
        player = create_player(engine, f"user{i}", "password")
        if player:
            Hex.query.filter_by(id=i).first().player_id = player.id

            player.money = 1_000_000_000_000
            player.coal = 100_000_000
            player.gas = 30_000_000
            player.uranium = 4_500
            player.rest_of_priorities = ""

            add_asset(player, "industry", 18)
            add_asset(player, "laboratory", 5)
            add_asset(player, "mineral_extraction", 5)
            add_asset(player, "chemistry", 2)
            add_asset(player, "coal_mine", 10)
            add_asset(player, "coal_burner", 25)
            add_asset(player, "warehouse", 10)
            add_asset(player, "carbon_capture", 7)
    db.session.commit()
