"""Tests for the NetworkPrices class."""

import json
import os
import subprocess
import sys
import textwrap

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.enums import ControllableFacilityType
from energetica.globals import engine
from energetica.utils.map_helpers import confirm_location


def test_price_randomization() -> None:
    """Test that the prices are randomized."""
    # Initialise a fresh engine + map so this test does not depend on state left by whichever
    # test ran before it (it settles tiles 1 & 2, which a prior test may have already occupied).
    create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    engine.random_seed = 0
    account_a = Account(account_id=1, username="player1", pwhash="pwhash", email=None, created_at="")
    account_b = Account(account_id=2, username="player2", pwhash="pwhash", email=None, created_at="")
    player_a = confirm_location(account_a, HexTile.getitem(1))
    player_b = confirm_location(account_b, HexTile.getitem(2))
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
            from energetica.database.map.hex_tile import HexTile
            from energetica.database.player import Player
            from energetica import __version__
            engine.init_instance(30, 3600, 0, env="dev", game_version=__version__)

            engine.random_seed = {seed}
            player = Player(username="player1", pwhash="pwhash", account_id=1, tile=HexTile.getitem(1))
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
