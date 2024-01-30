#!/bin/env python3

from website import create_app

socketio, sock, app = create_app()

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
