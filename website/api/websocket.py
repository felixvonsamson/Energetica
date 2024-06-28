"""Code providing API access using WebSockets and HTTP Basic Auth"""

import json
import pickle

from flask import Blueprint, current_app, g
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash
from simple_websocket import ConnectionClosed

from website import utils
from website.database.map import Hex
from website.database.player import Network, Player

websocket_blueprint = Blueprint("rest_api", __name__)


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
            if check_password_hash(player.pwhash, password):
                engine.log(f"{username} logged in via WebSocket")
                return username
            else:
                engine.log(f"{username} failed to log in via WebSocket")

    @websocket_blueprint.before_request
    @basic_auth.login_required
    def check_user():
        """Sets up variables used by endpoints."""
        g.engine = current_app.config["engine"]
        g.player = Player.query.filter_by(username=basic_auth.current_user()).first()

    # Main WebSocket endpoint for Swift client
    @sock.route("/rest_ws", bp=websocket_blueprint)
    def rest_ws(ws):
        """Main WebSocket endpoint for API."""
        player = g.player
        engine.log(f"Received WebSocket connection for player {player}")
        ws.send(rest_get_map())
        ws.send(rest_get_players())
        ws.send(rest_get_current_player(player))
        ws.send(rest_get_networks())
        ws.send(rest_get_scoreboard())
        ws.send(rest_get_constructions(player))
        ws.send(rest_get_construction_queue(player))
        ws.send(rest_get_weather(engine))
        if player.tile is not None:
            rest_init_ws_post_location(engine, ws)
        if player.id not in engine.websocket_dict:
            engine.websocket_dict[player.id] = []
        ws.send(rest_setup_complete())
        engine.websocket_dict[player.id].append(ws)
        while True:
            try:
                data = ws.receive()
            except ConnectionClosed:
                unregister_websocket_connection(player.id, ws)
                break
            message = json.loads(data)
            message_data = message["data"]
            match message["type"]:
                # case "confirmLocation":
                #     rest_confirm_location(engine, ws, message_data)
                case "request":
                    uuid = message["uuid"]
                    rest_parse_request(engine, ws, uuid, message_data)
                case message_type:
                    engine.log(
                        f"Websocket connection from player {player} sent an unkown message of type {message_type}"
                    )


def unregister_websocket_connection(player_id, ws):
    player = Player.query.get(player_id)
    g.engine.log(f"Websocket connection closed for player {player}")
    g.engine.websocket_dict[player_id].remove(ws)


def rest_init_ws_post_location(engine, ws):
    """
    Called once the player has selected a location, or immediately after logging
    in if location was already selected.

    FIXME: rest_get_facilities_data needs fixing
    """
    # ws.send(rest_get_charts())
    # ws.send(rest_get_facilities_data(engine))


# The following methods generate messages to be sent over websocket connections.
# These are returned in the form of JSON formatted strings. See the
# `ServerMessage` enum in the Xcode project.


def rest_setup_complete():
    response = {"type": "setupComplete"}
    return json.dumps(response)


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
    return json.dumps({"type": "getPlayers", "data": Player.package_all()})


def rest_get_current_player(current_player):
    """Gets the current player's id and returns it as a JSON string."""
    response = {"type": "getCurrentPlayer", "data": current_player.id}
    return json.dumps(response)


def rest_get_constructions(player):
    return json.dumps(
        {
            "type": "getConstructions",
            "data": player.package_constructions(),
        }
    )


def rest_get_construction_queue(player):
    return json.dumps(
        {
            "type": "getConstructionQueue",
            "data": player.package_construction_queue(),
        }
    )


def rest_get_networks():
    """Gets all player data and returns it as a JSON string.
    A client receiving a message of type `getNetworks` should disregard any
    previous network data."""
    network_list = Network.query.all()
    response = {
        "type": "getNetworks",
        "data": [
            {
                "id": network.id,
                "name": network.name,
                "members": [player.id for player in network.members],
            }
            for network in network_list
        ],
    }
    return json.dumps(response)


def rest_add_player_location(player):
    """Informs the client that a player has chosen a location, packaged as a
    JSON string."""
    response = {
        "type": "updatePlayerLocation",
        "data": {"id": player.id, "tile": player.tile.id},
    }
    return json.dumps(response)


