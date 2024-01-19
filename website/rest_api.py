"""Code providing API access using WebSockets and HTTP Basic Auth"""
import json
import pickle

from flask import Blueprint, current_app, g
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash

from . import db
from .database import Hex, Player

rest_api = Blueprint("rest_api", __name__)


def add_sock_handlers(sock, engine):
    """Adds flask-sock endpoints and other various setup methods. Called by
    __init__.py."""
    basic_auth = HTTPBasicAuth()

    # Authentication through HTTP Basic

    @basic_auth.verify_password
    def verify_password(username, password):
        """Called by flask-HTTPAUth to verify credentials."""
        player = Player.query.filter_by(username=username).first()
        if player:
            if check_password_hash(player.password, password):
                print(f"{username} logged in via HTTP Basic")
                return username
            else:
                print(f"{username} failed to log in via HTTP Basic")

    @rest_api.before_request
    @basic_auth.login_required
    def check_user():
        """Sets up variables used by endpoints."""
        g.engine = current_app.config["engine"]
        g.player = Player.query.filter_by(username=basic_auth.current_user()).first()

    # Main WebSocket endpoint for Swift client
    @sock.route("/rest_ws", bp=rest_api)
    def rest_ws(ws):
        """Main WebSocket endpoint for API."""
        print(f"Received WebSocket connection for player {g.player}")
        ws.send(rest_get_map())
        ws.send(rest_get_players())
        ws.send(rest_get_current_player(current_player=g.player))
        if g.player.tile is not None:
            rest_init_ws_post_location(ws)
        if g.player.id not in engine.websocket_dict:
            engine.websocket_dict[g.player.id] = []
        engine.websocket_dict[g.player.id].append(ws)
        while True:
            data = ws.receive()
            print(f"received on websocket: data = {data}")
            message = json.loads(data)
            message_data = message["data"]
            print(f"decoded json message = {message}")
            match message["type"]:
                case "confirmLocation":
                    rest_confirm_location(engine, ws, message_data)


def rest_init_ws_post_location(ws):
    """Called once the player has selected a location, or immediately after
    logging in if location was already selected."""
    ws.send(rest_get_charts())
    ws.send(rest_get_power_facilities())


def rest_get_map():
    """Gets the map data from the database and returns it as a JSON string as a
    dictionary of arrays."""
    hex_list = Hex.query.order_by(Hex.r, Hex.q).all()
    response = {
        "type": "getMap",
        "data": {
            "ids": [tile.id for tile in hex_list],
            "solars": [tile.solar for tile in hex_list],
            "winds": [tile.wind for tile in hex_list],
            "hydros": [tile.hydro for tile in hex_list],
            "coals": [tile.coal for tile in hex_list],
            "oils": [tile.oil for tile in hex_list],
            "gases": [tile.gas for tile in hex_list],
            "uraniums": [tile.uranium for tile in hex_list],
        },
    }
    return json.dumps(response)


def rest_get_players():
    """Gets all player data and returns it as a JSON string."""
    player_list = Player.query.all()
    response = {
        "type": "getPlayers",
        "data": [
            {
                "id": player.id,
                "username": player.username,
                "tile": player.tile.id if player.tile is not None else None,
            }
            for player in player_list
        ],
    }
    return json.dumps(response)


def rest_get_current_player(current_player):
    """Gets the current player's id and returns it as a JSON string."""
    response = {"type": "getCurrentPlayer", "data": current_player.id}
    return json.dumps(response)


