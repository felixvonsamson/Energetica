"""This code is run once at the start of the game"""

import platform
import socket

import eventlet

eventlet.monkey_patch(thread=True, time=True)

import atexit  # noqa: E402
import csv  # noqa: E402
import os  # noqa: E402
import pickle  # noqa: E402
import shutil  # noqa: E402
from pathlib import Path  # noqa: E402

from flask import Flask, jsonify, request, send_file  # noqa: E402
from flask_apscheduler import APScheduler  # noqa: E402
from flask_httpauth import HTTPBasicAuth  # noqa: E402
from flask_login import LoginManager, current_user  # noqa: E402
from flask_sock import Sock  # noqa: E402
from flask_socketio import SocketIO  # noqa: E402
from flask_sqlalchemy import SQLAlchemy  # noqa: E402
from werkzeug.security import check_password_hash

db = SQLAlchemy()

from website.Game_engine import Game_engine  # noqa: E402

from .database.player import Player  # noqa: E402


def create_app(clock_time, in_game_seconds_per_tick, run_init_test_players, rm_instance):
    """This function sets up the app and the game engine"""
    # gets lock to avoid multiple instances
    if platform.system() == "Linux":
        lock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        lock.bind("\0energetica")

    # creates the app :
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "psdfjfdf7ehsfdxxnvezartylfzutzngpssdw98w23"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
    app.config["VAPID_PUBLIC_KEY"] = open("public_key.txt", "r+").readline().strip("\n")
    app.config["VAPID_PRIVATE_KEY"] = open("private_key.txt", "r+").readline().strip("\n")
    app.config["VAPID_CLAIMS"] = {"sub": "mailto:felixvonsamson@gmail.com"}
    db.init_app(app)

    # creates the engine (and loading the save if it exists)
    engine = Game_engine(clock_time, in_game_seconds_per_tick)

    if rm_instance:
        engine.log("removing instance")
        shutil.rmtree("instance")

    Path("instance/player_data").mkdir(parents=True, exist_ok=True)
    if os.path.isfile("instance/engine_data.pck"):
        with open("instance/engine_data.pck", "rb") as file:
            engine.data = pickle.load(file)
            engine.log("Loaded engine data from disk.")
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
    from .views import overviews, views

    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(overviews, url_prefix="/production_overview")
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
        print(subscription)
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
                        coal=float(row["coal"]) * engine.clock_time / 60,
                        oil=float(row["oil"]) * engine.clock_time / 60,
                        gas=float(row["gas"]) * engine.clock_time / 60,
                        uranium=float(row["uranium"]) * engine.clock_time / 60,
                    )
                    db.session.add(hex)
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
        if player:
            if check_password_hash(player.pwhash, password):
                return player

    # initialize the schedulers and add the recurrent functions :
    # This function is to run the following only once, TO REMOVE IF DEBUG MODE IS SET TO FALSE
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        from .Game_engine import state_update

        scheduler = APScheduler()
        scheduler.init_app(app)

        scheduler.add_job(
            func=state_update,
            args=(engine, app),
            id="state_update",
            trigger="cron",
            second=f"*/{clock_time}" if clock_time != 60 else "0",
            misfire_grace_time=10,
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