def rest_get_charts():
    # !!! current_t HAS BEEN REMOVED !!!
    """Gets the player's chart data and returns it as a JSON string."""
    current_t = g.engine.data["current_t"]
    timescale = "day"  # request.args.get('timescale')
    filename = f"instance/player_data/{g.player.id}/{timescale}.pck"
    with open(filename, "rb") as file:
        file_data = pickle.load(file)

    def combine_file_data_and_engine_data(file_data, engine_data):
        combined_data_unsliced = file_data + engine_data[1 : current_t + 1]
        return combined_data_unsliced[-360:]

    def industry_data_for(category, subcategory):
        return combine_file_data_and_engine_data(
            file_data[category][subcategory],
            g.engine.data["current_data"][g.player.id][category][subcategory],
        )

    subcategories = {
        "revenues": ["industry", "imports", "exports", "dumping"],
        "op_costs": ["steam_engine"],
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
            category: {subcategory: industry_data_for(category, subcategory) for subcategory in subcategories[category]}
            for category in ["revenues", "generation", "demand"]
        },
    }
    return json.dumps(response)


def rest_get_facilities_data(engine):
    """
    Gets player's facilities data and returns it as a JSON string

    FIXME: All the keys have changed
    """
    assets = engine.const_config["assets"]
    # the contents of this are now distributed in a constant and a variable part
    power_facilities_property_keys = [
        "price",
        "construction time",
        "construction power",
        "construction pollution",
        "locked",
        "power generation",
        "ramping speed",
        "O&M cost",
        "consumed resource",
        "pollution",
        "lifespan",
    ]
    power_facilities_data = [
        {"name": facility}
        | {property_key: assets[facility][property_key] for property_key in power_facilities_property_keys}
        for facility in engine.power_facilities
    ]
    storage_facilities_property_keys = [
        "price",
        "construction time",
        "construction power",
        "construction pollution",
        "locked",
        "storage capacity",
        "power generation",
        "ramping speed",
        "efficiency",
        "O&M cost",
        "lifespan",
    ]
    storage_facilities_data = [
        {"name": facility}
        | {property_key: assets[facility][property_key] for property_key in storage_facilities_property_keys}
        for facility in engine.storage_facilities
    ]
    extraction_facilities_property_keys = [
        "price",
        "construction time",
        "construction power",
        "construction pollution",
        "locked",
        "power consumption",
        "O&M cost",
        "pollution",
        "lifespan",
    ]
    extraction_facilities_data = [
        {"name": facility}
        | {property_key: assets[facility][property_key] for property_key in extraction_facilities_property_keys}
        for facility in engine.extraction_facilities
    ]
    functional_facilities_property_keys = [
        "price",
        "locked",
        "construction time",
        "construction power",
        "construction pollution",
    ]
    functional_facilities_data = [
        {"name": facility}
        | {property_key: assets[facility][property_key] for property_key in functional_facilities_property_keys}
        for facility in engine.functional_facilities
    ]
    response = {
        "type": "getFacilitiesData",
        "data": {
            "power_facilities": power_facilities_data,
            "storage_facilities": storage_facilities_data,
            "extraction_facilities": extraction_facilities_data,
            "functional_facilities": functional_facilities_data,
        },
    }
    return json.dumps(response)


def rest_get_scoreboard():
    response = {"type": "getScoreboard", "data": Player.package_scoreboard()}
    return json.dumps(response)


def rest_get_weather(engine):
    response = {
        "type": "getWeather",
        "data": engine.data["weather"].package(engine.data["total_t"]),
    }
    return json.dumps(response)


def rest_requestResponse(uuid, endpoint, data):
    response = {
        "type": "requestResponse",
        "uuid": uuid,
        "request_response": endpoint,
        "data": data,
    }
    return json.dumps(response)


## Client Messages


def rest_parse_request(engine, ws, uuid, data):
    """Interpret a request sent from a REST client"""
    endpoint = data["endpoint"]
    body = data["body"] if "body" in data else None
    match endpoint:
        case "confirmLocation":
            rest_parse_request_confirmLocation(engine, ws, uuid, body)
        case "joinNetwork":
            rest_parse_request_joinNetwork(engine, ws, uuid, body)
        case "leaveNetwork":
            rest_parse_request_leaveNetwork(engine, ws, uuid)
        case "createNetwork":
            rest_parse_request_createNetwork(engine, ws, uuid, body)
        case "startProject":
            rest_parse_request_startProject(engine, ws, uuid, body)
        case "pauseUnpauseProject":
            rest_parse_request_pauseUnpauseProject(engine, ws, uuid, body)
        case "decreaseProjectPriority":
            rest_parse_request_decreaseProjectPriority(engine, ws, uuid, body)
        case _:
            engine.warn(f"rest_parse_request got unknown endpoint: {endpoint}")


