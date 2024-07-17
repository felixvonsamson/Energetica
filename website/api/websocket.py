"""Code providing API access using WebSockets and HTTP Basic Auth"""

import json
import pickle

from flask import Blueprint, current_app, g
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash
from simple_websocket import ConnectionClosed

from website import utils
from website.database.map import Hex
from website.database.messages import Chat, Message
from website.database.player import Network, Player
from website.gameEngine import gameEngine
from website.technology_effects import package_constructions_page_data

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
        ws.send(rest_setup_complete())
        ws.send(rest_get_global_data(engine))
        # TODO: Review what data is sent before a tile is selected
        ws.send(rest_get_map())
        ws.send(rest_get_players())
        ws.send(rest_get_current_player(player))
        ws.send(rest_get_chats(player))
        ws.send(rest_get_last_opened_chat(player))
        ws.send(rest_get_show_chat_disclaimer(player))
        ws.send(rest_get_networks())
        # ws.send(rest_get_scoreboard())
        # ws.send(rest_get_constructions(player))
        # ws.send(rest_get_construction_queue(player))
        # ws.send(rest_get_weather(engine))
        ws.send(rest_get_advancements(player))
        if player.tile is not None:
            rest_init_ws_post_location(player, ws)
        if player.id not in engine.websocket_dict:
            engine.websocket_dict[player.id] = []
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
                    rest_parse_request(engine, player, ws, uuid, message_data)
                case message_type:
                    engine.log(
                        f"Websocket connection from player {player} sent an unkown message of type {message_type}"
                    )


def unregister_websocket_connection(player_id, ws):
    """Removes the ws object from the player's registered ws connections"""
    player = Player.query.get(player_id)
    g.engine.log(f"Websocket connection closed for player {player}")
    g.engine.websocket_dict[player_id].remove(ws)


def rest_init_ws_post_location(player, ws):
    """
    Called once the player has selected a location, or immediately after logging
    in if location was already selected.
    """
    # ws.send(rest_get_charts()) # TODO
    ws.send(rest_get_facilities_data(player))


# The following methods generate messages to be sent over websocket connections.
# These are returned in the form of JSON formatted strings. See the
# `ServerMessage` enum in the Xcode project.


def rest_setup_complete():
    """Tells the ws connection that authentication happened successfully"""
    # TODO: deprecate this. There should HTTP standard ways of dealing with this
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


def rest_get_chats(player: Player):
    """Gets the player's chats and returns it as JSON string."""
    response = {"type": "getChats", "data": player.package_chats()}
    return json.dumps(response)


def rest_get_last_opened_chat(player: Player):
    """Gets the id of the player's last opened chat and returns is as a JSON string."""
    response = {"type": "getLastOpenedChat", "data": player.last_opened_chat}
    return json.dumps(response)


def rest_get_show_chat_disclaimer(player: Player):
    """Gets the flag for if the chat disclaimer should be shown and returns it as a JSON string."""
    response = {"type": "showChatDisclaimer", "data": player.show_disclamer}
    return json.dumps(response)


def rest_get_global_data(engine: gameEngine):
    """Gets gloabl engine data and returns it as a JSON string"""
    response = {"type": "getGlobalData", "data": engine.package_global_data()}
    return json.dumps(response)


def rest_get_constructions(player: Player):
    """Gets the player's constructions and returns it as a JSON string"""
    return json.dumps(
        {
            "type": "getConstructions",
            "data": player.package_constructions(),
        }
    )


def rest_get_construction_queue(player):
    """Gets the player's priority queue for constructions and returns it as a JSON string"""
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
        "data": {
            network.id: {
                "id": network.id,
                "name": network.name,
                "member_ids": [player.id for player in network.members],
            }
            for network in network_list
        },
    }
    return json.dumps(response)


def rest_add_player_location(player):
    """Informs the client that a player has chosen a location, packaged as a
    JSON string."""
    response = {
        "type": "updatePlayerLocation",
        "data": {"player_id": player.id, "cell_id": player.tile.id},
    }
    return json.dumps(response)


def rest_new_chat_message(chat_id: int, message: Message):
    """Packages a new chat message into a JSON string."""
    response = {"type": "newChatMessage", "chat_id": chat_id, "new_message": message.package()}
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


def rest_get_facilities_data(player: Player):
    """Gets player's facilities data and returns it as a JSON string"""
    return json.dumps({"type": "getFacilitiesData", "data": package_constructions_page_data(player)})


def rest_get_scoreboard():
    """Gets the scoreboard and returns it as a JSON string"""
    response = {"type": "getScoreboard", "data": Player.package_scoreboard()}
    return json.dumps(response)


def rest_get_weather(engine):
    """Gets the weather and returns it as a JSON string"""
    response = {
        "type": "getWeather",
        "data": engine.data["weather"].package(engine.data["total_t"]),
    }
    return json.dumps(response)


def rest_get_advancements(player: Player):
    """Gets the player's advancements and returns it as a JSON string"""
    response = {
        "type": "getAdvancements",
        "data": {
            advancement: advancement in player.advancements
            for advancement in ["network", "technology", "warehouse", "GHG_effect", "storage_overview"]
        },
    }
    return json.dumps(response)


def rest_request_response(uuid, endpoint, data):
    """Package a request response in JSON"""
    response = {
        "type": "requestResponse",
        "uuid": uuid,
        "request_response": endpoint,
        "data": data,
    }
    return json.dumps(response)


## Client Messages


