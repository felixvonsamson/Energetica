"""
This code is run once at the start of the game
"""

from flask import Flask, g, session, jsonify
from flask_sqlalchemy import SQLAlchemy
import os, csv
from pathlib import Path
from flask_login import LoginManager
from flask_socketio import SocketIO
import atexit
from flask_apscheduler import APScheduler

# Database initialisation :
db = SQLAlchemy()
DB_NAME = "database.db"

heap = []

from website.gameEngine import gameEngine


def create_app():
    # creates the player production repository if it doese not exist :
    Path("instance/player_prod").mkdir(parents=True, exist_ok=True)

    # creates the app :
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "ghdfjfetgftqayööhkh"
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_NAME}"
    db.init_app(app)

    # creates the engine :
    engine = gameEngine()
    app.config["engine"] = engine

    # initialize socketio :
    socketio = SocketIO(app)
    engine.socketio = socketio
    from .socketio_handlers import add_handlers
    add_handlers(socketio=socketio, engine=engine)

    # add blueprints (website repositories) :
    from .views import views
    from .auth import auth
    from .api import api
    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(api, url_prefix="/")

    from .database import Player, Hex, Chat, Message, Under_construction
    
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
        if player != None:
            player.engine = engine
        return player

    # initialize the schedulers and add the recurrent functions :
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true": # This function is to run the following omly once, TO REMOVE IF DEBUG MODE IS SET TO FALSE 
        from .gameEngine import daily_update, state_update_h, state_update_m
        from .gameEngine import check_heap

        scheduler = APScheduler()
        engine.log("adding jobs")
        scheduler.init_app(app)
        scheduler.add_job(
            func=daily_update,
            args=(engine, app),
            id="daily_update",
            trigger="cron",
            day=1,
        )
        scheduler.add_job(
            func=state_update_h,
            args=(engine, app),
            id="state_update_h",
            trigger="interval",
            seconds=3600,
        )
        scheduler.add_job(
            func=state_update_m,
            args=(engine, app),
            id="state_update_m",
            trigger="interval",
            seconds=60,
        )
        scheduler.add_job(
            func=check_heap,
            args=(engine, app),
            id="check_heap",
            trigger="interval",
            seconds=1,
        )
        scheduler.start()
        atexit.register(lambda: scheduler.shutdown())

    return socketio, app