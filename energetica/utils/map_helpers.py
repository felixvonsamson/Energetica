"""Utility functions relating to the game map."""

from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.database.user import User
from energetica.game_error import GameError, GameExceptionType
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
    return player
