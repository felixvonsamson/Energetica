from energetica.auth import load_user_from_socketio_environ  # or wherever you put it
from energetica.database.player import Player


def add_handlers(sio, app):
    @sio.on("connect")
    def handle_connect(sid, environ, auth=None):
        user = load_user_from_socketio_environ(app, environ)
        if user is None:
            print("Anonymous user tried to connect")
            return False  # Reject connection

        print(f"{user.username} connected with SID {sid}")
        user.socketio_clients.append(sid)

    @sio.on("disconnect")
    def handle_disconnect(sid):
        for user in Player.all():
            if sid in user.socketio_clients:
                print(f"{user.username} disconnected with SID {sid}")
                user.socketio_clients.remove(sid)
                return
                return
