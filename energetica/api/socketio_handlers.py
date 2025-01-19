"""Contains the main functions that communicate with the server (server side)."""

from flask import request
from flask_login import current_user


def add_handlers(socketio):
    """Handle connection and disconnection of clients."""

    @socketio.on("connect")
    def handle_connect():
        """Handle a new client connection to the Socket.IO server."""
        if current_user.is_anonymous:
            return
        # Store client's sid when connected
        current_user.socketio_clients.append(request.sid)

    @socketio.on("disconnect")
    def handle_disconnect():
        """Remove client's sid from current user's list if not anonymous."""
        if current_user.is_anonymous:
            return
        # Remove client's sid when disconnected
        if request.sid in current_user.socketio_clients:
            current_user.socketio_clients.remove(request.sid)
