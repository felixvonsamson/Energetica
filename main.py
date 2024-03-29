#!/usr/bin/env python3

"""
This code launches the game 
"""

from website import create_app
import argparse

parser = argparse.ArgumentParser()
parser.add_argument(
    "--run_init_test_players",
    help="run the init_test_players function",
    action="store_true",
)
parser.add_argument(
    "--rm_instance",
    help="remvove the instance folder",
    action="store_true",
)

args = parser.parse_args()

socketio, sock, app = create_app(
    run_init_test_players=args.run_init_test_players,
    rm_instance=args.rm_instance,
)

if __name__ == "__main__":
    socketio.run(app, debug=True, log_output=False, host="0.0.0.0", port=5001)
