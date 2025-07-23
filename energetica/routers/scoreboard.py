"""Routes for the scoreboard."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.auth import get_current_user
from energetica.database.player import Player
from energetica.schemas.scoreboard import ScoreboardOut, ScoreboardRowOut

router = APIRouter(prefix="/scoreboard", tags=["Scoreboard"])


@router.get("")
def get_scoreboard(
    player: Annotated[Player, Depends(get_current_user)],
) -> ScoreboardOut:
    """Get the scoreboard data."""
    players = Player.filter(lambda p: p.tile is not None)
    include_co2_emissions = player.discovered_greenhouse_gas_effect()
    rows = [
        ScoreboardRowOut(
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
    return ScoreboardOut(rows=rows)
