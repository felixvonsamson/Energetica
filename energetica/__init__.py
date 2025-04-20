"""Initializes the app and the game engine."""

# pylint: disable=wrong-import-order,wrong-import-position
# ruff: noqa: E402

__version__ = "0.11.1-b"
__release_date__ = "03/02/2025"

import atexit
import base64
import glob
import json
import logging
import os
import platform
import secrets
import shutil
import socket
import tarfile
import uuid
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import Any

from flask import Flask
from flask_login import LoginManager
from gevent import monkey

monkey.patch_all(thread=True, time=True)

from apscheduler.events import EVENT_JOB_EXECUTED
from ecdsa import NIST256p, SigningKey
from flask_apscheduler import APScheduler
from flask_sock import Sock
from flask_socketio import SocketIO

from energetica import globals
from energetica.game_engine import GameEngine

engine = GameEngine()
globals.engine = engine

from energetica.api.app_services import register_app_services
from energetica.api.http import http
from energetica.api.socketio_handlers import add_handlers
from energetica.api.websocket import add_sock_handlers  # type: ignore

# from energetica.api.websocket import websocket_blueprint
from energetica.auth import auth
from energetica.database.player import Player
from energetica.init_test_players import init_test_players
from energetica.simulate import simulate
from energetica.utils.tick_execution import state_update
from energetica.views import changelog, landing, location_choice_views, overviews, views, wiki


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
    port: int = 5001,
    clock_time: int = 30,
    in_game_seconds_per_tick: int = 240,
    run_init_test_players: bool = False,
    rm_instance: bool = False,
    load_checkpoint: bool = False,
    random_seed: int = 42,
    simulate_file: Any | None = None,
    simulate_stop_on_mismatch: bool = False,
    simulate_stop_on_server_error: bool = False,
    simulate_stop_on_assertion_error: bool = False,
    simulate_checkpoint_every_k_ticks: int = 10000,
    simulate_checkpoint_ticks: list[int] | None = None,
    simulate_till: int | None = None,
    simulate_profiling: bool = False,
    skip_adding_handlers: bool = False,
) -> tuple[SocketIO, Flask]:
    """Set up the app and the game engine."""
    if simulate_checkpoint_ticks is None:
        simulate_checkpoint_ticks = []
    # gets lock to avoid multiple instances
    if platform.system() == "Linux":
        lock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        lock.bind("\0energetica")

    # Delete last checkpoint
    if rm_instance or simulate_file:
        if os.path.exists("instance/"):
            shutil.rmtree("instance")
            print("instance folder deleted.")

    # Create instance and checkpoints folder if they don't exist
    Path("checkpoints").mkdir(exist_ok=True)
    Path("instance").mkdir(exist_ok=True)
    engine.init_loggers()

    actions = []
    if simulate_file:
        # Simulate the game run from a file.
        Path("checkpoints/simulation").mkdir(exist_ok=True)
        with simulate_file as file:
            actions = [json.loads(line) for line in file]
        assert actions[0]["action_type"] == "init_engine"

        checkpoints = {
            int(save.split("checkpoint_")[1].rstrip(".tar.gz")): save
            for save in glob.glob("checkpoints/simulation/checkpoint_*.tar.gz")
        }
        checkpoints_ids = [
            save_id for save_id in checkpoints.keys() if simulate_till is None or save_id <= simulate_till
        ]
        if checkpoints_ids:
            # Load the last checkpoint.
            loaded_tick = max(checkpoints_ids)
            with tarfile.open(checkpoints[loaded_tick], "r:gz") as tar:
                tar.extractall("./")
            engine.log(f"Loaded checkpoint {loaded_tick}")
    else:
        # Normal game run.
        assert simulate_till is None
        if load_checkpoint:
            saved_history = False
            if os.path.exists("instance/"):
                if os.path.isfile("instance/actions_history.log"):
                    os.rename("instance/actions_history.log", "actions_history.log.bak")
                    saved_history = True
                shutil.rmtree("instance")
            with tarfile.open("last_checkpoint.tar.gz", "r:gz") as tar:
                tar.extractall("./")
            if saved_history:
                os.rename("actions_history.log.bak", "instance/actions_history.log")
            engine.log("Loaded last checkpoint")
        if os.path.isfile("instance/actions_history.log"):
            with open("instance/actions_history.log", "r") as file:
                actions = [json.loads(line) for line in file]
            if actions:
                assert actions[0]["action_type"] == "init_engine"
    if os.path.isfile("instance/engine_data.pck"):
        engine.load()
        if actions:
            assert uuid.UUID(actions[0]["uuid"]) == engine.uuid
    else:
        if actions:
            kwargs: dict = actions[0].copy()
            kwargs.pop("action_type")
            # datetime.fromisoformat
            kwargs["start_date"] = datetime.fromisoformat(kwargs["start_date"])
            engine.init_instance(**kwargs)
        else:
            engine.init_instance(clock_time, in_game_seconds_per_tick, random_seed)

    action_id_by_tick = {
        action["total_t"]: action_id for action_id, action in enumerate(actions) if action["action_type"] == "tick"
    }
    loaded_tick = engine.total_t
    start_action_id = action_id_by_tick[loaded_tick] + 1 if loaded_tick else 1
    last_action_id = action_id_by_tick[simulate_till] if simulate_till else len(actions) - 1
    actions_to_simulate = actions[start_action_id : last_action_id + 1]

    # creates the app :
    app = Flask(__name__)
    app.config["SECRET_KEY"] = get_or_create_flask_secret_key()
    app.config["VAPID_PUBLIC_KEY"], app.config["VAPID_PRIVATE_KEY"] = get_or_create_vapid_keys()
    app.config["VAPID_CLAIMS"] = {"sub": "mailto:dgaf@gmail.com"}
    app.config["engine"] = engine

    @app.context_processor
    def inject_global_context() -> Any:
        return {"app_version": __version__, "app_release_date": __release_date__}

    # initialize socketio :
    socketio = SocketIO(app, cors_allowed_origins="*")  # engineio_logger=True
    engine.socketio = socketio

    if not skip_adding_handlers:
        add_handlers(socketio=socketio)

    # initialize sock for WebSockets:
    sock = Sock(app)
    engine.sock = sock

    if not skip_adding_handlers:
        add_sock_handlers(sock=sock, engine=engine)

    register_app_services(app)

    # add blueprints (website repositories) :
    app.register_blueprint(location_choice_views, url_prefix="/")
    app.register_blueprint(landing, url_prefix="/")
    app.register_blueprint(views, url_prefix="/")
    app.register_blueprint(overviews, url_prefix="/production_overview")
    app.register_blueprint(wiki, url_prefix="/wiki")
    app.register_blueprint(changelog, url_prefix="/")
    app.register_blueprint(auth, url_prefix="/")
    app.register_blueprint(http, url_prefix="/api/")
    # app.register_blueprint(websocket_blueprint, url_prefix="/api/")

    # initialize login manager
    login_manager = LoginManager()
    login_manager.login_view = "auth.login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id: str) -> Player | None:  # pylint: disable=redefined-builtin
        return Player.get(int(id))

    # initialize the schedulers and add the recurrent functions :

    scheduler = APScheduler()
    scheduler.init_app(app)

    add_ticks_clock = partial(
        scheduler.add_job,
        func=state_update,
        id="state_update",
        trigger="cron",
        second=f"*/{clock_time}" if clock_time != 60 else "0",
        misfire_grace_time=10,
    )
    if actions_to_simulate:
        if simulate_file:
            kwargs = {
                "simulating": True,
                "profiling": simulate_profiling,
                "stop_on_mismatch": simulate_stop_on_mismatch,
                "stop_on_server_error": simulate_stop_on_server_error,
                "stop_on_assertion_error": simulate_stop_on_assertion_error,
                "checkpoint_every_k_ticks": simulate_checkpoint_every_k_ticks,
                "checkpoint_ticks": simulate_checkpoint_ticks,
            }
        else:
            engine.action_logger.setLevel(logging.CRITICAL)
            kwargs = {
                "simulating": False,
                "profiling": False,
                "stop_on_mismatch": simulate_stop_on_mismatch,
                "stop_on_server_error": True,
                "stop_on_assertion_error": True,
                "checkpoint_every_k_ticks": None,
                "checkpoint_ticks": None,
            }
        scheduler.add_job(
            func=simulate,
            args=(
                port,
                actions_to_simulate,
            ),
            kwargs=kwargs,
            id="replay",
            trigger="date",
            run_date=datetime.now(),
        )
        if not simulate_file:

            def job_listener(event: Any) -> None:
                if event.job_id != "replay" or not event.retval:
                    return
                add_ticks_clock()
                engine.serve_local = False
                engine.action_logger.setLevel(logging.INFO)
                scheduler.remove_listener(job_listener)

            scheduler.add_listener(job_listener, EVENT_JOB_EXECUTED)
    elif not simulate_file:
        add_ticks_clock()
        engine.serve_local = False

    scheduler.start()
    atexit.register(scheduler.shutdown)

    if run_init_test_players:
        # Temporary automated player creation for testing
        engine.log("running init_test_players")
        init_test_players()

    return socketio, app
    return socketio, app
