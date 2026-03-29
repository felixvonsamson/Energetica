"""Utility functions relating to the game map."""

from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.database.user import User
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.utils.misc import initialize_player


def confirm_location(user: User, tile: HexTile) -> Player:
    """Confirm a location choice."""
    if tile.player is not None:
        # Location already taken
        raise GameError(GameExceptionType.LOCATION_OCCUPIED, by=tile.player.id)
    if user.player is not None:
        # Player has already chosen a location and cannot chose again
        raise GameError(GameExceptionType.CHOICE_UNMODIFIABLE)

    # Checks have succeeded, proceed
    player = initialize_player(user, tile)

    # Invalidate caches for the settling player on all their connected devices
    player.emit(
        "invalidate",
        {
            "queries": [
                ["auth", "me"],
                ["map"],
                ["players"],
            ],
        },
    )

    # Broadcast map update to all connected players
    engine.emit(
        "invalidate",
        {
            "queries": [
                ["map"],
                ["players"],
            ],
        },
    )

    return player