def rest_parse_request(engine, player: Player, ws, uuid, data):
    """Interpret a request sent from a REST client"""
    endpoint = data["endpoint"]
    body = data["body"] if "body" in data else None
    print(f"rest_parse_request({player.username}, {endpoint})")
    match endpoint:
        case "confirmLocation":
            rest_parse_request_confirm_location(ws, uuid, body)
        case "joinNetwork":
            rest_parse_request_join_network(engine, ws, uuid, body)
        case "leaveNetwork":
            rest_parse_request_leave_network(engine, ws, uuid)
        case "createNetwork":
            rest_parse_request_create_network(engine, ws, uuid, body)
        case "startProject":
            rest_parse_request_start_project(engine, ws, uuid, body)
        case "pauseUnpauseProject":
            rest_parse_request_pause_unpause_project(ws, uuid, body)
        case "decreaseProjectPriority":
            rest_parse_request_decrease_project_priority(ws, uuid, body)
        case "dismissChatDisclaimer":
            utils.hide_chat_disclaimer(player)
        case "createChat":
            buddy_id = data["buddy_id"]
            utils.create_chat_2(player, buddy_id)
        case "createGroupChat":
            chat_name = data["chat_name"]
            participant_ids = data["participant_ids"]
            utils.create_group_chat_2(player, chat_name, participant_ids)
        case "sendMessage":
            chat_id = data["chat_id"]
            message = data["message"]
            utils.add_message(player, message, chat_id)
        case _:
            engine.warn(f"rest_parse_request got unknown endpoint: {endpoint}")


def rest_parse_request_confirm_location(ws, uuid, data):
    """Interpret message sent from a client when they chose a location."""
    cell_id = data
    response = utils.confirm_location(engine=g.engine, player=g.player, location=Hex.query.get(cell_id))
    print(f"ws is {ws} and we're sending rest_respond_confirmLocation")
    message = rest_request_response(uuid, "confirmLocation", response)
    ws.send(message)
    if response["response"] == "success":
        rest_init_ws_post_location(g.player, ws)


def rest_parse_request_join_network(engine, ws, uuid, data):
    """Interpret message sent from a client when they join a network."""
    network_id = data
    network = Network.query.get(network_id)
    response = utils.join_network(engine, g.player, network)
    message = rest_request_response(uuid, "joinNetwork", response)
    ws.send(message)


def rest_parse_request_leave_network(engine, ws, uuid):
    """Interpret message sent from a client when they leave a network"""
    response = utils.leave_network(engine, g.player)
    message = rest_request_response(uuid, "leaveNetwork", response)
    ws.send(message)


def rest_parse_request_create_network(engine, ws, uuid, data):
    """Interpret message sent from a client when they create a network"""
    network_name = data
    response = utils.create_network(engine, g.player, network_name)
    message = rest_request_response(uuid, "createNetwork", response)
    ws.send(message)


def rest_parse_request_start_project(engine, ws, uuid, data):
    """Interpret message sent from a client when they start a project"""
    facility = data["facility"]
    family = data["family"]
    print(f"rest_parse_request_startProject got: family = {family}, facility = {facility}")
    response = utils.start_project(engine, g.player, facility, family)
    message = rest_request_response(uuid, "startProject", response)
    ws.send(message)


def rest_parse_request_pause_unpause_project(ws, uuid, data):
    """Interpret message sent from a client when they pause or unpause a
    project"""
    construction_id = data
    response = utils.pause_project(g.player, construction_id)
    message = rest_request_response(uuid, "pauseUnpauseProject", response)
    ws.send(message)


def rest_parse_request_decrease_project_priority(ws, uuid, data):
    """Interpret message sent from a client when they decrease a project's
    priority"""
    construction_id = data
    response = utils.decrease_project_priority(g.player, construction_id)
    message = rest_request_response(uuid, "decreaseProjectPriority", response)
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
    """send `message` to all of `player`'s active wesocket sessions"""
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


def rest_notify_new_player(engine):
    """Notify to all active sessions the new list of players"""
    rest_notify_all_players(engine, rest_get_players())
    engine.socketio.emit("get_players", Player.package_all())


def rest_notify_global_data(engine: gameEngine):
    """Notify to all ws sessions the new global enginen data"""
    message = rest_get_global_data(engine)
    rest_notify_all_players(engine, message)


def rest_notify_scoreboard(engine):
    """Notify to all ws sessions the new scoreboard"""
    message = rest_get_scoreboard()
    rest_notify_all_players(engine, message)


def rest_notify_constructions(engine, player):
    """Notify all `player`'s ws sessions the new constructions data"""
    rest_notify_player(engine, player, rest_get_constructions(player))
    rest_notify_construction_queue(engine, player)


def rest_notify_construction_queue(engine, player):
    """Notify all `player`'s ws sessions the new constructions queue"""
    rest_notify_player(engine, player, rest_get_construction_queue(player))


def rest_notify_weather(engine):
    """Notify to all ws sessions the new weather data"""
    message = rest_get_weather(engine)
    rest_notify_all_players(engine, message)


def rest_notify_advancements(engine, player: Player):
    """Notify all `player`'s ws sessions the new advancements"""
    rest_notify_player(engine, player, rest_get_advancements(player))


def notify_new_chat(chat: Chat):
    """Notify too all new chat participants the new chat data"""
    for player in chat.participants:
        player: Player
        player.last_opened_chat = chat.id
        rest_notify_player(g.engine, player, rest_get_chats(player))
        rest_notify_player(g.engine, player, rest_get_last_opened_chat(player))
