"""Routes for API for the power priorities list."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.player import Player
from energetica.schemas.electricity_markets import AskType, BidType
from energetica.schemas.power_priorities import PowerPrioritiesListIn, PowerPrioritiesListOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/power-priorities", tags=["Power Priorities"])

UNLOCK_NETWORK_MESSAGE = "You must unlock the Network achievement first"


@router.get("")
def get_power_priorities(
    player: Annotated[Player, Depends(get_settled_player)],
) -> PowerPrioritiesListOut:
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    return PowerPrioritiesListOut.from_player(player)


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
def put_power_priorities(
    player: Annotated[Player, Depends(get_settled_player)],
    data: PowerPrioritiesListIn,
) -> None:
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    player.network_prices.change_facility_priority(player, data.power_priorities)

    # Invalidate React Query cache
    player.invalidate_queries(
        ["power-priorities"],
    )


@router.post("/{side}/{item_type}:increase-priority")
def increase_priority(
    player: Annotated[Player, Depends(get_settled_player)],
    side: Literal["ask", "bid"],
    item_type: AskType | BidType,
) -> PowerPrioritiesListOut:
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    player.network_prices.shift_facility_priority(player, side, item_type, -1)
    return PowerPrioritiesListOut.from_player(player)


@router.post("/{side}/{item_type}:decrease-priority")
def decrease_priority(
    player: Annotated[Player, Depends(get_settled_player)],
    side: Literal["ask", "bid"],
    item_type: AskType | BidType,
) -> PowerPrioritiesListOut:
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    player.network_prices.shift_facility_priority(player, side, item_type, 1)
    return PowerPrioritiesListOut.from_player(player)
