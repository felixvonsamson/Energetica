"""Run a list of policies with one player per policy"""

from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.globals import engine
from energetica.simulate import tick
from energetica.utils import misc
from tests.policy import Policy


def run_policies(policies: list[Policy]) -> list[Player]:
    """Run a list of policies with one player per policy"""
    engine.init_instance(30, 240, 0)
    players = [Player(f"player_{i}", "password_hash") for i in range(len(policies))]
    for player in players:
        misc.confirm_location(player, HexTile.getitem(player.id))
    for tick_count in range(1, 100):
        for player, policy in zip(players, policies):
            policy.take_action(player, engine)
        tick()
        print(f"Tick {tick_count}")
        if all(policy.is_done for policy in policies):
            print("All policies are done")
            break
    return players
