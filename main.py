#!/usr/bin/env python3 -u

"""This code launches the game"""

if __name__ == "__main__":
    import argparse
    import os
    import warnings

    from website import create_app

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
        "--random_seed", type=int, default=42, help="Set the random seed", choices=range(0, 65536), metavar="{0..65535}"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5001,
        help="Port on witch the server should run",
        choices=range(0, 65536),
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
        "--profiling",
        type=bool,
        default=False,
        help="If game is simulated, allows to run code profiling.",
    )
    parser.add_argument(
        "--simulate_log_every_k_ticks",
        type=int,
        default=10000,
        help="If game is simulated, save the engine for every tick that is a multiple of the given int.",
    )
    parser.add_argument(
        "--simulate_till",
        type=int,
        default=None,
        help="If game is simulated, and if a value is given, only simulates till the given tick, and saves the engine",
    )
    parser.add_argument(
        "--force_yes",
        action="store_true",
        help="If yes, the app proceeds with the high-risk action without requesting approval.",
    )

    args = parser.parse_args()
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" and args.simulate_file:
        warnings.warn("The instance folder will be deleted.")
        if not args.force_yes:
            print("Do you want to continue? (yes/no): ", end="")
            response = input().strip().lower()
            response = "yes"
            if response != "yes":
                print("Operation aborted by the user.")
                exit(0)
        args.rm_instance = True
    socketio, _, app = create_app(**vars(args))
    socketio.run(app, debug=True, log_output=False, host="0.0.0.0", port=args.port)
