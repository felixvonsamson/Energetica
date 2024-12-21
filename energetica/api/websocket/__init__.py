"""Code providing API access using WebSockets for iOS Swift Client."""

from __future__ import annotations

import inspect
import json
import time
from typing import TYPE_CHECKING

from flask import Blueprint
from flask_sock import Sock
from simple_websocket import ConnectionClosed, Server
from werkzeug.security import check_password_hash

from energetica.api.websocket import ws_broadcast, ws_messages, ws_requests

if TYPE_CHECKING:
    from energetica.database.player import Player
    from energetica.game_engine import GameEngine

websocket_blueprint = Blueprint("rest_api", __name__)


def add_sock_handlers(sock: Sock, engine: GameEngine) -> None:
    """Add flask-sock endpoints and other various setup methods. Called by energetica/__init__.py."""
    from energetica.game_engine import GameError

    def verify_password(username: str, password: str) -> Player | None:
        """Verify the given credentials. Return the corresponding player if it exists."""
        from energetica.database.player import Player

        player = Player.query.filter_by(username=username).first()
        if player:
            if check_password_hash(player.pwhash, password):
                engine.log(f"{username} logged in via WebSocket")
                return player
            engine.log(f"{username} failed to log in via WebSocket")
        return None

    @sock.route("/rest_ws", bp=websocket_blueprint)
    def rest_ws(ws: Server) -> None:
        """Define the WebSocket endpoint for API used for the iOS client."""
        player: Player | None = None
        # engine.log("Received WebSocket connection")
        requests = dict(inspect.getmembers(ws_requests, inspect.isfunction))

        def send_message(message: dict) -> None:
            ws.send(json.dumps(message))

        def post_location_setup() -> None:
            send_message(ws_messages.facilities_data(player))
            send_message(ws_messages.get_chats(player))
            send_message(ws_messages.get_show_chat_disclaimer(player))
            # ws.send(rest_get_charts()) # TODO

        def post_auth_setup() -> None:
            if player is None:
                raise ValueError()
            engine.log(f"Player {player.username} logged in via WebSocket")
            send_message(ws_messages.players())
            send_message(ws_messages.user_player_id(player))
            send_message(ws_messages.get_map())
            if player.tile is not None:
                post_location_setup()

        def parse_request(uuid: str, request: dict) -> None:
            nonlocal player

            def send_response(response: dict) -> None:
                message = {"response": {"uuid": uuid, "data": response}}
                send_message(message)

            def send_success() -> None:
                send_response({"success": {}})

            def send_error(error: GameError) -> None:
                send_response({"error": {"type": str(error)}})

            request_keys = list(request.keys())
            if len(request_keys) != 1:
                msg = f"Invalid request: {request}"
                engine.log(msg)
                raise ValueError(msg)

            request_type = request_keys[0]
            request_body = request[request_type]

            if request_type == "login":
                if player is not None:
                    engine.log("Player already logged in")
                    send_error(GameError("alreadyLoggedIn"))
                    return
                username = request_body["username"]
                password = request_body["password"]
                player = verify_password(username, password)
                if player is None:
                    send_error(GameError("invalidCredentials"))
                    return
                ws_broadcast.register_websocket_connection(engine, player.id, ws)
                send_success()
                send_message(ws_messages.players())
                post_auth_setup()
                return

            if request_type == "signup":
                if player is not None:
                    engine.log("Player already logged in")
                    send_error(GameError("alreadyLoggedIn"))
                    return
                username = request_body["username"]
                password1 = request_body["password1"]
                password2 = request_body["password2"]
                try:
                    from energetica.utils.auth_logic import signup_player

                    player = signup_player(username, password1, password2)
                except GameError as e:
                    send_error(e)
                    return
                ws_broadcast.register_websocket_connection(engine, player.id, ws)
                send_success()
                post_auth_setup()
                return

            if request_type == "signout":
                if player is None:
                    engine.log("Player not logged in")
                    send_error(GameError("notLoggedIn"))
                    return
                player = None
                send_success()
                return

            if request_type in requests:
                if player is None:
                    send_error(GameError("notLoggedIn"))
                    return
                request_handler = requests[request_type]
                arguments = request_body
                response = request_handler(engine, player, **arguments)
                send_response(response)
                if request_type == "confirmLocation":
                    post_location_setup()
                return

            msg = f"Unknown request type: {request_type}"
            engine.log(msg)
            raise ValueError(msg)

        def parse_message(message: dict) -> None:
            message_keys = list(message.keys())
            if len(message_keys) != 1:
                msg = f"Invalid message: {message}"
                engine.log(msg)
                raise ValueError(msg)

            message_type = message_keys[0]
            if message_type == "request":
                uuid: str = message[message_type]["uuid"]
                request: dict = message[message_type]["data"]
                parse_request(uuid, request)
            else:
                msg = f"Websocket connection from player {player} sent an unknown message of type {message['type']}"
                engine.log(msg)

        while True:
            try:
                data: str = ws.receive()
                # time.sleep(0.4) # Used for testing high latency
                message = json.loads(data)
                parse_message(message)
            except ConnectionClosed as e:
                engine.log(e)
                engine.log("Websocket connection closed")
                engine.log(ws.close_reason)
                engine.log(ws.close_message)
                break

        # ws.send(rest_setup_complete())
        # ws.send(rest_get_global_data(engine))
        # # TODO: Review what data is sent before a tile is selected
        # ws.send(rest_get_map())
        # ws.send(rest_get_players())
        # ws.send(rest_get_current_player(player))
        # ws.send(rest_get_chats(player))
        # ws.send(rest_get_last_opened_chat(player))
        # ws.send(rest_get_show_chat_disclaimer(player))
        # ws.send(rest_get_networks())
        # # ws.send(rest_get_scoreboard())
        # ws.send(rest_get_constructions(player))
        # ws.send(rest_get_construction_queue(player))
        # ws.send(rest_get_weather(engine, player))
        # ws.send(rest_get_achievements(player))
        # if player.tile is not None:
        #     rest_init_ws_post_location(player, ws)
        # if player.id not in engine.websocket_dict:
        #     engine.websocket_dict[player.id] = []
        # engine.websocket_dict[player.id].append(ws)
        # while True:
        #     try:
        #         data = ws.receive()
        #     except ConnectionClosed:
        #         if player is not None:
        #             unregister_websocket_connection(player.id, ws)
        #         break
        #     message = json.loads(data)
        #     message_data = message["data"]
        #     match message["type"]:
        #         # case "confirmLocation":
        #         #     rest_confirm_location(engine, ws, message_data)
        #         case "request":
        #             uuid = message["uuid"]
        #             rest_parse_request(engine, player, ws, uuid, message_data)
        #         case request_type:
        #             engine.log(
        #                 f"Websocket connection from player {player} sent an unknown message of type {request_type}"
        #             )


