"""Utility functions relating to the game map."""

from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.utils.misc import initialize_player


def confirm_location(player: Player, tile: HexTile) -> None:
    """Confirm a location choice."""
    if tile.player is not None:
        # Location already taken
        # TODO(mglst): this logic should be handled by the router so that it can return a relevant HTTP error code such
        # as HTTP_401_UNAUTHORIZED
        raise GameError(GameExceptionType.LOCATION_OCCUPIED, by=tile.player.id)
    if player.tile is not None:
        # Player has already chosen a location and cannot chose again
        # TODO(mglst): this logic should be handled by the router so that it can return a relevant HTTP error code such
        # as HTTP_40X
        raise GameError(GameExceptionType.CHOICE_UNMODIFIABLE)

    # Checks have succeeded, proceed
    tile.player = player
    player.tile = tile
    initialize_player(player)
    engine.log(f"{player.username} chose the location {tile.id}")
