"""Tests for the NetworkPrices class."""

import json
import os
import subprocess
import sys
import textwrap

from energetica.database.engine_data import NetworkPrices
from energetica.database.player import Player
from energetica.enums import ControllableFacilityType, HydroFacilityType, SolarFacilityType, WindFacilityType
from energetica.globals import engine


def test_renewables_order() -> None:
    """
    Test that the renewable bids in the right order.

    This order was determined by Felix, according to what looks best for the frontend.
    """
    network_prices = NetworkPrices()
    network_prices.renewable_bids.append(WindFacilityType.OFFSHORE_WIND_TURBINE)
    network_prices.renewable_bids.append(SolarFacilityType.PV_SOLAR)
    network_prices.renewable_bids.append(HydroFacilityType.SMALL_WATER_DAM)
    network_prices.renewable_bids.append(WindFacilityType.WINDMILL)
    network_prices.renewable_bids.append(WindFacilityType.ONSHORE_WIND_TURBINE)
    network_prices.renewable_bids.append(HydroFacilityType.WATERMILL)
    network_prices.renewable_bids.append(HydroFacilityType.LARGE_WATER_DAM)
    network_prices.renewable_bids.append(SolarFacilityType.CSP_SOLAR)

    assert network_prices.get_sorted_renewables() == [
        HydroFacilityType.SMALL_WATER_DAM,
        HydroFacilityType.LARGE_WATER_DAM,
        HydroFacilityType.WATERMILL,
        WindFacilityType.ONSHORE_WIND_TURBINE,
        WindFacilityType.OFFSHORE_WIND_TURBINE,
        WindFacilityType.WINDMILL,
        SolarFacilityType.CSP_SOLAR,
        SolarFacilityType.PV_SOLAR,
    ]


def test_price_randomization() -> None:
    """Test that the prices are randomized."""
    engine.random_seed = 0
    player_a = Player("player1", "pwhash")
    player_b = Player("player2", "pwhash")
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
