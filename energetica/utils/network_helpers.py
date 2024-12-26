"""Util functions relating to networks"""

import pickle
import shutil
from pathlib import Path

from energetica.database import db
from energetica.database.engine_data import CapacityData, CircularBufferNetwork
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.game_engine import GameEngine, GameError


def join_network(engine, player, network):
    """shared API method to join a network."""
    if "Unlock Network" not in player.data.achievements:
        raise GameError("networkNotUnlocked")
    if network is None:
        raise GameError("noSuchNetwork")
    if player.network is not None:
        raise GameError("playerAlreadyInNetwork")
    player.network = network
    db.session.commit()
    network.data.capacities.update_network(network)
    engine.log(f"{player.username} joined the network {network.name}")
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change(engine)


def data_init_network():
    """Initializes the data for a new network."""
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


def create_network(engine, player, name) -> Network:
    """shared API method to create a network. Network name must pass validation,
    namely it must not be too long, nor too short, and must not already be in
    use."""
    if "Unlock Network" not in player.data.achievements:
        raise GameError("networkNotUnlocked")
    if len(name) < 3 or len(name) > 40:
        raise GameError("nameLengthInvalid")
    if Network.query.filter_by(name=name).first() is not None:
        raise GameError("nameAlreadyUsed")
    new_network = Network(name=name, members=[player])
    db.session.add(new_network)
    db.session.commit()
    network_path = f"instance/network_data/{new_network.id}"
    Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)
    new_network.data.rolling_history = CircularBufferNetwork()
    new_network.data.capacities = CapacityData()
    new_network.data.capacities.update_network(new_network)
    past_data = data_init_network()
    Path(f"{network_path}").mkdir(parents=True, exist_ok=True)
    with open(f"{network_path}/time_series.pck", "wb") as file:
        pickle.dump(past_data, file)
    engine.log(f"{player.username} created the network {name}")
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change(engine)
    return new_network


def leave_network(engine, player):
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        raise GameError("notInNetwork")
    player.network_id = None
    engine.log(f"{player.username} left the network {network.name}")
    remaining_members_count = Player.query.filter_by(network_id=network.id).count()
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        shutil.rmtree(f"instance/network_data/{network.id}")
        db.session.delete(network)
    db.session.commit()
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change(engine)


def reorder_facility_priorities(engine: GameEngine, player: Player):
    """Reorders the player's `priorities_of_controllables`, `priorities_of_demand` and `list_of_renewables` according
    to the players network prices :
    - The controllables are sorted in ascending price order
    - The demand is sorted in descending price order
    - The renewables are sorted in the same order for all players
    """
    player.data.priorities_of_controllables.sort(key=lambda x: player.data.network_prices["supply"][x])
    player.data.priorities_of_demand.sort(key=lambda x: player.data.network_prices["demand"][x], reverse=True)
    player.data.list_of_renewables.sort(key=engine.renewables.index)


def set_network_prices(engine: GameEngine, player: Player, updated_prices: dict[str, dict[str, float]]):
    """Updates network prices for that player"""
    if not all(key in ["supply", "demand"] for key in updated_prices.keys()):
        raise GameError("malformedRequest")
    for facility in updated_prices["supply"]:
        if facility not in engine.controllable_facilities + engine.storage_facilities:
            raise GameError("malformedRequest")
    for facility in updated_prices["demand"]:
        if facility not in engine.special_power_demand + engine.extraction_facilities + engine.storage_facilities:
            raise GameError("malformedRequest")
    for price_type, price_dict in updated_prices.items():
        for facility, new_price in price_dict.items():
            if not isinstance(new_price, (int, float)):
                raise GameError("malformedRequest")
            if new_price <= -5:
                raise GameError("priceTooLow")
            player.data.network_prices[price_type][facility] = new_price

    engine.log(f"{player.username} updated their prices")
    reorder_facility_priorities(engine, player)


def change_facility_priority(engine: GameEngine, player: Player, priority: list[str]):
    """
    This function is executed when the facilities priority is changed by changing the order in the interactive
    table. The function reassigns the selling prices of the facilities according to the new order.
    """
    old_set = set(
        player.data.priorities_of_controllables + player.data.list_of_renewables + player.data.priorities_of_demand
    )
    # TODO (Felix): Need to distinguish charging and discharging of storage facilities
    if old_set != set(priority):
        raise GameError("malformedRequest")
    price_list = [getattr(player, "price_" + facility) for facility in priority]
    prices = dict(zip(priority, sorted(price_list)))
    set_network_prices(engine, player, prices)
