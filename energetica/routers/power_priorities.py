"""Routes for API for the power priorities list."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.player import Player
from energetica.schemas.power_priorities import PowerPrioritiesListIn, PowerPrioritiesListOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/power-priorities", tags=["Power Priorities"])


@router.get("")
def get_power_priorities(
    player: Annotated[Player, Depends(get_settled_player)],
) -> PowerPrioritiesListOut:
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You must unlock the Network achievement first")
    return PowerPrioritiesListOut.from_player(player)


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
def put_power_priorities(
    player: Annotated[Player, Depends(get_settled_player)],
    data: PowerPrioritiesListIn,
) -> None:
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You must unlock the Network achievement first")
    player.network_prices.change_facility_priority(player, data.power_priorities)

    # Invalidate React Query cache
    player.invalidate_queries(
        ["power-priorities"],
        ["facilities"],  # Priorities affect facility production
    )
