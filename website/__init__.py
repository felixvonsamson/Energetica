"""This code is run once at the start of the game"""

# pylint: disable=wrong-import-order,wrong-import-position
# ruff: noqa: E402

import atexit
import base64
import cProfile
import csv
import glob
import json
import os
import pickle
import platform
import pstats
import secrets
import shutil
import socket
from datetime import datetime
from pathlib import Path

from gevent import monkey

monkey.patch_all(thread=True, time=True)

from ecdsa import NIST256p, SigningKey
from flask import Flask, jsonify, request, send_file
from flask_apscheduler import APScheduler
from flask_httpauth import HTTPBasicAuth
from flask_login import LoginManager, current_user
from flask_sock import Sock
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash

from website.simulate import simulate

db = SQLAlchemy()

import website.game_engine

from .database.player import Player


def get_or_create_flask_secret_key() -> str:
    """SECRET_KEY for Flask. Loads it from disk if it exists, creates one and stores it otherwise"""
    filepath = "instance/flask_secret_key.txt"
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    else:
        secret_key = secrets.token_hex()
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(secret_key)
        return secret_key


def get_or_create_vapid_keys() -> tuple[str, str]:
    """
    Public private key pair for vapid push notifications. Loads these from disk if they exists, creates a new pair and
    stores if otherwise
    """
    public_key_filepath = "instance/vapid_public_key.txt"
    private_key_filepath = "instance/vapid_private_key.txt"
    if os.path.exists(public_key_filepath) and os.path.exists(private_key_filepath):
        with open(public_key_filepath, "r", encoding="utf-8") as f:
            public_key = f.read().strip()
        with open(private_key_filepath, "r", encoding="utf-8") as f:
            private_key = f.read().strip()
        return public_key, private_key
    else:
        # Generate a new ECDSA key pair
        private_key_obj = SigningKey.generate(curve=NIST256p)
        public_key_obj = private_key_obj.get_verifying_key()

        # Encode the keys using URL- and filename-safe base64 without padding
        private_key = base64.urlsafe_b64encode(private_key_obj.to_string()).rstrip(b"=").decode("utf-8")
        public_key = base64.urlsafe_b64encode(b"\x04" + public_key_obj.to_string()).rstrip(b"=").decode("utf-8")

        # Write the keys to their respective files
        with open(public_key_filepath, "w", encoding="utf-8") as f:
            f.write(public_key)
        with open(private_key_filepath, "w", encoding="utf-8") as f:
            f.write(private_key)

        return public_key, private_key


