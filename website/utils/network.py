"""Util functions relating to networks"""

import pickle
import shutil
from pathlib import Path

import website.api.websocket as websocket
from website import db
from website.database.engine_data import CapacityData, CircularBufferNetwork
from website.database.player import Network, Player
from website.game_engine import GameEngine, GameException


def join_network(engine, player, network):
    """shared API method to join a network."""
    if "Unlock Network" not in player.achievements:
        raise GameException("networkNotUnlocked")
    if network is None:
        raise GameException("noSuchNetwork")
    if player.network is not None:
        raise GameException("playerAlreadyInNetwork")
    player.network = network
    db.session.commit()
    engine.data["network_capacities"][network.id].update_network(network)
    engine.log(f"{player.username} joined the network {network.name}")
    websocket.rest_notify_network_change(engine)


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


def create_network(engine, player, name):
    """shared API method to create a network. Network name must pass validation,
    namely it must not be too long, nor too short, and must not already be in
    use."""
    if "Unlock Network" not in player.achievements:
        raise GameException("networkNotUnlocked")
    if len(name) < 3 or len(name) > 40:
        raise GameException("nameLengthInvalid")
    if Network.query.filter_by(name=name).first() is not None:
        raise GameException("nameAlreadyUsed")
    new_network = Network(name=name, members=[player])
    db.session.add(new_network)
    db.session.commit()
    network_path = f"instance/network_data/{new_network.id}"
    Path(f"{network_path}/charts").mkdir(parents=True, exist_ok=True)
    engine.data["network_data"][new_network.id] = CircularBufferNetwork()
    engine.data["network_capacities"][new_network.id] = CapacityData()
    engine.data["network_capacities"][new_network.id].update_network(new_network)
    past_data = data_init_network()
    Path(f"{network_path}").mkdir(parents=True, exist_ok=True)
    with open(f"{network_path}/time_series.pck", "wb") as file:
        pickle.dump(past_data, file)
    engine.log(f"{player.username} created the network {name}")
    websocket.rest_notify_network_change(engine)


def leave_network(engine, player):
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        raise GameException("notInNetwork")
    player.network_id = None
    engine.log(f"{player.username} left the network {network.name}")
    remaining_members_count = Player.query.filter_by(network_id=network.id).count()
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        shutil.rmtree(f"instance/network_data/{network.id}")
        db.session.delete(network)
    db.session.commit()
    websocket.rest_notify_network_change(engine)


def reorder_facility_priorities(engine: GameEngine, player: Player):
    """Reorders the player's `rest_of_priorities`, `self_consumption_priority`
    and `demand_priorities` according to network prices"""

    def sort_priority(priority_list, prefix="price_"):
        return sorted(priority_list, key=lambda x: getattr(player, prefix + x))

    def sort_scp(scp_list):
        return sorted(scp_list, key=engine.renewables.index)

    rest_list = sort_priority(player.read_list("rest_of_priorities"))
    scp_list = sort_scp(player.read_list("self_consumption_priority"))
    demand_list = sort_priority(player.read_list("demand_priorities"), prefix="price_buy_")
    demand_list.reverse()
    comma = ","
    player.self_consumption_priority = comma.join(scp_list)
    player.rest_of_priorities = comma.join(rest_list)
    player.demand_priorities = comma.join(demand_list)
    db.session.commit()


def set_network_prices(engine: GameEngine, player, updated_prices):
    """Updates network prices for that player"""

    for key, updated_price in updated_prices.items():
        if key not in engine.price_keys or not isinstance(updated_price, (int, float)):
            raise GameException("malformedRequest")
        if updated_price <= -5:
            raise GameException("priceTooLow")

    for key, updated_price in updated_prices.items():
        setattr(player, "price_" + key, updated_price)

    engine.log(f"{player.username} updated their prices")
    reorder_facility_priorities(engine, player)


def change_facility_priority(engine, player, priority):
    """
    This function is executed when the facilities priority is changed either by changing the order in the interactive
    table. The function reassigns the selling prices of the facilities according to the new order.
    """
    old_set = set(
        player.read_list("rest_of_priorities")
        + player.read_list("self_consumption_priority")
        + player.read_list("demand_priorities")
    )
    if old_set != set(priority):
        raise GameException("malformedRequest")
    price_list = [getattr(player, "price_" + facility) for facility in priority]
    prices = dict(zip(priority, sorted(price_list)))
    set_network_prices(engine, player, prices)
