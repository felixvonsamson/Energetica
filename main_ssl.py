#!/bin/env python3

from website import create_app
import argparse

parser = argparse.ArgumentParser()
parser.add_argument(
    "--clock_time",
    type=int,
    choices=[60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1],
    default=60,
    help="Clock time interval in seconds (default is 60)",
)
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
    clock_time=args.clock_time,
    run_init_test_players=args.run_init_test_players,
    rm_instance=args.rm_instance,
)

if __name__ == "__main__":
    socketio.run(
        app,
        debug=True,
        log_output=False,
        host="0.0.0.0",
        port=5443,
        keyfile="server_privatekey.pem",
        certfile="server_certificate.pem",
    )
