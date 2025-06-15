"""Run a list of policies with one player per policy."""

from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.enums import Renewable
from energetica.globals import engine
from energetica.simulate import tick
from energetica.utils import map_helpers
from tests.policy import Policy


def run_policies(policies: list[Policy], ticks_to_run: int) -> None:
    """Run a list of policies with one player per policy."""
    engine.init_instance(30, 3600, 0, env="dev")
    players = [Player(f"player_{i}", "password_hash") for i in range(len(policies))]
    for player in players:
        # tile = HexTile.getitem(player.id)
        # tile = HexTile.getitem(53)
        # tile = max(HexTile.all(), key=lambda t: t.potentials[Renewable.HYDRO])
        # tile = max(HexTile.all(), key=lambda t: t.potentials[Renewable.WIND])
        tile = max(HexTile.all(), key=lambda t: t.potentials[Renewable.WIND] * t.potentials[Renewable.HYDRO])
        map_helpers.confirm_location(player, tile)
        assert player.tile is not None
        print(f"Player {player.id} is at {player.tile}")
        for renewable in Renewable:
            print(f"{renewable}: {player.tile.potentials[renewable]}")
    for tick_count in range(1, ticks_to_run + 1):
        for player, policy in zip(players, policies):
            if not policy.is_done:
                policy.take_action(player)
        tick()
        # print(f"Tick {tick_count}")
        if all(policy.is_done for policy in policies):
            print("All policies are done")
            break
