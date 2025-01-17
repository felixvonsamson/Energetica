"""Module to initialize the database with test players and networks."""

from werkzeug.security import generate_password_hash

from energetica.database.map import HexTile
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.enums import Fuel, ProjectName
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.assets import finish_project, queue_project
from energetica.utils.misc import confirm_location
from energetica.utils.network_helpers import create_network, join_network


def init_test_players():
    """Initialize the database with test players and networks."""

    def add_asset(player: Player, project_name: ProjectName, n):
        """Create a project that will instantly finish."""
        for _ in range(n):
            ongoing_project = queue_project(
                player, project_name, force=True, ignore_requirements_and_money=True, skip_notifications=True
            )
            finish_project(ongoing_project, skip_notifications=True)
        engine.log(f"Added {n} {project_name} for {player.username}")

    def create_player(username, password, tile_id=None) -> Player:
        """Create and initialize a player."""
        player = next(Player.filter_by(username=username), None)
        if player:
            engine.log(f"create_player: player {username} already exists")
            return player
        player = Player(username=username, pwhash=generate_password_hash(password))
        # If tile_id is None, find any tile that isn't assigned to a player
        hex_tile = HexTile.get(tile_id) if tile_id else next(HexTile.filter_by(player=None))
        if not hex_tile:
            raise GameError("TileNotFound")  # TODO(mglst): centralize error handling, create static list of errors
        confirm_location(player, hex_tile)
        engine.log(f"create_player: player {username} created")
        return player

    def setup_network(name, members: list[Player]) -> Network:
        """Create and initialize a network."""
        # Unlock the network achievement for all members so that they can see the network page
        for player in members:
            player.achievements["network"] = 1

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
        """Fill the map with players that use coal to see climate change events."""
        players = []
        for i in range(1, 5):
            print("creating player", i)
            player = create_player(f"user{i}", "password")
            if player:
                HexTile.get(i).player = player

                player.money = 1_000_000_000
                player.resources = {Fuel.COAL: 300_000, Fuel.GAS: 100_000, Fuel.URANIUM: 500}

                add_asset(player, FunctionalFacility.INDUSTRY, 18)
                add_asset(player, FunctionalFacility.WAREHOUSE, 1)
                add_asset(player, HydroFacility.SMALL_WATER_DAM, 2)
                add_asset(player, WindFacility.ONSHORE_WIND_TURBINE, 3)
                add_asset(player, FunctionalFacility.LABORATORY, 5)
                add_asset(player, Technology.MATHEMATICS, 1)
                add_asset(player, Technology.MINERAL_EXTRACTION, 5)
                add_asset(player, Technology.BUILDING_TECHNOLOGY, 1)
                add_asset(player, Technology.CIVIL_ENGINEERING, 1)
                add_asset(player, ExtractionFacility.COAL_MINE, 3)
                add_asset(player, ControllableFacility.COAL_BURNER, 3)
                add_asset(player, StorageFacility.SMALL_PUMPED_HYDRO, 1)
                add_asset(player, StorageFacility.HYDROGEN_STORAGE, 1)
                add_asset(player, WindFacility.OFFSHORE_WIND_TURBINE, 1)
                add_asset(player, ControllableFacility.NUCLEAR_REACTOR_GEN4, 1)
                add_asset(player, ControllableFacility.COMBINED_CYCLE, 1)
                add_asset(player, ControllableFacility.GAS_BURNER, 1)
                add_asset(player, ControllableFacility.STEAM_ENGINE, 1)
                add_asset(player, Technology.CHEMISTRY, 2)
                add_asset(player, FunctionalFacility.CARBON_CAPTURE, 4)
                add_asset(player, Technology.MECHANICAL_ENGINEERING, 3)
                add_asset(player, Technology.PHYSICS, 2)
                add_asset(player, Technology.THERMODYNAMICS, 2)
                add_asset(player, Technology.NUCLEAR_ENGINEERING, 3)
                add_asset(player, Technology.AERODYNAMICS, 5)
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
    player1.resources[Fuel.COAL] = 300_000

    add_asset(player1, StorageFacility.MOLTEN_SALT, 1)
    add_asset(player1, StorageFacility.HYDROGEN_STORAGE, 1)
    add_asset(player1, StorageFacility.SOLID_STATE_BATTERIES, 1)

    add_asset(player1, Technology.PHYSICS, 6)
    add_asset(player1, Technology.AERODYNAMICS, 1)
    add_asset(player1, Technology.MATERIALS, 4)
    add_asset(player1, Technology.THERMODYNAMICS, 5)
    add_asset(player1, Technology.CHEMISTRY, 3)
    add_asset(player1, Technology.CIVIL_ENGINEERING, 1)

    add_asset(player1, StorageFacility.MOLTEN_SALT, 1)
    add_asset(player1, ExtractionFacility.COAL_MINE, 2)
    add_asset(player1, ExtractionFacility.URANIUM_MINE, 1)
    add_asset(player1, FunctionalFacility.WAREHOUSE, 1)
    add_asset(player1, FunctionalFacility.INDUSTRY, 12)
    add_asset(player1, FunctionalFacility.LABORATORY, 4)
    add_asset(player1, ControllableFacility.GAS_BURNER, 1)
    add_asset(player1, Technology.MECHANICAL_ENGINEERING, 1)
    add_asset(player1, ControllableFacility.COAL_BURNER, 1)
    add_asset(player1, Technology.MECHANICAL_ENGINEERING, 1)
    add_asset(player1, ControllableFacility.GAS_BURNER, 1)
    add_asset(player1, StorageFacility.SMALL_PUMPED_HYDRO, 1)
    add_asset(player1, Technology.MECHANICAL_ENGINEERING, 1)
    add_asset(player1, StorageFacility.SMALL_PUMPED_HYDRO, 1)
    add_asset(player1, ControllableFacility.COAL_BURNER, 1)
    add_asset(player1, SolarFacility.PV_SOLAR, 2)
    add_asset(player1, WindFacility.ONSHORE_WIND_TURBINE, 2)
    add_asset(player1, SolarFacility.CSP_SOLAR, 1)

    # One level of each technology
    add_asset(player1, Technology.MATHEMATICS, 1)
    add_asset(player1, Technology.MECHANICAL_ENGINEERING, 1)
    add_asset(player1, Technology.THERMODYNAMICS, 1)
    add_asset(player1, Technology.PHYSICS, 1)
    add_asset(player1, Technology.BUILDING_TECHNOLOGY, 1)
    add_asset(player1, Technology.MINERAL_EXTRACTION, 1)
    add_asset(player1, Technology.TRANSPORT_TECHNOLOGY, 1)
    add_asset(player1, Technology.MATERIALS, 1)
    add_asset(player1, Technology.CIVIL_ENGINEERING, 1)
    add_asset(player1, Technology.AERODYNAMICS, 1)
    add_asset(player1, Technology.CHEMISTRY, 5)
    add_asset(player1, Technology.NUCLEAR_ENGINEERING, 1)

    # Player 2
    player2.money = 1_000_000_000
    player2.resources = {Fuel.COAL: 300_000, Fuel.GAS: 100_000, Fuel.URANIUM: 500}

    add_asset(player2, FunctionalFacility.WAREHOUSE, 20)
    add_asset(player2, ControllableFacility.STEAM_ENGINE, 20)
    add_asset(player2, FunctionalFacility.INDUSTRY, 10)
    # Player 3
    # add_asset(player3, Technology.MATHEMATICS, 1)
    # add_asset(player3, Technology.MECHANICAL_ENGINEERING, 1)
    # add_asset(player3, Technology.THERMODYNAMICS, 1)
    # add_asset(player3, Technology.PHYSICS, 1)
    # add_asset(player3, Technology.BUILDING_TECHNOLOGY, 1)
    # add_asset(player3, Technology.MINERAL_EXTRACTION, 1)
    # add_asset(player3, Technology.TRANSPORT_TECHNOLOGY, 1)
    # add_asset(player3, Technology.MATERIALS, 1)
    # add_asset(player3, Technology.CIVIL_ENGINEERING, 1)
    # add_asset(player3, Technology.AERODYNAMICS, 1)
    # add_asset(player3, Technology.CHEMISTRY, 5)
    # add_asset(player3, Technology.NUCLEAR_ENGINEERING, 1)

    # if player:
    #     HexTile.filter_by(id=35).first().player = player

    #     player.money = 1_000_000
    #     player.resources = {Fuel.COAL: 4_500_000, Fuel.GAS: 80_000_000, Fuel.URANIUM: 4_500}
    #     player.priorities_of_controllables = ""

    #     add_asset(player, FunctionalFacility.INDUSTRY, 21)
    #     add_asset(player, FunctionalFacility.LABORATORY, 5)
    #     add_asset(player, Technology.MATHEMATICS, 1)
    #     add_asset(player, Technology.MINERAL_EXTRACTION, 5)
    #     add_asset(player, Technology.BUILDING_TECHNOLOGY, 1)
    #     add_asset(player, Technology.CIVIL_ENGINEERING, 1)
    #     add_asset(player, ExtractionFacility.COAL_MINE, 10)
    #     add_asset(player, ControllableFacility.COAL_BURNER, 25)
    #     # add_asset(player, ExtractionFacility.URANIUM_MINE, 1)
    #     add_asset(player, FunctionalFacility.WAREHOUSE, 10)
    #     add_asset(player, StorageFacility.SMALL_PUMPED_HYDRO, 1)
    #     add_asset(player, StorageFacility.HYDROGEN_STORAGE, 1)
    #     add_asset(player, WindFacility.ONSHORE_WIND_TURBINE, 15)
    #     # add_asset(player, WindFacility.OFFSHORE_WIND_TURBINE, 2)
    #     # add_asset(player, ControllableFacility.NUCLEAR_REACTOR_GEN4, 1)
    #     # add_asset(player, ControllableFacility.NUCLEAR_REACTOR, 1)
    #     add_asset(player, ControllableFacility.COMBINED_CYCLE, 8)
    #     add_asset(player, ControllableFacility.GAS_BURNER, 5)
    #     add_asset(player, ControllableFacility.STEAM_ENGINE, 1)
    #     add_asset(player, Technology.CHEMISTRY, 2)
    #     # add_asset(player, FunctionalFacility.CARBON_CAPTURE, 4)
    #     add_asset(player, Technology.MECHANICAL_ENGINEERING, 3)
    #     add_asset(player, Technology.PHYSICS, 2)
    #     add_asset(player, Technology.THERMODYNAMICS, 2)
    #     add_asset(player, Technology.NUCLEAR_ENGINEERING, 3)

    # player2 = create_player("user2", "password")
    # if player2:
    #     HexTile.filter_by(id=84).first().player = player2
    #     player2.data.priorities_of_controllables = ""
    #     add_asset(player2, FunctionalFacility.INDUSTRY, 19)
    #     add_asset(player2, FunctionalFacility.WAREHOUSE, 1)
    #     add_asset(player2, ControllableFacility.STEAM_ENGINE, 10)
    #     add_asset(player2, HydroFacility.SMALL_WATER_DAM, 1)

    # player3 = create_player("user3", "password")
    # if player3:
    #     HexTile.filter_by(id=143).first().player = player3
    #     player3.data.priorities_of_controllables = ""
    #     add_asset(player3, FunctionalFacility.INDUSTRY, 8)
    #     add_asset(player3, WindFacility.ONSHORE_WIND_TURBINE, 5)

    # player4 = create_player("user4", "password")
    # if player4:
    #     HexTile.filter_by(id=28).first().player = player4
    #     player4.data.priorities_of_controllables = ""
    #     add_asset(player4, FunctionalFacility.WAREHOUSE, 1)
    #     add_asset(player4, HydroFacility.WATERMILL, 1)
    #     add_asset(player4, ControllableFacility.STEAM_ENGINE, 1)
    #     add_asset(player4, StorageFacility.SMALL_PUMPED_HYDRO, 1)
    #     add_asset(player4, ControllableFacility.COAL_BURNER, 1)
    #     add_asset(player4, ExtractionFacility.COAL_MINE, 1)

    # create_network("net", [player, player2, player3])
