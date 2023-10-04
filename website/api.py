"""
These functions make the link between the website and the database
"""

from flask import Blueprint, request, flash, jsonify, session, g, current_app
from flask_login import login_required, current_user
import pickle

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
            "player_id": tile.player_id,
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
                            "shallow_geothermal_plant", "deep_geothermal_plant", 
                            "steam_engine", "coal_burner", "oil_burner", 
                            "gas_burner", "combined_cycle", "windmill", 
                            "wind_turbine", "large_wind_turbine", "CSP_solar",
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
            rates["coal"] = current_user.coal_mine * assets["coal_mine"][
                "amount produced"] * 60
            rates["oil"] = current_user.coal_mine * assets["oil_field"][
                "amount produced"] * 60
            rates["gas"] = current_user.coal_mine * assets["gas_drilling_site"][
                "amount produced"] * 60
            rates["uranium"] = current_user.coal_mine * assets["uranium_mine"][
                "amount produced"] * 60
            for ressource in ["coal", "oil", "gas", "uranium"]:
                capacities[ressource] = engine.config[current_user.id][
                    "warehouse_capacities"][ressource]
            capacities["uranium"] = 15000
            return jsonify(engine.current_t, data[table],
                       engine.current_data[current_user.username][table],
                       capacities, rates)
            
        return jsonify(engine.current_t, data[table],
                       engine.current_data[current_user.username][table],
                       capacities)
    else:
        return jsonify(engine.current_t, data[table],
                       engine.current_data[current_user.username][table])