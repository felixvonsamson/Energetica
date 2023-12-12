from flask import Blueprint, g, current_app
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import check_password_hash
from .database import Player

rest_api = Blueprint('rest_api', __name__)

def add_sock_handlers(sock, engine):
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
        g.player = Player.query.filter_by(username=basic_auth.current_user()).first()

    @basic_auth.verify_password
    def verify_password(username, password):
        player = Player.query.filter_by(username=username).first()
        if player:
            if check_password_hash(player.password, password):
                print(f"{username} logged in via HTTP Basic")
                return username
            else:
                print(f"{username} failed to log in via HTTP Basic")

    # Main WebSocket endpoint for Swift client
    @sock.route("/rest_ws", bp = rest_api)
    def rest_ws(ws):
        print(f"Received WS connection from {g.player}")
        # print(f"Received WS connection from ???")
        ws.send("Hello there!")
        while True:
            data = ws.receive()
            print(f"received on websocket: data = {data}")
            ws.send(data)
    
    # # gets the map data from the database and returns it as a dictionary of arrays
    # @rest_api.route("/rest_get_map", methods=["GET"])
    # def rest_get_map():
    #     hex_list = Hex.query.order_by(Hex.r, Hex.q).all()
    #     response = {
    #         "ids": [tile.id for tile in hex_list],
    #         "solars": [tile.solar for tile in hex_list],
    #         "winds": [tile.wind for tile in hex_list],
    #         "hydros": [tile.hydro for tile in hex_list],
    #         "coals": [tile.coal for tile in hex_list],
    #         "oils": [tile.oil for tile in hex_list],
    #         "gases": [tile.gas for tile in hex_list],
    #         "uraniums": [tile.uranium for tile in hex_list]
    #     }
    #     return jsonify(response)
