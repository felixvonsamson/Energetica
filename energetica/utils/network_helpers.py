"""Utility functions relating to networks."""

import pickle
import shutil
from pathlib import Path

from energetica.database.engine_data import CapacityData, CircularBufferNetwork
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.game_error import GameError
from energetica.globals import engine


# TODO (Felix): Move this to a method in Player
def join_network(player: Player, network: Network | None) -> Network:
    """Shared API method to join a network."""
    if not player.achievements["network"]:
        raise GameError("networkNotUnlocked")
    if network is None:
        raise GameError("noSuchNetwork")
    if player.network is not None:
        raise GameError("playerAlreadyInNetwork")
    player.network = network
    network.members.append(player)
    network.capacities.update_network(network)
    engine.log(f"{player.username} joined the network {network.name}")
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change()
    return network


def data_init_network() -> dict:
    """Initialize the data for a new network."""
    return {
        "network_data": {
            "price": [[0.0] * 360] * 5,
            "quantity": [[0.0] * 360] * 5,
        },
        "exports": {},
        "imports": {},
        "generation": {},
        "consumption": {},
    }


def create_network(player: Player, name: str) -> Network:
    """Shared API method to create a network. Network name must pass validation,
    namely it must not be too long, nor too short, and must not already be in
    use."""
    if not player.achievements["network"]:
        raise GameError("networkNotUnlocked")
    if len(name) < 3 or len(name) > 40:
        raise GameError("nameLengthInvalid")
    if len(list(Network.filter_by(name=name))):
        raise GameError("nameAlreadyUsed")
    new_network = Network(name=name, members=[player])
    player.network = new_network
    network_path = f"instance/network_data/{new_network.id}"
    Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)
    # TODO (Felix): Move this to Network init
    new_network.rolling_history = CircularBufferNetwork()
    new_network.capacities = CapacityData()
    new_network.capacities.update_network(new_network)
    past_data = data_init_network()
    Path(f"{network_path}").mkdir(parents=True, exist_ok=True)
    with open(f"{network_path}/time_series.pck", "wb") as file:
        pickle.dump(past_data, file)
    engine.log(f"{player.username} created the network {name}")
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change()
    return new_network


# TODO (Felix): Move this to a method in Player
def leave_network(player: Player) -> None:
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        raise GameError("notInNetwork")
    player.network_id = None
    engine.log(f"{player.username} left the network {network.name}")
    remaining_members_count = len(list(Player.filter(lambda p: p.network is not None and p.network == network)))
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        shutil.rmtree(f"instance/network_data/{network.id}")
        network.delete()
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change()


# TODO (Felix): Move this to a method in Player
def reorder_facility_priorities(player: Player) -> None:
    """
    Reorder the player's `priorities_of_controllables`, `priorities_of_demand` and `list_of_renewables`.

    This is done according to the players network prices :
    - The controllables are sorted in ascending price order
    - The demand is sorted in descending price order
    - The renewables are sorted in the same order for all players
    """
    player.priorities_of_controllables.sort(key=lambda x: player.network_prices.supply[x])
    player.priorities_of_demand.sort(key=lambda x: player.network_prices.demand[x], reverse=True)
    player.list_of_renewables.sort(key=engine.renewables.index)


# TODO (Felix): Move this to a method in Player or even in PlayerPrices
def set_network_prices(
    player: Player,
    updated_supply_prices: dict[str, float],
    updated_demand_prices: dict[str, float],
) -> None:
    """Update network prices for that player."""
    for facility in updated_supply_prices:
        if facility not in engine.controllable_facilities + engine.storage_facilities:
            raise GameError("malformedRequest")
    for facility in updated_demand_prices:
        if facility not in engine.special_power_demand + engine.extraction_facilities + engine.storage_facilities:
            raise GameError("malformedRequest")
    for facility, new_price in updated_supply_prices.items():
        if not isinstance(new_price, (int, float)):
            raise GameError("malformedRequest")
        if new_price <= -5:
            raise GameError("priceTooLow")
        player.network_prices.supply[facility] = new_price
    for facility, new_price in updated_demand_prices.items():
        if not isinstance(new_price, (int, float)):
            raise GameError("malformedRequest")
        if new_price <= -5:
            raise GameError("priceTooLow")
        player.network_prices.demand[facility] = new_price

    engine.log(f"{player.username} updated their prices")
    reorder_facility_priorities(player)


# TODO (Felix): Move this to a method in Player
def change_facility_priority(player: Player, priority: list[str]) -> None:
    """
    Reassign the selling prices of the facilities according to the new order.

    Executed when the facilities priority is changed by changing the order in the interactive table.
    """
    old_set = {f"demand-{demand_type}" for demand_type in player.priorities_of_demand}
    old_set.update(player.priorities_of_controllables)
    if old_set != set(priority):
        raise GameError("malformedRequest")

    price_list = [
        player.network_prices.demand[facility[7:]]
        if facility.startswith("demand-")
        else player.network_prices.supply[facility]
        for facility in priority
    ]
    sorted_prices = sorted(price_list)
    updated_supply_prices = {}
    updated_demand_prices = {}
    for facility, price in zip(priority, sorted_prices):
        if facility.startswith("demand-"):
            updated_demand_prices[facility[7:]] = price
        else:
            updated_supply_prices[facility] = price
    set_network_prices(player, updated_supply_prices, updated_demand_prices)