def rest_get_charts():
    """Gets the player's chart data and returns it as a JSON string."""
    current_t = g.engine.data["current_t"]
    timescale = "day"  # request.args.get('timescale')
    filename = f"instance/player_data/{g.player.username}/{timescale}.pck"
    with open(filename, "rb") as file:
        file_data = pickle.load(file)

    def combine_file_data_and_engine_data(file_data, engine_data):
        combined_data_unsliced = file_data + engine_data[1 : current_t + 1]
        return combined_data_unsliced[-1440:]

    def industry_data_for(category, subcategory):
        return combine_file_data_and_engine_data(
            file_data[category][subcategory],
            g.engine.data["current_data"][g.player.username][category][subcategory],
        )

    subcategories = {
        "revenues": ["industry", "imports", "exports", "dumping", "O&M_costs"],
        "generation": [
            "watermill",
            "small_water_dam",
            "large_water_dam",
            "nuclear_reactor",
            "nuclear_reactor_gen4",
            "steam_engine",
            "coal_burner",
            "oil_burner",
            "gas_burner",
            "combined_cycle",
            "windmill",
            "onshore_wind_turbine",
            "offshore_wind_turbine",
            "CSP_solar",
            "PV_solar",
            # storages I guess go here too
            "small_pumped_hydro",
            "large_pumped_hydro",
            "lithium_ion_batteries",
            "solid_state_batteries",
            "compressed_air",
            "molten_salt",
            "hydrogen_storage",
        ],
        "demand": [
            "coal_mine",
            "oil_field",
            "gas_drilling_site",
            "uranium_mine",
            "research",
            "construction",
            "transport",
            "industry",
            "exports",
            "dumping",
            "small_pumped_hydro",
            "large_pumped_hydro",
            "lithium_ion_batteries",
            "solid_state_batteries",
            "compressed_air",
            "molten_salt",
            "hydrogen_storage",
        ],
        "storage": [
            "small_pumped_hydro",
            "large_pumped_hydro",
            "lithium_ion_batteries",
            "solid_state_batteries",
            "compressed_air",
            "molten_salt",
            "hydrogen_storage",
        ],
    }
    response = {
        "type": "getCharts",
        "data": {
            category: {
                subcategory: industry_data_for(category, subcategory)
                for subcategory in subcategories[category]
            }
            for category in ["revenues", "generation", "demand"]
        },
    }
    return json.dumps(response)


def rest_get_power_facilities():
    """Gets player's facilities data and returns it as a JSON string"""
    power_facilities_info = g.engine.config[g.player.id]["assets"]
    property_keys = ["price", "power generation", "locked"]
    power_facilities = [
        "steam_engine",
        "windmill",
        "watermill",
        "coal_burner",
        "oil_burner",
        "gas_burner",
        "small_water_dam",
        "onshore_wind_turbine",
        "combined_cycle",
        "nuclear_reactor",
        "large_water_dam",
        "CSP_solar",
        "PV_solar",
        "offshore_wind_turbine",
        "nuclear_reactor_gen4",
    ]
    response = {
        "type": "getPowerFacilities",
        "data": [
            {"name": facility}
            | {
                property_key: power_facilities_info[facility][property_key]
                for property_key in property_keys
            }
            for facility in power_facilities
        ],
    }
    return json.dumps(response)


## Alerts


def rest_server_alert(alert):
    """Creates a JSON string from the alert argument which once sent will make
    the client show an alert on screen."""
    response = {"type": "sendServerAlert", "data": alert}
    return json.dumps(response)


def rest_server_alert_location_already_taken(by_player):
    """Creates an alert to be shown on the client."""
    alert = {"message": "locationAlreadyTaken", "by_player": by_player}
    return rest_server_alert(alert)


## Client Messages


def rest_confirm_location(engine, ws, data):
    """Interpret message sent from a client when they chose a location."""
    cell_id = data
    location = Hex.query.get(cell_id)
    if location.player_id is not None:
        # Location already taken
        existing_player = Player.query.get(location.player_id)
        ws.send(rest_server_alert_location_already_taken(existing_player))
        return
    elif g.player.tile is not None:
        # Player already has a location
        # This is an invalid state - on the client side - so disconnect them
        ws.close()
        return
    else:
        location.player_id = g.player.id
        db.session.commit()
        rest_notify_player_location(engine, g.player)
        engine.refresh()
        print(f"{g.player.username} chose the location {location.id}")
        rest_init_ws_post_location(ws)


# WebSocket methods, hooked into engine states & events


def rest_add_player_location(player):
    """Informs the client that a player has chosen a location, packaged as a
    JSON string."""
    response = {
        "type": "updatePlayerLocation",
        "data": {"id": player.id, "tile": player.tile.id},
    }
    return json.dumps(response)


def rest_notify_player_location(engine, player):
    """This mehtod is called when player (argument) has chosen a location. This
    information needs to be relayed to clients, and this methods returns a JSON
    string with this information."""
    payload = rest_add_player_location(player)
    for _, wss in engine.websocket_dict.items():
        for ws in wss:
            ws.send(payload)