# The following methods generate messages to be sent over websocket connections.
# These are returned in the form of JSON formatted strings. See the
# `ServerMessage` enum in the Xcode project.

# def rest_get_global_data(engine: GameEngine):
#     """Gets global engine data and returns it as a JSON string"""
#     response = {"type": "getGlobalData", "data": engine.package_global_data()}
#     return json.dumps(response)


# def rest_get_constructions(player: Player):
#     """Gets the player's constructions and returns it as a JSON string"""
#     return json.dumps(
#         {
#             "type": "getConstructions",
#             "data": player.package_constructions(),
#         }
#     )


# def rest_get_construction_queue(player):
#     """Gets the player's priority queue for constructions and returns it as a JSON string"""
#     return json.dumps(
#         {
#             "type": "getConstructionQueue",
#             "data": player.package_construction_queue(),
#         }
#     )


# def rest_get_networks():
#     """Gets all player data and returns it as a JSON string.
#     A client receiving a message of type `getNetworks` should disregard any
#     previous network data."""
#     network_list = Network.query.all()
#     response = {
#         "type": "getNetworks",
#         "data": {
#             network.id: {
#                 "id": network.id,
#                 "name": network.name,
#                 "member_ids": [player.id for player in network.members],
#             }
#             for network in network_list
#         },
#     }
#     return json.dumps(response)


