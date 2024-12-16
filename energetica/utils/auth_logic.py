"""Authentication logic for the game."""

import json
from datetime import datetime

from flask import current_app
from werkzeug.security import generate_password_hash

from energetica.api.websocket import ws_broadcast
from energetica.database import db
from energetica.database.player import Player
from energetica.game_engine import GameEngine, GameError

# Ranges are inclusive
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 18
PASSWORD_MIN_LENGTH = 7


def signup_player(username: str, password1: str, password2: str) -> Player:
    """Create a new player account."""
    player = Player.query.filter_by(username=username).first()
    if player:
        raise GameError("usernameExists")
    if len(username) < USERNAME_MIN_LENGTH or len(username) > USERNAME_MAX_LENGTH:
        raise GameError("usernameLength")
    if password1 != password2:
        raise GameError("passwordMismatch")
    if len(password1) < PASSWORD_MIN_LENGTH:
        raise GameError("passwordLength")

    new_player = Player(
        username=username,
        pwhash=generate_password_hash(password1, method="scrypt"),
    )
    db.session.add(new_player)
    db.session.commit()
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "action_type": "create_user",
        "player_id": new_player.id,
    }
    engine: GameEngine = current_app.config["engine"]
    engine.action_logger.info(json.dumps(log_entry))
    engine.log(f"{username} created an account")
    # websocket.rest_notify_scoreboard(g.engine)
    ws_broadcast.players()

    return new_player
