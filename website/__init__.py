"""
This code is run once at the start of the game
"""

import eventlet
eventlet.monkey_patch(thread=True, time=True)
from flask import Flask, g, jsonify
from flask_sqlalchemy import SQLAlchemy
import os, csv
import pickle
from pathlib import Path
from flask_login import LoginManager
from flask_socketio import SocketIO
from flask_sock import Sock
import atexit
from flask_apscheduler import APScheduler

db = SQLAlchemy()

from website.gameEngine import gameEngine


def create_app():
    # creates the player production repository if it doese not exist :
    Path("instance/player_prod").mkdir(parents=True, exist_ok=True)

    # creates the app :
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "ghdäwrjeojfjdcfgglkgvou"
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///database.db"
    db.init_app(app)

    # creates the engine :
    engine = gameEngine()
    if os.path.isfile("instance/engine_data.pck"):
        with open("instance/engine_data.pck", "rb") as file:
            engine.data = pickle.load(file)
            print("loaded engine data")
    app.config["engine"] = engine

    # initialize socketio :
    socketio = SocketIO(app, cors_allowed_origins="*")
    engine.socketio = socketio
    from .socketio_handlers import add_handlers
    add_handlers(socketio=socketio, engine=engine)

    # initialize sock for WebSockets:
    sock = Sock(app)
    engine.sock = sock
    engine.websocket_dict = {}
    from .rest_api import add_sock_handlers
    add_sock_handlers(sock=sock, engine=engine)

    # add blueprints (website repositories) :
    from .views import views, overviews
    from .auth import auth
    from .api import api
    from .rest_api import rest_api
    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(overviews, url_prefix="/production_overview")
    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(api, url_prefix="/")
    app.register_blueprint(rest_api, url_prefix="/")

    from .database import Hex, Under_construction, Shipment, Resource_on_sale, Network, Player, Chat, Message
    
    # initialize database :
    with app.app_context():
        db.create_all()
        print("database created")
        # if map data not already stored in database, read map.csv and store it in database
        if Hex.query.count() == 0:
            with open("website/static/data/map.csv", "r") as file:
                csv_reader = csv.DictReader(file)
                for row in csv_reader:
                    hex = Hex(
                        q=row["q"],
                        r=row["r"],
                        solar=row["solar"],
                        wind=row["wind"],
                        hydro=row["hydro"],
                        coal=row["coal"],
                        oil=row["oil"],
                        gas=row["gas"],
                        uranium=row["uranium"],
                    )
                    db.session.add(hex)
                db.session.commit()

    # initialize login manager ???
    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        player = Player.query.get(int(id))
        return player

    # initialize the schedulers and add the recurrent functions :
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true": # This function is to run the following omly once, TO REMOVE IF DEBUG MODE IS SET TO FALSE 
        from .gameEngine import state_update_h, state_update_m
        from .gameEngine import check_upcoming_actions

        scheduler = APScheduler()
        engine.log("adding jobs")
        scheduler.init_app(app)
        scheduler.add_job(
            func=state_update_h,
            args=(engine, app),
            id="state_update_h",
            trigger="cron",
            minute="0",
        )
        scheduler.add_job(
            func=state_update_m,
            args=(engine, app),
            id="state_update_m",
            trigger="cron",
            second="0", # "*/5" or "0"
        )
        scheduler.add_job(
            func=check_upcoming_actions,
            args=[app],
            id="check_upcoming_actions",
            trigger="interval",
            seconds=1,
        )
        scheduler.start()
        atexit.register(lambda: scheduler.shutdown())

        #with app.app_context():
            #Temporary automated player creation for testing
            #from .init_test_players import edit_database, init_test_players
            #edit_database(engine)
            #init_test_players(engine)

    return socketio, sock, app
