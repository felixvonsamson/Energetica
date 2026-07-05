"""Initializes the app and the game engine."""

__version__ = "0.11.3-beta"
__release_date__ = "27/04/2026"

import asyncio
import glob
import logging
import os
import platform
import secrets
import shutil
import socket
import subprocess
import tarfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import AsyncGenerator, Literal, cast

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED, JobExecutionEvent
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from pydantic import TypeAdapter

from energetica import globals
from energetica.game_engine import GameEngine

_REPO_ROOT = Path(__file__).parent.parent

# The engine object is light (config + a couple of pickles, no game domain, no I/O beyond a
# mkdir) and is constructed at import so the DBModel registry (populated at model class-definition
# time) always has an engine to bind to. The *heavy* game graph — routers, socketio, the tick
# loop, the domain models — is imported lazily inside create_app instead, so importing the
# server-wide identity layer (``energetica.accounts`` / ``instance_config``) or the
# instance-independent lobby does not pull in the game domain or its running services (ADR-0002,
# lobby Phase B). The final severing of this dormant object is the follow-up identity-package
# extraction.
engine = GameEngine()
globals.engine = engine
globals.MAIN_EVENT_LOOP = asyncio.get_event_loop()


def create_app(
    *,
    port: int = 8000,
    clock_time: int = 30,
    in_game_seconds_per_tick: int = 240,
    run_init_test_players: bool = False,
    rm_instance: bool = False,
    load_checkpoint: bool = False,
    random_seed: int = 42,
    simulate_file: str | None = None,
    simulate_stop_on_mismatch: bool = False,
    simulate_stop_on_server_error: bool = False,
    simulate_stop_on_assertion_error: bool = False,
    simulate_checkpoint_every_k_ticks: int = 10000,
    simulate_checkpoint_ticks: list[int] | None = None,
    simulate_till: int | None = None,
    simulate_profiling: bool = False,
    skip_adding_handlers: bool = False,  # TODO(mglst): revisit if this is still needed, currently unused
    env: Literal["dev"] | Literal["prod"],
    disable_signups: bool = False,
    schema_only: bool = False,
) -> FastAPI:
    """Set up the app and the game engine."""
    # The game graph is imported here, not at module scope, so importing the identity layer / the
    # lobby stays free of the game domain, routers and socketio (ADR-0002, lobby Phase B). The
    # engine object itself is constructed at module scope above (it is light and the ORM needs it
    # at model-import time).
    from energetica.api.app_services import register_app_services
    from energetica.init_test_players import init_test_players
    from energetica.routers import setup_routes
    from energetica.schemas.simulate import Action, InitEngineAction
    from energetica.simulate import simulate
    from energetica.socketio import setup_socketio
    from energetica.utils.action_log import read_init_action, stream_actions_after_tick
    from energetica.utils.browser_notifications import load_or_create_vapid_keys
    from energetica.utils.tick_execution import state_update

    if schema_only:
        # Minimal FastAPI app for OpenAPI schema generation only
        app = FastAPI()
        setup_routes(app)
        return app

    try:
        engine.git_sha = (
            subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        engine.git_sha = None

    print(f"Server is running in {env} mode")
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

    actions: list[Action] = []
    init_action: InitEngineAction | None = None
    if simulate_file:
        # Simulate the game run from a file. This dev/CI path replays an arbitrary, dev-chosen
        # file and still parses it in full — it carries no production crash-loop exposure.
        Path("checkpoints/simulation").mkdir(exist_ok=True)
        TypeAdapterAction = TypeAdapter(Action)
        with open(simulate_file, "r", encoding="utf-8") as file:
            actions = cast(list[Action], [TypeAdapterAction.validate_json(line) for line in file])
        assert actions[0].action_type == "init_engine"
        init_action = cast(InitEngineAction, actions[0])

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
            assert os.path.isfile("checkpoints/last_checkpoint.tar.gz"), "No checkpoint found."
            saved_history = False
            if os.path.exists("instance/"):
                if os.path.isfile("instance/actions_history.log"):
                    os.rename("instance/actions_history.log", "actions_history.log.bak")
                    saved_history = True
                shutil.rmtree("instance")
            with tarfile.open("checkpoints/last_checkpoint.tar.gz", "r:gz") as tar:
                tar.extractall("./")
            if saved_history:
                os.rename("actions_history.log.bak", "instance/actions_history.log")
            engine.log("Loaded last checkpoint")
        # The action log is the authoritative event source, but only line 0 (init_engine) and
        # the actions after the loaded tick are ever needed. Read line 0 now and stream the tail
        # below, rather than deserialising the whole (multi-hundred-MB) log into Pydantic objects
        # on every startup, which spiked RSS to ~1.3 GB and OOM-killed the box (issue #766).
        if os.path.isfile("instance/actions_history.log"):
            init_action = read_init_action("instance/actions_history.log")
    if os.path.isfile("instance/engine_data.pck"):
        engine.load()
        if init_action is not None:
            assert uuid.UUID(init_action.instance_uuid) == engine.uuid
    else:
        if init_action is not None:
            assert init_action.game_version == __version__, (
                "Game version mismatch. This actions history is not compatible with this version of the game."
            )
            kwargs: dict = init_action.model_dump()
            kwargs.pop("action_type")
            engine.init_instance(**kwargs)
        else:
            engine.init_instance(clock_time, in_game_seconds_per_tick, random_seed, env, __version__, disable_signups)

    loaded_tick = engine.total_t
    if simulate_file:
        action_id_by_tick = {
            action.total_t: action_id for action_id, action in enumerate(actions) if action.action_type == "tick"
        }
        start_action_id = action_id_by_tick[loaded_tick] + 1 if loaded_tick else 1
        last_action_id = action_id_by_tick[simulate_till] if simulate_till else len(actions) - 1
        actions_to_simulate = actions[start_action_id : last_action_id + 1]
    elif os.path.isfile("instance/actions_history.log"):
        actions_to_simulate = stream_actions_after_tick("instance/actions_history.log", loaded_tick)
    else:
        actions_to_simulate = []

    replay_tick_targets = [action.total_t for action in actions_to_simulate if action.action_type == "tick"]
    if replay_tick_targets:
        engine.resim_start_tick = engine.total_t
        engine.resim_target_tick = max(replay_tick_targets)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        # initialize the schedulers and add the recurrent functions :
        scheduler = AsyncIOScheduler()

        def error_listener(event: JobExecutionEvent) -> None:
            """Track scheduler job errors so /healthz can surface them as 'degraded'."""
            engine.scheduler_exception_count += 1

        scheduler.add_listener(error_listener, EVENT_JOB_ERROR)

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

                def job_listener(event: JobExecutionEvent) -> None:
                    """This function allows to restart normal server behavior after re-simulation has finished successfully."""
                    if event.job_id != "replay" or not event.retval:
                        # The simulation was not successful, stop here.
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

        from energetica import accounts
        from energetica.database.user import User
        from energetica.utils.auth import generate_password_hash

        accounts.init_db()

        # Creating the root admin account if it does not exist.
        if not list(User.filter_by(role="admin")):
            admin_password = secrets.token_hex(4)
            hashed_password = generate_password_hash(admin_password)
            admin_account_id = accounts.get_or_create_account_id(username="admin", pwhash=hashed_password)
            new_admin = User(username="admin", pwhash=hashed_password, role="admin", account_id=admin_account_id)
            engine.log(f"Admin account created with username '{new_admin.username}'")
            # Written under instance/ (the per-instance, service-writable state dir): the code
            # dir is deploy-owned and read-only to the service user in the multi-instance layout,
            # so writing the repo root here would PermissionError on startup.
            with open(_REPO_ROOT / "instance" / "admin_accounts.txt", "w", encoding="utf-8") as file:
                file.write(f"{new_admin.username},{admin_password}\n")

        if disable_signups:
            # if sign-ups are disabled, accounts have to be created from a file. Lives under
            # instance/ (service-writable) — the code dir is read-only to the service user, and
            # this file is rewritten below with generated passwords, so it must be writable.
            with open(_REPO_ROOT / "instance" / "players.txt", "r", encoding="utf-8") as file:
                lines = file.readlines()

            with open(_REPO_ROOT / "instance" / "players.txt", "w", encoding="utf-8") as file:
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(",")
                    if len(parts) > 2:
                        raise ValueError("Invalid format in players.txt. Expected 'username,password'.")
                    username = parts[0].strip()
                    password = parts[1].strip() if len(parts) > 1 else None
                    existing_player = next(User.filter_by(username=username), None)
                    if existing_player:
                        engine.log(f"players.txt: Did not create new player {username}; username already exists.")
                        continue
                    if password is None:
                        password = secrets.token_hex(4)
                    hashed_password = generate_password_hash(password)
                    account_id = accounts.get_or_create_account_id(username=username, pwhash=hashed_password)
                    User(username=username, pwhash=hashed_password, role="player", account_id=account_id)
                    file.write(f"{username},{password}\n")
                    engine.log(f"players.txt: Created player {username} with password {password}")

        if run_init_test_players:
            engine.log("running init_test_players")
            init_test_players()

        # Publish this instance's sanitised fragment to the landing dir and re-aggregate the
        # public manifest. Best-effort: unconfigured/dev deployments and an unwritable landing
        # dir are tolerated (logged, not fatal).
        from energetica import instance_config

        instance_config.publish_on_startup()

        yield
        scheduler.shutdown()
        # mglst: See discussion for #302
        # https://github.com/felixvonsamson/Energetica/issues/302
        # engine.save()

    app = FastAPI(lifespan=lifespan)

    setup_socketio(app)
    setup_routes(app)
    load_or_create_vapid_keys(engine)
    register_app_services(app)

    ssl_args = {"keyfile": None, "certfile": None}
    ssl_args = ssl_args if ssl_args["keyfile"] and ssl_args["certfile"] else {}

    return app