def rest_parse_request_confirmLocation(engine, ws, uuid, data):
    """Interpret message sent from a client when they chose a location."""
    cell_id = data
    response = utils.confirm_location(engine=g.engine, player=g.player, location=Hex.query.get(cell_id))
    print(f"ws is {ws} and we're sending rest_respond_confirmLocation")
    message = rest_requestResponse(uuid, "confirmLocation", response)
    ws.send(message)
    if response["response"] == "success":
        rest_init_ws_post_location(engine, ws)


def rest_parse_request_joinNetwork(engine, ws, uuid, data):
    """Interpret message sent from a client when they join a network."""
    network_id = data
    network = Network.query.get(network_id)
    response = utils.join_network(engine, g.player, network)
    message = rest_requestResponse(uuid, "joinNetwork", response)
    ws.send(message)


def rest_parse_request_leaveNetwork(engine, ws, uuid):
    """Interpret message sent from a client when they leave a network"""
    response = utils.leave_network(engine, g.player)
    message = rest_requestResponse(uuid, "leaveNetwork", response)
    ws.send(message)


def rest_parse_request_createNetwork(engine, ws, uuid, data):
    """Interpret message sent from a client when they create a network"""
    network_name = data
    response = utils.create_network(engine, g.player, network_name)
    message = rest_requestResponse(uuid, "createNetwork", response)
    ws.send(message)


def rest_parse_request_startProject(engine, ws, uuid, data):
    """Interpret message sent from a client when they start a project"""
    facility = data["facility"]
    family = data["family"]
    print(f"rest_parse_request_startProject got: family = {family}, facility = {facility}")
    response = utils.start_project(engine, g.player, facility, family)
    message = rest_requestResponse(uuid, "startProject", response)
    ws.send(message)


def rest_parse_request_pauseUnpauseProject(engine, ws, uuid, data):
    """Interpret message sent from a client when they pause or unpause a
    project"""
    construction_id = data
    response = utils.pause_project(g.player, construction_id)
    message = rest_requestResponse(uuid, "pauseUnpauseProject", response)
    ws.send(message)


def rest_parse_request_decreaseProjectPriority(engine, ws, uuid, data):
    """Interpret message sent from a client when they decrease a project's
    priority"""
    construction_id = data
    response = utils.decrease_project_priority(g.player, construction_id)
    message = rest_requestResponse(uuid, "decreaseProjectPriority", response)
    ws.send(message)


# WebSocket methods, hooked into engine states & events


def rest_notify_all_players(engine, message):
    """Relays the `message` argument to all currently connected REST clients."""
    for player_id, wss in engine.websocket_dict.items():
        for ws in wss:
            try:
                ws.send(message)
            except ConnectionClosed:
                unregister_websocket_connection(player_id, ws)


def rest_notify_player(engine, player, message):
    if player.id not in engine.websocket_dict:
        return
    for ws in engine.websocket_dict[player.id]:
        try:
            ws.send(message)
        except ConnectionClosed:
            unregister_websocket_connection(player.id, ws)


def rest_notify_player_location(engine, player):
    """This mehtod is called when player (argument) has chosen a location. This
    information needs to be relayed to clients, and this methods returns a JSON
    string with this information."""
    message = rest_add_player_location(player)
    rest_notify_all_players(engine, message)
    rest_notify_scoreboard(engine)
    engine.socketio.emit("get_players", Player.package_all())


def rest_notify_network_change(engine):
    """This mehtod is called any change to the state of any network is made.
    This includes when a network is created, when a player joins a network, and
    when a player leaves a network. These changes are relayed to all connected
    REST clients."""
    message = rest_get_networks()
    rest_notify_all_players(engine, message)


def rest_notify_new_player(engine, player):
    rest_notify_all_players(engine, rest_get_players())
    engine.socketio.emit("get_players", Player.package_all())


def rest_notify_scoreboard(engine):
    message = rest_get_scoreboard()
    rest_notify_all_players(engine, message)


def rest_notify_constructions(engine, player):
    rest_notify_player(engine, player, rest_get_constructions(player))
    rest_notify_construction_queue(engine, player)


def rest_notify_construction_queue(engine, player):
    rest_notify_player(engine, player, rest_get_construction_queue(player))


def rest_notify_weather(engine):
    message = rest_get_weather(engine)
    rest_notify_all_players(engine, message)