# def rest_add_player_location(player):
#     """Informs the client that a player has chosen a location, packaged as a
#     JSON string."""
#     response = {
#         "type": "updatePlayerLocation",
#         "data": {"player_id": player.id, "cell_id": player.tile.id},
#     }
#     return json.dumps(response)


# def rest_new_chat_message(chat_id: int, message: Message):
#     """Packages a new chat message into a JSON string."""
#     response = {"type": "newChatMessage", "chat_id": chat_id, "new_message": message.package()}
#     return json.dumps(response)


# def rest_get_charts():
#     # !!! current_t HAS BEEN REMOVED !!!
#     """Gets the player's chart data and returns it as a JSON string."""
#     current_t = g.engine.data["current_t"]
#     timescale = "day"  # request.args.get('timescale')
#     filename = f"instance/player_data/{g.player.id}/{timescale}.pck"
#     with open(filename, "rb") as file:
#         file_data = pickle.load(file)

#     def combine_file_data_and_engine_data(file_data, engine_data):
#         combined_data_unsliced = file_data + engine_data[1 : current_t + 1]
#         return combined_data_unsliced[-360:]

#     def industry_data_for(category, subcategory):
#         return combine_file_data_and_engine_data(
#             file_data[category][subcategory],
#             g.player.data.rolling_history[category][subcategory],
#         )

#     subcategories = {
#         "revenues": ["industry", "imports", "exports", "dumping"],
#         "op_costs": ["steam_engine"],
#         "generation": [
#             "watermill",
#             "small_water_dam",
#             "large_water_dam",
#             "nuclear_reactor",
#             "nuclear_reactor_gen4",
#             "steam_engine",
#             "coal_burner",
#             "gas_burner",
#             "combined_cycle",
#             "windmill",
#             "onshore_wind_turbine",
#             "offshore_wind_turbine",
#             "CSP_solar",
#             "PV_solar",
#             # storages I guess go here too
#             "small_pumped_hydro",
#             "large_pumped_hydro",
#             "lithium_ion_batteries",
#             "solid_state_batteries",
#             "molten_salt",
#             "hydrogen_storage",
#         ],
#         "demand": [
#             "coal_mine",
#             "gas_drilling_site",
#             "uranium_mine",
#             "research",
#             "construction",
#             "transport",
#             "industry",
#             "exports",
#             "dumping",
#             "small_pumped_hydro",
#             "large_pumped_hydro",
#             "lithium_ion_batteries",
#             "solid_state_batteries",
#             "molten_salt",
#             "hydrogen_storage",
#         ],
#         "storage": [
#             "small_pumped_hydro",
#             "large_pumped_hydro",
#             "lithium_ion_batteries",
#             "solid_state_batteries",
#             "molten_salt",
#             "hydrogen_storage",
#         ],
#     }
#     response = {
#         "type": "getCharts",
#         "data": {
#             category: {subcategory: industry_data_for(category, subcategory) for subcategory in subcategories[category]}
#             for category in ["revenues", "generation", "demand"]
#         },
#     }
#     return json.dumps(response)


# def rest_get_scoreboard():
#     """Gets the scoreboard and returns it as a JSON string"""
#     # response = {"type": "getScoreboard", "data": Player.package_scoreboard()}
#     return json.dumps({})


# def rest_get_weather(engine, player):
#     """Gets the weather and returns it as a JSON string"""
#     response = {
#         "type": "getWeather",
#         "data": package_weather_data(engine, player),
#     }
#     return json.dumps(response)


