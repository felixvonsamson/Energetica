"""Utility functions relating to electricity market networks."""

from energetica.database.network import Network
from energetica.database.player import Player
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine


# TODO (Felix): Move this to a method in Player
def join_network(player: Player, network: Network | None) -> Network:
    """Add a player to a network."""
    if not player.achievements["network"]:
        raise GameError(GameExceptionType.NETWORK_NOT_UNLOCKED)
    if network is None:
        # TODO(mglst): this logic should be handled by the router so that it can return a relevant HTTP error code such
        # as HTTP_404_NOT_FOUND
        raise GameError(GameExceptionType.NO_SUCH_NETWORK)
    if player.network is not None:
        leave_network(player)
    player.network = network
    network.members.append(player)
    network.capacities.update_network(network)
    engine.log(f"{player.username} joined the network {network.name}")

    # Invalidate electricity markets list for all players (membership changed)
    engine.invalidate_queries(["electricity-markets"])

    return network


def create_network(player: Player, name: str) -> Network:
    """
    Create a network.

    Network name must pass validation, namely it must not be too long, nor too short, and must not already be in use.
    """
    if not player.achievements["network"]:
        raise GameError(GameExceptionType.NETWORK_NOT_UNLOCKED)
    if len(list(Network.filter_by(name=name))):
        raise GameError(GameExceptionType.NAME_ALREADY_USED)
    if player.network is not None:
        leave_network(player)
    new_network = Network(name=name, members=[player], created_tick=engine.total_t)
    player.network = new_network
    engine.log(f"{player.username} created the network {name}")

    # Invalidate electricity markets list for all players (new market created)
    engine.invalidate_queries(["electricity-markets"])

    return new_network


def leave_network(player: Player) -> Network | None:
    """Make a player leave their network."""
    network = player.network
    if network is None:
        raise GameError(GameExceptionType.NOT_IN_NETWORK)
    player.network = None
    network.members.remove(player)
    engine.log(f"{player.username} left the network {network.name}")

    # Invalidate electricity markets list for all players (membership changed)
    engine.invalidate_queries(["electricity-markets"])

    # delete network if it is empty
    if not network.members:
        engine.log(f"The network {network.name} has been deleted because it was empty")
        network.delete()
        return None

    return network
