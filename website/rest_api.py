from flask import Flask
from flask import Blueprint, g, current_app, jsonify
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash
from .database import Player

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

# gets the map data from the database and returns it as a array of dictionaries :
@rest_api.route("/rest_test", methods=["GET"])
def get_map():
    return jsonify("Success!")