# def rest_get_achievements(player: Player):
#     """Gets the player's achievements and returns it as a JSON string"""
#     # TODO : This only treats a subset of achievements, precise the role of the function - Felix
#     response = {
#         "type": "getAdvancements",
#         "data": {
#             achievement: achievement in player.achievements
#             for achievement in [
#                 "Unlock Network",
#                 "Unlock Technologies",
#                 "Unlock Natural Resources",
#                 "Discover the Greenhouse Effect",
#                 "First Storage Facility",
#             ]
#         },
#     }
#     return json.dumps(response)


# def rest_request_response(uuid, response):
#     """Package a request response in JSON"""
#     response = {
#         "type": "requestResponse",
#         "uuid": uuid,
#         "data": response,
#     }
#     return json.dumps(response)


# ## Client Messages


# def rest_parse_request(engine: GameEngine, player: Player | None, ws: Server, uuid, data):
#     """Interpret a request sent from a REST client."""
#     endpoint = data["endpoint"]
#     body = data.get("body", None)
#     print(f"rest_parse_request({player.username}, {endpoint})")
#     match endpoint:
#         case "confirmLocation":
#             rest_parse_request_confirm_location(ws, uuid, body)
#         case "joinNetwork":
#             rest_parse_request_join_network(engine, ws, uuid, body)
#         case "leaveNetwork":
#             rest_parse_request_leave_network(engine, ws, uuid)
#         case "createNetwork":
#             rest_parse_request_create_network(engine, ws, uuid, body)
#         case "startProject":
#             rest_parse_request_queue_project(engine, ws, uuid, body)
#         case "pauseUnpauseProject":
#             rest_parse_request_pause_unpause_project(ws, uuid, body)
#         case "decreaseProjectPriority":
#             rest_parse_request_decrease_project_priority(ws, uuid, body)
#         case "dismissChatDisclaimer":
#             hide_chat_disclaimer(player)
#         case "createChat":
#             buddy_id = data["buddy_id"]
#             create_chat(player, buddy_id)
#         case "createGroupChat":
#             chat_name = data["chat_name"]
#             participant_ids = data["participant_ids"]
#             create_group_chat(player, chat_name, participant_ids)
#         case "sendMessage":
#             chat_id = data["chat_id"]
#             message = data["message"]
#             add_message(player, message, chat_id)
#         case _:
#             engine.warn(f"rest_parse_request got unknown endpoint: {endpoint}")


# def rest_parse_request_confirm_location(ws, uuid, data):
#     """Interpret message sent from a client when they chose a location."""
#     cell_id = data
#     response = confirm_location(engine=g.engine, player=g.player, location=db.session.get(Hex, cell_id))
#     print(f"ws is {ws} and we're sending rest_respond_confirmLocation")
#     message = rest_request_response(uuid, "confirmLocation", response)
#     ws.send(message)
#     if response["response"] == "success":
#         rest_init_ws_post_location(g.player, ws)


# def rest_parse_request_join_network(engine, ws, uuid, data):
#     """Interpret message sent from a client when they join a network."""
#     network_id = data
#     network = db.session.get(Network, network_id)
#     response = join_network(engine, g.player, network)
#     message = rest_request_response(uuid, "joinNetwork", response)
#     ws.send(message)


# def rest_parse_request_leave_network(engine, ws, uuid):
#     """Interpret message sent from a client when they leave a network"""
#     response = leave_network(engine, g.player)
#     message = rest_request_response(uuid, "leaveNetwork", response)
#     ws.send(message)


# def rest_parse_request_create_network(engine, ws, uuid, data):
#     """Interpret message sent from a client when they create a network"""
#     network_name = data
#     response = create_network(engine, g.player, network_name)
#     message = rest_request_response(uuid, "createNetwork", response)
#     ws.send(message)


# def rest_parse_request_queue_project(engine, ws, uuid, data):
#     """Interpret message sent from a client when they start a project"""
#     facility = data["facility"]
#     print(f"rest_parse_request_startProject got: facility = {facility}")
#     response = queue_project(engine, g.player, facility)
#     message = rest_request_response(uuid, "startProject", response)
#     ws.send(message)


