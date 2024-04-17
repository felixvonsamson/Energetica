"""
This code is run once at the start of the game
"""

import eventlet

eventlet.monkey_patch(thread=True, time=True)

from flask import Flask  # noqa: E402
from flask_sqlalchemy import SQLAlchemy  # noqa: E402
import os  # noqa: E402
import csv  # noqa: E402
import pickle  # noqa: E402
from flask_login import LoginManager  # noqa: E402
from flask_socketio import SocketIO  # noqa: E402
from flask_sock import Sock  # noqa: E402
import atexit  # noqa: E402
from flask_apscheduler import APScheduler  # noqa: E402
from pathlib import Path  # noqa: E402
import shutil  # noqa: E402

db = SQLAlchemy()

from .database.player import Player  # noqa: E402
from website.gameEngine import gameEngine  # noqa: E402


def create_app(clock_time, run_init_test_players, rm_instance, repair_database):
    # creates the app :
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "ksdfzrtbf6clkIzhfdsuihsf98ERf"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
    db.init_app(app)

    # creates the engine (ad loading the sava if it exists)
    engine = gameEngine(clock_time)

    if rm_instance:
        engine.log("removing instance")
        shutil.rmtree("instance")

    Path("instance/player_data").mkdir(parents=True, exist_ok=True)
    if os.path.isfile("instance/engine_data.pck"):
        with open("instance/engine_data.pck", "rb") as file:
            engine.data = pickle.load(file)
            engine.log("loaded engine data from disk")
    app.config["engine"] = engine

    # initialize socketio :
    socketio = SocketIO(app, cors_allowed_origins="*")  # engineio_logger=True
    engine.socketio = socketio
    from .api.socketio_handlers import add_handlers

    add_handlers(socketio=socketio, engine=engine)

    # initialize sock for WebSockets:
    sock = Sock(app)
    engine.sock = sock
    from .api.ws import add_sock_handlers

    add_sock_handlers(sock=sock, engine=engine)

    # add blueprints (website repositories) :
    from .views import views, overviews
    from .auth import auth
    from .api.http import http
    from .api.ws import ws

    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(overviews, url_prefix="/production_overview")
    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(http, url_prefix="/")
    app.register_blueprint(ws, url_prefix="/")

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

    # initialize login manager
    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        player = Player.query.get(int(id))
        return player

    # initialize the schedulers and add the recurrent functions :
    if (
        os.environ.get("WERKZEUG_RUN_MAIN") == "true"
    ):  # This function is to run the following only once, TO REMOVE IF DEBUG MODE IS SET TO FALSE
        from .gameEngine import state_update

        scheduler = APScheduler()
        scheduler.init_app(app)

        scheduler.add_job(
            func=state_update,
            args=(engine, app),
            id="state_update",
            trigger="cron",
            second=f"*/{clock_time}" if clock_time != 60 else "0",
        )
        scheduler.start()
        atexit.register(lambda: scheduler.shutdown())

        from .utils import check_construction_parity

        with app.app_context():
            check_construction_parity()

        if repair_database:
            from .database.player_assets import Under_construction

            with app.app_context():
                players = Player.query.all()
                for player in players:
                    construction_list = player.read_list(
                        "construction_priorities"
                    )
                    research_priorities = player.read_list(
                        "research_priorities"
                    )
                    for contruction_id in construction_list:
                        const = Under_construction.query.get(contruction_id)
                        if const is None:
                            player.remove_from_list(
                                "construction_priorities", contruction_id
                            )
                            print(
                                f"removed construction {contruction_id} from construction priorities ({player.username})"
                            )
                    for contruction_id in research_priorities:
                        const = Under_construction.query.get(contruction_id)
                        if const is None:
                            player.remove_from_list(
                                "research_priorities", contruction_id
                            )
                            print(
                                f"removed construction {contruction_id} from research priorities ({player.username})"
                            )
                constructions = Under_construction.query.all()
                for construction in constructions:
                    found = False
                    for player in players:
                        construction_list = player.read_list(
                            "construction_priorities"
                        )
                        research_priorities = player.read_list(
                            "research_priorities"
                        )
                        if (
                            construction.id
                            not in construction_list + research_priorities
                        ):
                            found = True
                            break
                    if not found:
                        db.session.delete(construction)
                        print(
                            f"removed construction {construction.name} from Under_construction ({player.username})"
                        )
                db.session.commit()

        if run_init_test_players:
            engine.log("running init_test_players")
            with app.app_context():
                # Temporary automated player creation for testing
                from .init_test_players import init_test_players

                # edit_database(engine)
                init_test_players(engine)

    return socketio, sock, app
