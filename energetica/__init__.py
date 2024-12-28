"""Initializes the app and the game engine."""

# pylint: disable=wrong-import-order,wrong-import-position
# ruff: noqa: E402

import atexit
import base64
import csv
import glob
import json
import os
import pickle
import platform
import secrets
import shutil
import socket
import tarfile
from datetime import datetime
from pathlib import Path

from gevent import monkey

monkey.patch_all(thread=True, time=True)

from ecdsa import NIST256p, SigningKey
from flask import Flask, jsonify, request, send_file
from flask_apscheduler import APScheduler
from flask_login import LoginManager, current_user
from flask_sock import Sock
from flask_socketio import SocketIO

from energetica.api.http import http
from energetica.api.socketio_handlers import add_handlers
from energetica.api.websocket import add_sock_handlers, websocket_blueprint
from energetica.auth import auth
from energetica.database.map import HexTile
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.game_engine import GameEngine
from energetica.init_test_players import init_test_players
from energetica.simulate import simulate
from energetica.utils.climate_helpers import data_init_climate
from energetica.utils.tick_execution import state_update
from energetica.views import changelog, landing, location_choice_views, overviews, views, wiki

engine = GameEngine()


def get_or_create_flask_secret_key() -> str:
    """Load or create SECRET_KEY for Flask."""
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
    """Load or create VAPID key pair for push notifications."""
    public_key_filepath = "instance/vapid_public_key.txt"
    private_key_filepath = "instance/vapid_private_key.txt"
    if Path(public_key_filepath).exists() and Path(private_key_filepath).exists():
        public_key = Path(public_key_filepath).read_text(encoding="utf-8").strip()
        private_key = Path(private_key_filepath).read_text(encoding="utf-8").strip()
        return public_key, private_key
    # Generate a new ECDSA key pair
    private_key_obj = SigningKey.generate(curve=NIST256p)
    public_key_obj = private_key_obj.get_verifying_key()

    # Encode the keys using URL- and filename-safe base64 without padding
    private_key = base64.urlsafe_b64encode(private_key_obj.to_string()).rstrip(b"=").decode("utf-8")
    public_key = base64.urlsafe_b64encode(b"\x04" + public_key_obj.to_string()).rstrip(b"=").decode("utf-8")

    # Write the keys to their respective files
    Path(public_key_filepath).write_text(public_key, encoding="utf-8")
    Path(private_key_filepath).write_text(private_key, encoding="utf-8")

    return public_key, private_key


