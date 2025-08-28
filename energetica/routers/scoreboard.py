"""Routes for the scoreboard."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.player import Player
from energetica.schemas.scoreboard import ScoreboardOut, ScoreboardRowOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/scoreboard", tags=["Scoreboard"])


@router.get("")
def get_scoreboard(
    player: Annotated[Player, Depends(get_settled_player)],
) -> ScoreboardOut:
    """Get the scoreboard data."""
    players = Player.all()
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