# def rest_parse_request_pause_unpause_project(ws, uuid, data):
#     """Interpret message sent from a client when they pause or unpause a
#     project"""
#     construction_id = data
#     response = toggle_pause_project(g.player, construction_id)
#     message = rest_request_response(uuid, "pauseUnpauseProject", response)
#     ws.send(message)


# def rest_parse_request_decrease_project_priority(ws, uuid, data):
#     """Interpret message sent from a client when they decrease a project's
#     priority"""
#     construction_id = data
#     response = decrease_project_priority(g.player, construction_id)
#     message = rest_request_response(uuid, "decreaseProjectPriority", response)
#     ws.send(message)


# WebSocket methods, hooked into engine states & events


# def rest_notify_all_players(engine, message):
#     """Relays the `message` argument to all currently connected REST clients."""
#     for player_id, wss in engine.websocket_dict.items():
#         for ws in wss:
#             try:
#                 ws.send(message)
#             except ConnectionClosed:
#                 unregister_websocket_connection(player_id, ws)


# def rest_notify_player(engine, player, message):
#     """send `message` to all of `player`'s active websocket sessions"""
#     if player.id not in engine.websocket_dict:
#         return
#     for ws in engine.websocket_dict[player.id]:
#         try:
#             ws.send(message)
#         except ConnectionClosed:
#             unregister_websocket_connection(player.id, ws)


# def rest_notify_player_location(engine, player):
#     """This method is called when player (argument) has chosen a location. This
#     information needs to be relayed to clients, and this methods returns a JSON
#     string with this information."""
#     message = rest_add_player_location(player)
#     rest_notify_all_players(engine, message)
#     rest_notify_scoreboard(engine)
#     engine.socketio.emit("get_players", Player.package_all())


# def rest_notify_network_change(engine):
#     """This method is called any change to the state of any network is made.
#     This includes when a network is created, when a player joins a network, and
#     when a player leaves a network. These changes are relayed to all connected
#     REST clients."""
#     message = rest_get_networks()
#     rest_notify_all_players(engine, message)


# def rest_notify_new_player(engine):
#     """Notify to all active sessions the new list of players"""
#     rest_notify_all_players(engine, rest_get_players())
#     engine.socketio.emit("get_players", Player.package_all())


# def rest_notify_global_data(engine: GameEngine):
#     """Notify to all ws sessions the new global engine data"""
#     message = rest_get_global_data(engine)
#     rest_notify_all_players(engine, message)


# def rest_notify_scoreboard(engine):
#     """Notify to all ws sessions the new scoreboard"""
#     message = rest_get_scoreboard()
#     rest_notify_all_players(engine, message)


# def rest_notify_constructions(engine, player):
#     """Notify all `player`'s ws sessions the new constructions data"""
#     rest_notify_player(engine, player, rest_get_constructions(player))
#     rest_notify_construction_queue(engine, player)


# def rest_notify_construction_queue(engine, player):
#     """Notify all `player`'s ws sessions the new constructions queue"""
#     rest_notify_player(engine, player, rest_get_construction_queue(player))


# # TODO: The rest_get_weather() is now dependent on the player !
# def rest_notify_weather(engine):
#     """Notify to all ws sessions the new weather data"""
#     #     message = rest_get_weather(engine)
#     #     rest_notify_all_players(engine, message)
#     pass


# def rest_notify_achievements(engine, player: Player):
#     """Notify all `player`'s ws sessions the new achievements"""
#     rest_notify_player(engine, player, rest_get_achievements(player))


# def notify_new_chat(chat: Chat):
#     """Notify too all new chat participants the new chat data"""
#     for player in chat.participants:
#         player: Player
#         player.last_opened_chat = chat.id
#         rest_notify_player(g.engine, player, rest_get_chats(player))
#         rest_notify_player(g.engine, player, rest_get_last_opened_chat(player))
