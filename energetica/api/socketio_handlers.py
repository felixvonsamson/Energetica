from energetica.auth import load_user_from_socketio_environ  # or wherever you put it
from energetica.database.player import Player


def add_handlers(sio, flask_app):
    @sio.on("connect")
    def handle_connect(sid, environ, auth=None):
        user = load_user_from_socketio_environ(flask_app, environ)
        if user is None:
            print("Anonymous user tried to connect")
            return False  # Reject connection

        user.socketio_clients.append(sid)

    @sio.on("disconnect")
    def handle_disconnect(sid):
        for user in Player.all():
            if sid in user.socketio_clients:
                user.socketio_clients.remove(sid)
                return