def create_app(
    clock_time,
    in_game_seconds_per_tick,
    run_init_test_players,
    rm_instance,
    random_seed,
    simulate_file,
    simulate_log_every_k_ticks=10000,
    simulate_till=None,
    **kwargs,
):
    """This function sets up the app and the game engine"""
    # gets lock to avoid multiple instances
    if platform.system() == "Linux":
        lock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        lock.bind("\0energetica")

    # creates the app :
    app = Flask(__name__)
    Path("instance").mkdir(exist_ok=True)
    app.config["SECRET_KEY"] = get_or_create_flask_secret_key()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
    (app.config["VAPID_PUBLIC_KEY"], app.config["VAPID_PRIVATE_KEY"]) = get_or_create_vapid_keys()
    app.config["VAPID_CLAIMS"] = {"sub": "mailto:dgaf@gmail.com"}
    db.init_app(app)

    # creates the engine (and loading the save if it exists)
    engine = website.game_engine.GameEngine(clock_time, in_game_seconds_per_tick, random_seed)

    if rm_instance:
        engine.log("removing instance")
        shutil.rmtree("instance")

    from .utils.game_engine import data_init_climate

    Path("instance/player_data").mkdir(parents=True, exist_ok=True)
    if not os.path.isfile("instance/server_data/climate_data.pck"):
        Path("instance/server_data").mkdir(parents=True, exist_ok=True)
        with open("instance/server_data/climate_data.pck", "wb") as file:
            climate_data = data_init_climate(
                in_game_seconds_per_tick, engine.data["random_seed"], engine.data["delta_t"]
            )
            pickle.dump(climate_data, file)

    if not simulate_file:
        if os.path.isfile("instance/engine_data.pck"):
            with open("instance/engine_data.pck", "rb") as file:
                engine.data = pickle.load(file)
                engine.log("Loaded engine data from disk.")
    else:
        Path("checkpoints").mkdir(exist_ok=True)
        saves = {
            int(save.split("engine_data_")[1].rstrip(".pck")): save
            for save in glob.glob("checkpoints/engine_data_*.pck")
        }
        save_ids = [save_id for save_id in saves.keys() if simulate_till is None or save_id <= simulate_till]
        loaded_tick = None
        if save_ids:
            loaded_tick = max(save_ids)
            with open(f"checkpoints/engine_data_{loaded_tick}.pck", "rb") as file:
                engine.data = pickle.load(file)
                engine.log(f"Loaded file checkpoints/engine_data_{loaded_tick}.pck into engine.")

    app.config["engine"] = engine

    # initialize socketio :
    socketio = SocketIO(app, cors_allowed_origins="*")  # engineio_logger=True
    engine.socketio = socketio
    from .api.socketio_handlers import add_handlers

    add_handlers(socketio=socketio, engine=engine)

    # initialize sock for WebSockets:
    sock = Sock(app)
    engine.sock = sock
    from .api.websocket import add_sock_handlers

    add_sock_handlers(sock=sock, engine=engine)

    # add blueprints (website repositories) :
    from .api.http import http
    from .api.websocket import websocket_blueprint
    from .auth import auth
    from .views import changelog, overviews, views, wiki

    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(overviews, url_prefix="/production_overview")
    app.register_blueprint(wiki, url_prefix="/wiki")
    app.register_blueprint(changelog, url_prefix="/")
    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(http, url_prefix="/api/")
    app.register_blueprint(websocket_blueprint, url_prefix="/api/")

    @app.route("/subscribe", methods=["GET", "POST"])
    def subscribe():
        """
        POST creates a new subscription
        GET returns vapid public key
        """
        if request.method == "GET":
            return jsonify({"public_key": app.config["VAPID_PUBLIC_KEY"]})
        subscription = request.json
        if "endpoint" not in subscription:
            return jsonify({"response": "Invalid subscription"})
        engine.notification_subscriptions[current_user.id].append(subscription)
        return jsonify({"response": "Subscription successful"})

    @app.route("/unsubscribe", methods=["POST"])
    def unsubscribe():
        """
        POST removes a subscription
        """
        subscription = request.json
        if subscription in engine.notification_subscriptions[current_user.id]:
            engine.notification_subscriptions[current_user.id].remove(subscription)
        return jsonify({"response": "Unsubscription successful"})

    @app.route("/apple-app-site-association")
    def apple_app_site_association():
        """
        Returns the apple-app-site-association JSON data needed for supporting
        associated domains needed for shared webcredentials
        """
        return send_file("static/apple-app-site-association", as_attachment=True)

    from .database.map import Hex
    from .database.messages import Chat

    # initialize database :
    with app.app_context():
        db.create_all()
        # if map data not already stored in database, read map.csv and store it in database
        if Hex.query.count() == 0:
            with open("website/static/data/map.csv", "r") as file:
                csv_reader = csv.DictReader(file)
                for row in csv_reader:
                    hex = Hex(
                        q=row["q"],
                        r=row["r"],
                        solar=float(row["solar"]),
                        wind=float(row["wind"]),
                        hydro=float(row["hydro"]),
                        coal=float(row["coal"]),
                        gas=float(row["gas"]),
                        uranium=float(row["uranium"]),
                        climate_risk=float(row["climate_risk"]),
                    )
                    db.session.add(hex)

        # creating general chat
        if Chat.query.count() == 0:
            new_chat = Chat(
                name="General Chat",
                participants=[],
            )
            db.session.add(new_chat)

        db.session.commit()

    # initialize login manager
    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        player = Player.query.get(int(id))
        return player

    # initialize HTTP basic auth
    engine.auth = HTTPBasicAuth()

    @engine.auth.verify_password
    def verify_password(username, password):
        player = Player.query.filter_by(username=username).first()
        if player and check_password_hash(player.pwhash, password):
            return player

    # initialize the schedulers and add the recurrent functions :
    # This function is to run the following only once, TO REMOVE IF DEBUG MODE IS SET TO FALSE
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        from .utils.game_engine import state_update

        scheduler = APScheduler()
        scheduler.init_app(app)

        if not simulate_file:
            scheduler.add_job(
                func=state_update,
                args=(engine, app),
                id="state_update",
                trigger="cron",
                second=f"*/{clock_time}" if clock_time != 60 else "0",
                misfire_grace_time=10,
            )
        else:
            with open(simulate_file.name, "r", encoding="utf-8") as file:
                actions = json.loads("[" + ", ".join(file.read().split("\n")[:-1]) + "]")
            action_id_by_tick = {
                action["total_t"]: action_id
                for action_id, action in enumerate(actions)
                if action["endpoint"] == "update_electricity"
            }
            start_action_id = action_id_by_tick[loaded_tick] + 1 if loaded_tick else 0
            last_action_id = action_id_by_tick[simulate_till] if loaded_tick else len(actions) - 1
            scheduler.add_job(
                func=simulate,
                args=(
                    app,
                    kwargs["port"],
                    actions[start_action_id : last_action_id + 1],
                    simulate_log_every_k_ticks,
                    simulate_till,
                ),
                id="simulate",
                trigger="date",
                run_date=datetime.now(),
            )

        scheduler.start()
        atexit.register(lambda: scheduler.shutdown())

        if run_init_test_players:
            engine.log("running init_test_players")
            with app.app_context():
                # Temporary automated player creation for testing
                from .init_test_players import init_test_players

                init_test_players(engine)
    return socketio, sock, app
