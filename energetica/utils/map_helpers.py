from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.misc import initialize_player


def confirm_location(player: Player, tile: HexTile) -> None:
    """Confirm a location choice."""
    if tile.player is not None:
        # Location already taken
        raise GameError("locationOccupied", by=tile.player.id)
    if player.tile is not None:
        # Player has already chosen a location and cannot chose again
        raise GameError("choiceUnmodifiable")

    # Checks have succeeded, proceed
    tile.player = player
    player.tile = tile
    initialize_player(player)
    engine.log(f"{player.username} chose the location {tile.id}")
