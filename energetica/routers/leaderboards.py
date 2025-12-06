"""Routes for the leaderboards."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.schemas.leaderboards import LeaderboardsOut, PlayerDetailStats
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/leaderboards", tags=["Leaderboards"])


@router.get("")
def get_leaderboards(
    player: Annotated[Player, Depends(get_settled_player)],
) -> LeaderboardsOut:
    """Get the leaderboards data."""
    players = Player.all()
    include_co2_emissions = player.discovered_greenhouse_gas_effect()
    rows = [PlayerDetailStats.from_player(player, include_co2_emissions) for player in players]
    return LeaderboardsOut(rows=rows)
