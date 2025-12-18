"""Routes relating to electricity markets."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.network import Network
from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.electricity_markets import (
    ChangeElectricityMarketPrices,
    ElectricityMarketCreate,
    ElectricityMarketListOut,
    ElectricityMarketOut,
)
from energetica.utils import network_helpers
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/electricity-markets", tags=["Electricity Markets"])

UNLOCK_NETWORK_MESSAGE = "You must unlock the Network achievement first"


@router.get("")
def get_electricity_market_list(
    player: Annotated[Player, Depends(get_settled_player)],
) -> ElectricityMarketListOut:
    """Get the list of existing electricity markets."""
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    return ElectricityMarketListOut(
        electricity_markets=[ElectricityMarketOut.from_network(network) for network in Network.all()]
    )


@router.post("/{network_id}:join")
def join_electricity_market(
    player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
) -> ElectricityMarketOut:
    """Join the electricity markets."""
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    network = Network.getitem(
        network_id,
        error=HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Network not found"),
    )
    return ElectricityMarketOut.from_network(network_helpers.join_network(player, network))


@router.post("/{network_id}:leave")
def leave_electricity_market(
    player: Annotated[Player, Depends(get_settled_player)],
    network_id: int,
) -> ElectricityMarketOut | None:
    """Leave the electricity markets."""
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    network = Network.getitem(
        network_id,
        error=HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Network not found"),
    )
    if player not in network.members:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not in this network")
    new_network = network_helpers.leave_network(player)
    if new_network is None:
        return None
    return ElectricityMarketOut.from_network(new_network)


@router.post("")
def create_electricity_market(
    player: Annotated[Player, Depends(get_settled_player)], request_data: ElectricityMarketCreate
) -> ElectricityMarketOut:
    """Create a new electricity market."""
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    new_network = network_helpers.create_network(player, request_data.name)
    return ElectricityMarketOut.from_network(new_network)


@router.patch("/prices", status_code=status.HTTP_204_NO_CONTENT)
async def change_electricity_market_prices(
    player: Annotated[Player, Depends(get_settled_player)],
    prices_change_request: ChangeElectricityMarketPrices,
) -> None:
    """Update the asking prices and bid prices for a player on their electricity market."""
    if not player.achievements["network"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=UNLOCK_NETWORK_MESSAGE)
    if player.network is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    player.network_prices.update(
        updated_asks={ask.type: ask.price for ask in prices_change_request.asks},
        updated_bids={bid.type: bid.price for bid in prices_change_request.bids},
    )
    engine.log(f"{player.username} updated their prices")
