#!/usr/bin/env -S python3 -u
"""Launch the game."""

import argparse
import os

from energetica import create_app

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--clock_time",
        type=int,
        choices=[60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1],
        default=30,
        help="Set the clock time interval in seconds (default: 60)",
    )
    parser.add_argument(
        "--in_game_seconds_per_tick",
        type=int,
        choices=[3600, 1800, 1200, 900, 600, 540, 480, 420, 360, 300, 240, 180, 120, 60, 30],
        default=240,
        help="Set  how many in-game seconds are in a tick (default: 240)",
    )
    parser.add_argument(
        "--run_init_test_players",
        help="Run the init_test_players function",
        action="store_true",
    )
    parser.add_argument(
        "--rm_instance",
        help="remove the instance folder",
        action="store_true",
    )
    parser.add_argument(
        "--random_seed",
        type=int,
        default=42,
        help="Set the random seed",
        choices=range(65536),
        metavar="{0..65535}",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5001,
        help="Port on witch the server should run",
        choices=range(65536),
        metavar="{0..65535}",
    )
    parser.add_argument(
        "--simulate_file",
        type=argparse.FileType("r", encoding="UTF-8"),
        default=None,
        help="If given, the server simulates in fast-forward the game with the given action history log file.",
        metavar="FILE",
    )
    parser.add_argument(
        "--simulate_stop_on_mismatch",
        action="store_true",
        help="If game is simulated, stops the simulation if the request response does not match the expected response.",
    )
    parser.add_argument(
        "--simulate_stop_on_server_error",
        action="store_true",
        help="If game is simulated, stops the simulation if the server returns an error.",
    )
    parser.add_argument(
        "--simulate_stop_on_assertion_error",
        action="store_true",
        help="If game is simulated, stops the simulation if the verification raises an assertion error.",
    )
    parser.add_argument(
        "--simulate_checkpoint_every_k_ticks",
        type=int,
        default=10000,
        help="If game is simulated, save the engine for every tick that is a multiple of the given int.",
    )
    parser.add_argument(
        "--simulate_checkpoint_ticks",
        nargs="+",
        type=int,
        default=[],
        help="If game is simulated, save the engine for every given tick.",
    )
    parser.add_argument(
        "--simulate_till",
        type=int,
        default=None,
        help="If game is simulated, and if a value is given, only simulates till the given tick, and saves the engine",
    )
    parser.add_argument(
        "--simulate_profiling",
        action="store_true",
        help="If game is simulated, allows to run code profiling.",
    )
    parser.add_argument(
        "--keyfile",
        type=str,
        default=None,
        help="Path to the SSL key file",
    )
    parser.add_argument(
        "--certfile",
        type=str,
        default=None,
        help="Path to the SSL certificate file",
    )
    parser.add_argument(
        "--disable_signups",
        action="store_true",
        help="Disable sign-ups if game is played with a fixed set of players.",
    )

    kwargs = vars(parser.parse_args())
    ssl_args = {"keyfile": kwargs.pop("keyfile"), "certfile": kwargs.pop("certfile")}
    ssl_args = ssl_args if ssl_args["keyfile"] and ssl_args["certfile"] else {}

    """Initializes mock app."""
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        from flask import Flask
        from flask_socketio import SocketIO

        app = Flask(__name__)
        socketio = SocketIO(app, cors_allowed_origins="*")  # engineio_logger=True
    else:
        socketio, app = create_app(**kwargs)

    socketio.run(app, debug=True, log_output=False, host="0.0.0.0", port=kwargs["port"], **ssl_args)
