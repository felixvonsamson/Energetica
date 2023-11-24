"""
These functions make the link between the website and the database
"""

from flask import Blueprint, request, flash, jsonify, g, current_app
from flask_login import login_required, current_user
import pickle
from pathlib import Path
import numpy as np

api = Blueprint('api', __name__)

from .database import Hex, Player, Chat, Network

# gets the map data from the database and returns it as a array of dictionaries :
@api.route("/get_map", methods=["GET"])
def get_map():
    hex_map = Hex.query.all()
    hex_list = [
        {
            "id": tile.id,
            "q": tile.q,
            "r": tile.r,
            "solar": tile.solar,
            "wind": tile.wind,
            "hydro": tile.hydro,
            "coal": tile.coal,
            "oil": tile.oil,
            "gas": tile.gas,
            "uranium": tile.uranium,
            "player": tile.player.username if tile.player else None,
        }
        for tile in hex_map
    ]
    return jsonify(hex_list)

# gets all the player usernames (except it's own) and returns it as a list :
@api.route("/get_usernames", methods=["GET"])
def get_usernames():
    username_list = Player.query.with_entities(Player.username).all()
    username_list = [username[0] for username in username_list 
    if username[0]!=current_user.username]
    return jsonify(username_list)

# gets all the network names and returns it as a list :
@api.route("/get_networks", methods=["GET"])
def get_networks():
    network_list = Network.query.with_entities(Network.name).all()
    network_list = [name[0] for name in network_list]
    return jsonify(network_list)

# gets the last 20 messages from a chat and returns it as a list :
@api.route("/get_chat", methods=["GET"])
def get_chat():
    chat_id = request.args.get('chatID')
    messages = Chat.query.filter_by(id=chat_id).first().messages
    messages_list = [(msg.player.username, msg.text) for msg in messages]
    return jsonify(messages_list)

@api.route("/get_chart_data", methods=["GET"])
def get_chart_data():
    engine = current_app.config["engine"]
    assets = engine.config[current_user.id]["assets"]
    timescale = request.args.get('timescale')
    table = request.args.get('table')
    filename = f"instance/player_data/{current_user.username}/{timescale}.pck"
    with open(filename, "rb") as file:
        data = pickle.load(file)
    if table == "generation" or table == "storage" or table == "ressources":
        capacities = {}
        if table == "generation":
            for facility in ["watermill", "small_water_dam", "large_water_dam", 
                            "nuclear_reactor", "nuclear_reactor_gen4",  
                            "steam_engine", "coal_burner", "oil_burner", 
                            "gas_burner", "combined_cycle", "windmill", 
                            "onshore_wind_turbine", "offshore_wind_turbine", "CSP_solar",
                            "PV_solar"]:
                capacities[facility] = (getattr(current_user, facility) * 
                        assets[facility]["power generation"])
        elif table == "storage":
            for facility in ["small_pumped_hydro", "large_pumped_hydro", 
                             "lithium_ion_batteries", "solid_state_batteries", 
                             "compressed_air", "molten_salt", 
                             "hydrogen_storage"]:
                capacities[facility] = (getattr(current_user, facility) * 
                        assets[facility]["storage capacity"])
        else:
            rates = {}
            on_sale = {}
            resource_to_facility = {
                "coal" : "coal_mine",
                "oil" : "oil_field",
                "gas" : "gas_drilling_site",
                "uranium" : "uranium_mine"
            }
            for ressource in ["coal", "oil", "gas", "uranium"]:
                capacities[ressource] = engine.config[current_user.id][
                    "warehouse_capacities"][ressource]
                facility = resource_to_facility[ressource]
                rates[ressource] = getattr(current_user, facility) * assets[
                    facility]["amount produced"] * 60
                on_sale[ressource] = getattr(current_user, ressource+"_on_sale")
            return jsonify(engine.data["current_t"], data[table],
                       engine.data["current_data"][current_user.username][table],
                       capacities, rates, on_sale)
        return jsonify(engine.data["current_t"], data[table],
                       engine.data["current_data"][current_user.username][table],
                       capacities)
    else:
        return jsonify(engine.data["current_t"], data[table],
                       engine.data["current_data"][current_user.username][table])
    
@api.route("/get_market_data", methods=["GET"])
def get_market_data():
    market_data = {}
    engine = current_app.config["engine"]
    if current_user.network == None:
        return '', 404
    t = int(request.args.get('t'))
    filename_state = f"instance/network_data/{current_user.network.name}/charts/market_t{engine.data['total_t']-t}.pck"
    if Path(filename_state).is_file():
        with open(filename_state, "rb") as file:
            market_data = pickle.load(file)
            market_data["capacities"] = market_data["capacities"].to_dict(orient='list')
            market_data["capacities"]["player"] = [player.username for player in market_data["capacities"]["player"]]
            market_data["demands"] = market_data["demands"].to_dict(orient='list')
            market_data["demands"]["player"] = [player.username for player in market_data["demands"]["player"]]
            market_data["demands"]["price"] = [None if price == np.inf else price for price in market_data["demands"]["price"]]
    else:
        market_data = None
    timescale = request.args.get('timescale')
    filename_prices = f"instance/network_data/{current_user.network.name}/prices/{timescale}.pck"
    with open(filename_prices, "rb") as file:
        prices = pickle.load(file)
    return jsonify(engine.data["current_t"], market_data, prices, engine.data["network_data"][current_user.network.name])