def create_app(
    clock_time=30,
    in_game_seconds_per_tick=240,
    run_init_test_players=False,
    rm_instance=False,
    random_seed=42,
    simulate_file=None,
    simulate_stop_on_mismatch=False,
    simulate_stop_on_server_error=False,
    simulate_stop_on_assertion_error=False,
    simulate_checkpoint_every_k_ticks=10000,
    simulate_checkpoint_ticks=[],
    simulate_till=None,
    simulate_profiling=False,
    skip_adding_handlers=False,
    **kwargs,
):
    """Set up the app and the game engine."""
    # gets lock to avoid multiple instances
    if platform.system() == "Linux":
        lock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        lock.bind("\0energetica")

    # Delete last checkpoint
    if rm_instance:
        if not simulate_file:
            if os.path.exists("checkpoints/last_checkpoint.tar.gz"):
                os.remove("checkpoints/last_checkpoint.tar.gz")
                print("checkpoints/last_checkpoint.tar.gz deleted.")
        else:
            print("--rm_instance ignored.")

    # Delete instance folder
    if os.path.exists("instance"):
        shutil.rmtree("instance")
        print("instance folder deleted.")

    # Create instance and checkpoints folder if they don't exist
    Path("checkpoints").mkdir(exist_ok=True)
    Path("instance").mkdir(exist_ok=True)

    start_date = None
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" and simulate_file:
        Path("checkpoints/simulation").mkdir(exist_ok=True)
        with simulate_file as file:
            actions = [json.loads(line) for line in file]
        assert actions[0]["action_type"] == "init_engine"
        clock_time = actions[0]["clock_time"]
        in_game_seconds_per_tick = actions[0]["in_game_seconds_per_tick"]
        random_seed = actions[0]["random_seed"]
        start_date = datetime.fromisoformat(actions[0]["start_date"])

        checkpoints = {
            int(save.split("checkpoint_")[1].rstrip(".tar.gz")): save
            for save in glob.glob("checkpoints/simulation/checkpoint_*.tar.gz")
        }
        checkpoints_ids = [
            save_id for save_id in checkpoints.keys() if simulate_till is None or save_id <= simulate_till
        ]
        loaded_tick = None
        if checkpoints_ids:
            loaded_tick = max(checkpoints_ids)
        action_id_by_tick = {
            action["total_t"]: action_id for action_id, action in enumerate(actions) if action["action_type"] == "tick"
        }
        start_action_id = action_id_by_tick[loaded_tick] + 1 if loaded_tick else 1
        last_action_id = action_id_by_tick[simulate_till] if simulate_till else len(actions) - 1

    # creates the engine (and loading the save if it exists)
    engine = GameEngine(clock_time, in_game_seconds_per_tick, random_seed, start_date)

    Path("instance/player_data").mkdir(parents=True, exist_ok=True)
    if not os.path.isfile("instance/server_data/climate_data.pck"):
        Path("instance/server_data").mkdir(parents=True, exist_ok=True)
        with open("instance/server_data/climate_data.pck", "wb") as file:
            climate_data = data_init_climate(
                in_game_seconds_per_tick, engine.data["random_seed"], engine.data["delta_t"]
            )
            pickle.dump(climate_data, file)

    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        if not simulate_file:
            if os.path.isfile("checkpoints/last_checkpoint.tar.gz"):
                with tarfile.open("checkpoints/last_checkpoint.tar.gz") as file:
                    file.extractall("./")
                engine.log("Loaded last checkpoint from disk.")
        else:
            if loaded_tick:
                with tarfile.open(f"checkpoints/simulation/checkpoint_{loaded_tick}.tar.gz") as file:
                    file.extractall("./")
                engine.log(f"Loaded checkpoints/simulation/checkpoint_{loaded_tick}.tar.gz from disk.")

        if os.path.isfile("instance/engine_data.pck"):
            with open("instance/engine_data.pck", "rb") as file:
                engine.data = pickle.load(file)
            engine.log("Loaded engine data from disk.")

    # creates the app :
    app = Flask(__name__)
    app.config["SECRET_KEY"] = get_or_create_flask_secret_key()
    app.config["VAPID_PUBLIC_KEY"], app.config["VAPID_PRIVATE_KEY"] = get_or_create_vapid_keys()
    app.config["VAPID_CLAIMS"] = {"sub": "mailto:dgaf@gmail.com"}
    app.config["engine"] = engine

    # initialize socketio :
    socketio = SocketIO(app, cors_allowed_origins="*")  # engineio_logger=True
    engine.socketio = socketio

    if not skip_adding_handlers:
        add_handlers(socketio=socketio, engine=engine)

    # initialize sock for WebSockets:
    sock = Sock(app)
    engine.sock = sock

    if not skip_adding_handlers:
        add_sock_handlers(sock=sock, engine=engine)

    # add blueprints (website repositories) :
    app.register_blueprint(location_choice_views, url_prefix="/")
    app.register_blueprint(landing, url_prefix="/")
    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(overviews, url_prefix="/production_overview")
    app.register_blueprint(wiki, url_prefix="/wiki")
    app.register_blueprint(changelog, url_prefix="/")
    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(http, url_prefix="/api/")
    app.register_blueprint(websocket_blueprint, url_prefix="/api/")

    @app.route("/subscribe", methods=["GET", "POST"])
    def subscribe():
        """POST: Create a new subscription. GET: Return VAPID public key."""
        if request.method == "GET":
            return jsonify({"public_key": app.config["VAPID_PUBLIC_KEY"]})
        subscription = request.json
        if "endpoint" not in subscription:
            return jsonify({"response": "Invalid subscription"})
        current_user.notification_subscriptions.append(subscription)
        return jsonify({"response": "Subscription successful"})

    @app.route("/unsubscribe", methods=["POST"])
    def unsubscribe():
        """POST: remove a subscription."""
        subscription = request.json
        if subscription in current_user.notification_subscriptions:
            current_user.notification_subscriptions.remove(subscription)
        return jsonify({"response": "Unsubscription successful"})

    @app.route("/apple-app-site-association")
    def apple_app_site_association():
        """Return the apple-app-site-association JSON data.

        Needed for supporting associated domains needed for shared webcredentials
        """
        return send_file("static/apple-app-site-association", as_attachment=True)

    # if map data not already stored in database, read map.csv and store it in database
    if HexTile.count() == 0:
        with open("energetica/static/data/map.csv", "r", encoding="utf-8") as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                HexTile(
                    coordinates=(row["q"], row["r"]),
                    solar_potential=float(row["solar"]),
                    wind_potential=float(row["wind"]),
                    hydro_potential=float(row["hydro"]),
                    coal_reserves=float(row["coal"]),
                    gas_reserves=float(row["gas"]),
                    uranium_reserves=float(row["uranium"]),
                    climate_risk=float(row["climate_risk"]),
                )

    # creating general chat
    if Chat.count() == 0:
        Chat(
            name="General Chat",
            participants=[],
        )

    # initialize login manager
    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id) -> Player:
        return Player.get(int(id))

    # initialize the schedulers and add the recurrent functions :
    # This function is to run the following only once, TO REMOVE IF DEBUG MODE IS SET TO FALSE
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler = APScheduler()
        scheduler.init_app(app)

        if not simulate_file:
            scheduler.add_job(
                func=state_update,
                args=(app),
                id="state_update",
                trigger="cron",
                second=f"*/{clock_time}" if clock_time != 60 else "0",
                misfire_grace_time=10,
            )
        else:
            scheduler.add_job(
                func=simulate,
                args=(
                    app,
                    kwargs["port"],
                    actions[start_action_id : last_action_id + 1],
                    simulate_stop_on_mismatch,
                    simulate_stop_on_server_error,
                    simulate_stop_on_assertion_error,
                    simulate_checkpoint_every_k_ticks,
                    simulate_checkpoint_ticks,
                ),
                kwargs={"profiling": simulate_profiling},
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
                init_test_players()

    return socketio, app
