"""Utility functions relating to electricity market networks."""

from energetica.database.network import Network
from energetica.database.player import Player
from energetica.game_error import GameError
from energetica.globals import engine


# TODO (Felix): Move this to a method in Player
def join_network(player: Player, network: Network | None) -> Network:
    """Add a player to a network."""
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
    return network


def create_network(player: Player, name: str) -> Network:
    """
    Create a network.

    Network name must pass validation, namely it must not be too long, nor too short, and must not already be in use.
    """
    if not player.achievements["network"]:
        raise GameError("networkNotUnlocked")
    if len(list(Network.filter_by(name=name))):
        raise GameError("nameAlreadyUsed")
    new_network = Network(name=name, members=[player])
    player.network = new_network
    engine.log(f"{player.username} created the network {name}")
    return new_network


def leave_network(player: Player) -> Network | None:
    """Make a player leave their network."""
    network = player.network
    if network is None:
        raise GameError("notInNetwork")
    player.network = None
    network.members.remove(player)
    engine.log(f"{player.username} left the network {network.name}")
    # delete network if it is empty
    if not network.members:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        network.delete()
        return None
    return network
