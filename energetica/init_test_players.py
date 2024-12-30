"""This module is used to initialize the database with test players and networks."""

from werkzeug.security import generate_password_hash

from energetica.database.map import HexTile
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.game_engine import GameError
from energetica.globals import engine
from energetica.utils.assets import finish_project, queue_project
from energetica.utils.misc import confirm_location
from energetica.utils.network_helpers import create_network, join_network


def init_test_players():
    """This function initializes the database with test players and networks."""

    def add_asset(player: Player, asset: str, n):
        """This function adds an asset as an instant construction."""
        for _ in range(n):
            ongoing_construction = queue_project(
                player, asset, force=True, ignore_requirements_and_money=True, skip_notifications=True
            )
            finish_project(ongoing_construction, skip_notifications=True)
        engine.log(f"Added {n} {asset} for {player.username}")

    def create_player(username, password, tile_id=None) -> Player:
        """This function creates and initializes a player."""
        player = next(Player.filter_by(username=username), None)
        if player:
            engine.log(f"create_player: player {username} already exists")
            return player
        player = Player(username=username, pwhash=generate_password_hash(password))
        # If tile_id is None, find any tile that isn't assigned to a player
        hex_tile = HexTile.get(tile_id) if tile_id else next(HexTile.filter_by(player_id=None))
        if not hex_tile:
            raise GameError("TileNotFound")  # TODO(mglst): centralize error handling, create static list of errors
        confirm_location(player, hex_tile)
        engine.log(f"create_player: player {username} created")
        return player

    def setup_network(name, members: list[Player]) -> Network:
        """This function creates and initializes a network."""
        # Unlock the network achievement for all members
        for player in members:
            if "Unlock Network" not in player.achievements:
                player.achievements.append("Unlock Network")

        network = next(Network.filter_by(name=name), None)
        if network:
            engine.log(f"create_network: network {name} already exists")
        else:
            if members == []:
                engine.log(f"create_network: network {name} has no members")
                # raise an exception
                raise ValueError("create_network: network has no members")
            network = create_network(members[0], name)
            for player in members[1:]:
                join_network(player, network)
        return network

    def climate_events_scenario():
        """This scenario fills the map with players that use coal to see climate change events."""
        players = []
        for i in range(1, 5):
            print("creating player", i)
            player = create_player(f"user{i}", "password")
            if player:
                HexTile.get(i).player_id = player.id

                player.money = 1_000_000_000
                player.resources = {"coal": 300_000, "gas": 100_000, "uranium": 500}
                player.priorities_of_controllables = ""

                add_asset(player, "industry", 18)
                add_asset(player, "warehouse", 1)
                add_asset(player, "small_water_dam", 2)
                add_asset(player, "onshore_wind_turbine", 3)
                add_asset(player, "laboratory", 5)
                add_asset(player, "mathematics", 1)
                add_asset(player, "mineral_extraction", 5)
                add_asset(player, "building_technology", 1)
                add_asset(player, "civil_engineering", 1)
                add_asset(player, "coal_mine", 3)
                add_asset(player, "coal_burner", 3)
                add_asset(player, "small_pumped_hydro", 1)
                add_asset(player, "hydrogen_storage", 1)
                add_asset(player, "offshore_wind_turbine", 1)
                add_asset(player, "nuclear_reactor_gen4", 1)
                add_asset(player, "combined_cycle", 1)
                add_asset(player, "gas_burner", 1)
                add_asset(player, "steam_engine", 1)
                add_asset(player, "chemistry", 2)
                add_asset(player, "carbon_capture", 4)
                add_asset(player, "mechanical_engineering", 3)
                add_asset(player, "physics", 2)
                add_asset(player, "thermodynamics", 2)
                add_asset(player, "nuclear_engineering", 3)
                add_asset(player, "aerodynamics", 5)
            players.append(player)
        setup_network("net", players)

    # climate_events_scenario()

    player1 = create_player("user1", "password")
    player2 = create_player("user2", "password")
    player3 = create_player("user3", "password")

    setup_network("net1", [player1, player2])
    setup_network("net2", [player3])

    # Player 1
    player1.money = 1_000_000_000
    player1.resources["coal"] = 300_000

    add_asset(player1, "molten_salt", 1)
    add_asset(player1, "hydrogen_storage", 1)
    add_asset(player1, "solid_state_batteries", 1)

    add_asset(player1, "physics", 6)
    add_asset(player1, "aerodynamics", 1)
    add_asset(player1, "materials", 4)
    add_asset(player1, "thermodynamics", 5)
    add_asset(player1, "chemistry", 3)
    add_asset(player1, "civil_engineering", 1)

    add_asset(player1, "molten_salt", 1)
    add_asset(player1, "coal_mine", 2)
    add_asset(player1, "uranium_mine", 1)
    add_asset(player1, "warehouse", 1)
    add_asset(player1, "industry", 12)
    add_asset(player1, "laboratory", 4)
    add_asset(player1, "gas_burner", 1)
    add_asset(player1, "mechanical_engineering", 1)
    add_asset(player1, "coal_burner", 1)
    add_asset(player1, "mechanical_engineering", 1)
    add_asset(player1, "gas_burner", 1)
    add_asset(player1, "small_pumped_hydro", 1)
    add_asset(player1, "mechanical_engineering", 1)
    add_asset(player1, "small_pumped_hydro", 1)
    add_asset(player1, "coal_burner", 1)
    add_asset(player1, "PV_solar", 2)
    add_asset(player1, "onshore_wind_turbine", 2)
    add_asset(player1, "CSP_solar", 1)

    # One level of each technology
    add_asset(player1, "mathematics", 1)
    add_asset(player1, "mechanical_engineering", 1)
    add_asset(player1, "thermodynamics", 1)
    add_asset(player1, "physics", 1)
    add_asset(player1, "building_technology", 1)
    add_asset(player1, "mineral_extraction", 1)
    add_asset(player1, "transport_technology", 1)
    add_asset(player1, "materials", 1)
    add_asset(player1, "civil_engineering", 1)
    add_asset(player1, "aerodynamics", 1)
    add_asset(player1, "chemistry", 5)
    add_asset(player1, "nuclear_engineering", 1)

    # add_asset(player1, "molten_salt", 1)
    # add_asset(player1, "hydrogen_storage", 1)
    # add_asset(player1, "solid_state_batteries", 1)
    # add_asset(player1, "gas_drilling_site", 1)

    # Player 2
    player2.money = 1_000_000_000
    player2.resources = {"coal": 300_000, "gas": 100_000, "uranium": 500}

    add_asset(player2, "warehouse", 20)
    add_asset(player2, "steam_engine", 20)
    add_asset(player2, "industry", 10)
    # Player 3
    # add_asset(player3, "mathematics", 1)
    # add_asset(player3, "mechanical_engineering", 1)
    # add_asset(player3, "thermodynamics", 1)
    # add_asset(player3, "physics", 1)
    # add_asset(player3, "building_technology", 1)
    # add_asset(player3, "mineral_extraction", 1)
    # add_asset(player3, "transport_technology", 1)
    # add_asset(player3, "materials", 1)
    # add_asset(player3, "civil_engineering", 1)
    # add_asset(player3, "aerodynamics", 1)
    # add_asset(player3, "chemistry", 5)
    # add_asset(player3, "nuclear_engineering", 1)

    # if player:
    #     HexTile.filter_by(id=35).first().player_id = player.id

    #     player.money = 1_000_000
    #     player.resources = {"coal":4_500_000, "gas":80_000_000, "uranium":4_500}
    #     player.priorities_of_controllables = ""

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

    # player2 = create_player("user2", "password")
    # if player2:
    #     HexTile.filter_by(id=84).first().player_id = player2.id
    #     player2.data.priorities_of_controllables = ""
    #     add_asset(player2, "industry", 19)
    #     add_asset(player2, "warehouse", 1)
    #     add_asset(player2, "steam_engine", 10)
    #     add_asset(player2, "small_water_dam", 1)

    # player3 = create_player("user3", "password")
    # if player3:
    #     HexTile.filter_by(id=143).first().player_id = player3.id
    #     player3.data.priorities_of_controllables = ""
    #     add_asset(player3, "industry", 8)
    #     add_asset(player3, "onshore_wind_turbine", 5)

    # player4 = create_player("user4", "password")
    # if player4:
    #     HexTile.filter_by(id=28).first().player_id = player4.id
    #     player4.data.priorities_of_controllables = ""
    #     add_asset(player4, "warehouse", 1)
    #     add_asset(player4, "watermill", 1)
    #     add_asset(player4, "steam_engine", 1)
    #     add_asset(player4, "small_pumped_hydro", 1)
    #     add_asset(player4, "coal_burner", 1)
    #     add_asset(player4, "coal_mine", 1)

    # create_network("net", [player, player2, player3])
