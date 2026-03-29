"""Tests for the NetworkPrices class."""

import json
import os
import subprocess
import sys
import textwrap

from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.enums import ControllableFacilityType
from energetica.globals import engine
from energetica.utils.map_helpers import confirm_location


def test_price_randomization() -> None:
    """Test that the prices are randomized."""
    engine.random_seed = 0
    user_a = User("player1", "pwhash", role="player")
    user_b = User("player2", "pwhash", role="player")
    player_a = confirm_location(user_a, HexTile.getitem(1))
    player_b = confirm_location(user_b, HexTile.getitem(2))
    assert (
        player_a.network_prices.ask_prices[ControllableFacilityType.COAL_BURNER]
        != player_b.network_prices.ask_prices[ControllableFacilityType.COAL_BURNER]
    )


def test_seed_determinism() -> None:
    """Test that prices are stable across processes for a fixed seed."""

    def run_seeded_subprocess(seed: int) -> dict:
        """Runs the price generation logic in a subprocess with the given seed and returns the result."""
        subprocess_code = textwrap.dedent(f"""
            import json
            from energetica import engine
            from energetica.database.player import Player
            from energetica import __version__
            engine.init_instance(30, 3600, 0, env="dev", game_version=__version__)
            
            engine.random_seed = {seed}
            player = Player("player1", "pwhash")
            result = {{
                "bid": player.network_prices.bid_prices,
                "ask": player.network_prices.ask_prices,
            }}
            print(json.dumps(result))
        """)

        result = subprocess.run(
            [sys.executable, "-c", subprocess_code],
            capture_output=True,
            text=True,
            env={**os.environ},
        )

        if result.returncode != 0:
            raise RuntimeError(f"Subprocess failed:\n{result.stderr}")

        # Only parse the last line of stdout as JSON
        json_output = result.stdout.strip().split("\n")[-1]
        return json.loads(json_output)

    seed = 42
    results = [run_seeded_subprocess(seed) for _ in range(2)]

    first = results[0]
    for i, res in enumerate(results[1:], start=1):
        assert res == first, f"Mismatch in subprocess {i}: {res} != {first}"
