"""Routes for the leaderboards."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.schemas.leaderboards import LeaderboardsOut, LeaderboardRowOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/leaderboards", tags=["Leaderboards"])


@router.get("")
def get_leaderboards(
    player: Annotated[Player, Depends(get_settled_player)],
) -> LeaderboardsOut:
    """Get the leaderboards data."""
    players = Player.all()
    include_co2_emissions = player.discovered_greenhouse_gas_effect()
    rows = [
        LeaderboardRowOut(
            player_id=player.id,
            username=player.username,
            network_name=player.network.name if player.network is not None else None,
            average_hourly_revenues=player.progression_metrics["average_revenues"],
            max_power_consumption=player.progression_metrics["max_power_consumption"],
            total_technology_levels=round(player.progression_metrics["total_technologies"]),
            xp=round(player.progression_metrics["xp"]),
            co2_emissions=player.calculate_net_emissions() if include_co2_emissions else None,
        )
        for player in players
    ]
    return LeaderboardsOut(rows=rows)
