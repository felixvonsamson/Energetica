from flask import Flask
from flask import Blueprint, g, current_app, jsonify
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash
from .database import Player, Hex

rest_api = Blueprint('rest_api', __name__)

basic_auth = HTTPBasicAuth()

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

# Simply returns success, used on client-side to check auth before proceeding
@rest_api.route("/rest_auth", methods=["GET"])
def get_map():
    return jsonify("Success")

# gets the map data from the database and returns it as a dictionary of arrays
@rest_api.route("/rest_get_map", methods=["GET"])
def rest_get_map():
    hex_list = Hex.query.order_by(Hex.r, Hex.q).all()
    response = {
        "ids": [tile.id for tile in hex_list],
        "qs": [tile.q for tile in hex_list],
        "rs": [tile.r for tile in hex_list],
        "solars": [tile.solar for tile in hex_list],
        "winds": [tile.wind for tile in hex_list],
        "hydros": [tile.hydro for tile in hex_list],
        "coals": [tile.coal for tile in hex_list],
        "oils": [tile.oil for tile in hex_list],
        "gases": [tile.gas for tile in hex_list],
        "uraniums": [tile.uranium for tile in hex_list]
    }
    return jsonify(response)
