"""Routes relating to networks."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.auth import get_current_user
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.networks import ChangeNetworkPrices, NetworkCreate, NetworkListOut, NetworkOut
from energetica.utils import network_helpers

router = APIRouter(prefix="/networks", tags=["Networks"])


@router.get("")
def get_networks_list() -> NetworkListOut:
    """Get the list of existing networks."""
    return NetworkListOut(networks=[NetworkOut.from_network(network) for network in Network.all()])


@router.post("/{network_id}:join")
def join_network(
    user: Annotated[Player, Depends(get_current_user)],
    network_id: int,
) -> NetworkOut:
    """Join a network."""
    network = Network.getitem(network_id, error=HTTPException(status_code=404, detail="Network not found"))
    return NetworkOut.from_network(network_helpers.join_network(user, network))


@router.post("/{network_id}:leave")
def leave_network(
    user: Annotated[Player, Depends(get_current_user)],
    network_id: int,
) -> NetworkOut | None:
    """Leave the network."""
    network = Network.getitem(network_id, error=HTTPException(status_code=404, detail="Network not found"))
    if user not in network.members:
        raise HTTPException(status_code=403, detail="User is not in this network")
    new_network = network_helpers.leave_network(user)
    if new_network is None:
        return None
    return NetworkOut.from_network(new_network)


@router.post("")
def create_network(user: Annotated[Player, Depends(get_current_user)], request_data: NetworkCreate) -> NetworkOut:
    """Create a network."""
    new_network = network_helpers.create_network(user, request_data.name)
    return NetworkOut.from_network(new_network)


@router.patch("/prices", status_code=status.HTTP_204_NO_CONTENT)
async def change_network_prices(
    user: Annotated[Player, Depends(get_current_user)],
    prices_change_request: ChangeNetworkPrices,
) -> None:
    """Update the asking prices and bid prices for a player on their electricity market."""
    if user.network is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    user.network_prices.update(
        updated_asks={ask.type: ask.price for ask in prices_change_request.asks},
        updated_bids={bid.type: bid.price for bid in prices_change_request.bids},
    )
    engine.log(f"{user.username} updated their prices")
