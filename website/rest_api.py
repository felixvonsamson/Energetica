from flask import Blueprint, g, current_app
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash
from .database import Player, Hex
from . import db
import pickle
import json

rest_api = Blueprint("rest_api", __name__)


def add_sock_handlers(sock, engine):
    basic_auth = HTTPBasicAuth()

    # Authentication through HTTP Basic

    @basic_auth.verify_password
    def verify_password(username, password):
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
        g.engine = current_app.config["engine"]
        g.player = Player.query.filter_by(username=basic_auth.current_user()).first()

    # Main WebSocket endpoint for Swift client
    @sock.route("/rest_ws", bp=rest_api)
    def rest_ws(ws):
        print(f"Received WebSocket connection for player {g.player}")
        ws.send(rest_get_map())
        ws.send(rest_get_players())
        ws.send(rest_get_current_player(currentPlayer=g.player))
        if len(g.player.tile) != 0:
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
    ws.send(rest_get_charts())


# gets the map data from the database and returns it as a dictionary of arrays
def rest_get_map():
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


# Sends the relevant player data
def rest_get_players():
    player_list = Player.query.all()
    response = {
        "type": "getPlayers",
        "data": [
            {
                "id": player.id,
                "username": player.username,
                "tile": player.tile[0].id if len(player.tile) > 0 else None,
            }
            for player in player_list
        ],
    }
    return json.dumps(response)


# Sends the client their player id
def rest_get_current_player(currentPlayer):
    response = {"type": "getCurrentPlayer", "data": currentPlayer.id}
    return json.dumps(response)


def rest_get_charts():
    current_t = g.engine.data["current_t"]
    assets = g.engine.config[g.player.id]["assets"]
    timescale = "day"  # request.args.get('timescale')
    filename = f"instance/player_data/{g.player.username}/{timescale}.pck"
    with open(filename, "rb") as file:
        fileData = pickle.load(file)

    def combineFileDataAndEngineData(fileData, engineData):
        combinedDataUnsliced = fileData + engineData[1 : current_t + 1]
        return combinedDataUnsliced[0:259200]

    def industryDataFor(category, subcategory):
        return combineFileDataAndEngineData(
            fileData[category][subcategory],
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
                subcategory: industryDataFor(category, subcategory)
                for subcategory in subcategories[category]
            }
            for category in ["revenues", "generation"]
        },
    }
    return json.dumps(response)


## Alerts


# Send a string to be shown on the client
def rest_server_alert(alert):
    response = {"type": "sendServerAlert", "data": alert}
    return json.dumps(response)


def rest_server_alert_location_already_taken(byPlayer):
    alert = {"message": "locationAlreadyTaken", "byPlayer": byPlayer}
    return rest_server_alert(alert)


## Client Messages


# Message when client choses a location
def rest_confirm_location(engine, ws, data):
    cellId = data
    location = Hex.query.get(cellId)
    if location.player_id is not None:
        # Location already taken
        existing_player = Player.query.get(location.player_id)
        ws.send(rest_server_alert_location_already_taken(existing_player))
        return
    elif len(g.player.tile) != 0:
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


# Update player location
def rest_add_player_location(player):
    response = {
        "type": "updatePlayerLocation",
        "data": {"id": player.id, "tile": player.tile[0].id},
    }
    return json.dumps(response)


def rest_notify_player_location(engine, player):
    payload = rest_add_player_location(player)
    for _, wss in engine.websocket_dict.items():
        for ws in wss:
            ws.send(payload)
