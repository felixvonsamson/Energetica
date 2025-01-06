"""Utility functions relating to networks."""

import shutil

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
    engine.log(f"{player.username} created the network {name}")
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change()
    return new_network


# TODO (Felix): Move this to a method in Player
# TODO(mglst): I'm not sure I agree. Why should this not be a method of Network for example?
def leave_network(player: Player) -> None:
    """Shared API method for a player to leave a network. Always succeeds."""
    network = player.network
    if network is None:
        raise GameError("notInNetwork")
    player.network = None
    network.members.remove(player)
    engine.log(f"{player.username} left the network {network.name}")
    remaining_members_count = len(list(Player.filter(lambda p: p.network is not None and p.network == network)))
    # delete network if it is empty
    if remaining_members_count == 0:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        shutil.rmtree(f"instance/network_data/{network.id}")
        network.delete()
    # import energetica.api.websocket as websocket
    # websocket.rest_notify_network_change()
