from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from energetica.auth import get_current_user
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.schemas.networks import NetworkIn, NetworkList, NetworkOut
from energetica.utils import network_helpers

router = APIRouter(prefix="/networks", tags=["Networks"])


@router.get("")
def get_networks_list() -> NetworkList:
    return NetworkList(networks=[network.to_schema() for network in Network.all()])


@router.post("/{network_id}/join")
def join_network(
    user: Annotated[Player, Depends(get_current_user)],
    network_id: int,
) -> NetworkOut:
    network = Network.getitem(network_id, error=HTTPException(status_code=404, detail="Network not found"))
    return network_helpers.join_network(user, network).to_schema()


@router.post("/{network_id}/leave")
def leave_network(
    user: Annotated[Player, Depends(get_current_user)],
    network_id: int,
) -> NetworkOut | None:
    network = Network.getitem(network_id, error=HTTPException(status_code=404, detail="Network not found"))
    if user not in network.members:
        raise HTTPException(status_code=403, detail="User is not in this network")
    new_network = network_helpers.leave_network(user)
    if new_network is None:
        return None
    return new_network.to_schema()


@router.post("")
def create_network(user: Annotated[Player, Depends(get_current_user)], request_data: NetworkIn) -> NetworkOut:
    new_network = network_helpers.create_network(user, request_data.name)
    return new_network.to_schema()
