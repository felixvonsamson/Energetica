"""
These functions make the link between the website and the database
"""

from flask import Blueprint, request, flash, jsonify, session, g, current_app
from flask_login import login_required, current_user

api = Blueprint('api', __name__)

from .database import Hex

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

