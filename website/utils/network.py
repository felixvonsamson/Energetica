"""Util functions relating to networks"""

import pickle
import shutil
from pathlib import Path

import website.api.websocket as websocket
import website.game_engine as game_engine
from website import db
from website.database.engine_data import CapacityData, CircularBufferNetwork
from website.database.player import Network, Player


def join_network(engine, player, network):
    """shared API method to join a network."""
    if network is None:
        return {"response": "noSuchNetwork"}
    if player.network is not None:
        return {"response": "playerAlreadyInNetwork"}
    player.network = network
    db.session.commit()
    engine.data["network_capacities"][network.id].update_network(network)
    engine.log(f"{player.username} joined the network {network.name}")
    websocket.rest_notify_network_change(engine)
    return {"response": "success"}


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
    if len(name) < 3 or len(name) > 40:
        return {"response": "nameLengthInvalid"}
    if Network.query.filter_by(name=name).first() is not None:
        return {"response": "nameAlreadyUsed"}
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
    return {"response": "success"}


def leave_network(engine, player):
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        return {"response": "playerNotInNetwork"}
    player.network_id = None
    remaining_members_count = Player.query.filter_by(network_id=network.id).count()
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        shutil.rmtree(f"instance/network_data/{network.id}")
        db.session.delete(network)
    db.session.commit()
    engine.log(f"{player.username} left the network {network.name}")
    websocket.rest_notify_network_change(engine)
    return {"response": "success"}


def reorder_facility_priorities(engine: game_engine.GameEngine, player: Player):
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


def set_network_prices(engine, player, updated_prices):
    """Updates network prices for that player"""

    for key, updated_price in updated_prices.items():
        if updated_price <= -5:
            return {"response": "priceTooLow"}
        setattr(player, key, updated_price)

    engine.log(f"{player.username} updated their prices")
    reorder_facility_priorities(engine, player)
    return {"response": "success"}


def change_facility_priority(engine, player, priority):
    """
    This function is executed when the facilities priority is changed either by changing the order in the interactive
    table. The function reassigns the selling prices of the facilities according to the new order.
    """
    price_list = []
    for facility in priority:
        price_list.append(getattr(player, "price_" + facility))
    price_list.sort()
    prices = {}
    for i, facility in enumerate(priority):
        prices["price_" + facility] = price_list[i]
    return set_network_prices(engine, player, prices)
