"""Utility functions relating to the game map."""

from energetica.freeplay.database.map.hex_tile import HexTile
from energetica.freeplay.database.player import Player
from energetica.freeplay.game_error import FreeplayErrorCode
from energetica.freeplay.globals import engine
from energetica.identity.account import Account
from energetica.kernel.game_error import GameError
from energetica.utils.misc import initialize_player


def confirm_location(account: Account, tile: HexTile) -> Player:
    """Confirm a location choice."""
    if tile.player is not None:
        # Location already taken
        raise GameError(FreeplayErrorCode.LOCATION_OCCUPIED, by=tile.player.id)
    if next(Player.filter_by(account_id=account.account_id), None) is not None:
        # Player has already chosen a location and cannot chose again
        raise GameError(FreeplayErrorCode.CHOICE_UNMODIFIABLE)

    # Checks have succeeded, proceed
    player = initialize_player(account, tile)

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
