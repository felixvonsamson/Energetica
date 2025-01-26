"""Tests for the NetworkPrices class."""

from energetica import engine
from energetica.database.engine_data import NetworkPrices
from energetica.database.player import Player
from energetica.enums import FunctionalFacilityType
from energetica.game_error import GameError


def test_renewables_order():
    """Test that the renewable bids in the right order."""
    network_prices = NetworkPrices()
    network_prices.renewable_bids.append("offshore_wind_turbine")
    network_prices.renewable_bids.append("PV_solar")
    network_prices.renewable_bids.append("small_water_dam")
    network_prices.renewable_bids.append("windmill")
    network_prices.renewable_bids.append("onshore_wind_turbine")
    network_prices.renewable_bids.append("watermill")
    network_prices.renewable_bids.append("large_water_dam")
    network_prices.renewable_bids.append("CSP_solar")

    assert network_prices.get_sorted_renewables() == [
        "small_water_dam",
        "large_water_dam",
        "watermill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
        "windmill",
        "CSP_solar",
        "PV_solar",
    ]


def test_update_bogus_prices():
    """Test that updating a bogus ask or bid price raises an error."""
    network_prices = NetworkPrices()

    network_prices.update(updated_asks={FunctionalFacilityType.INDUSTRY: -4.999}, updated_bids={})
    try:
        network_prices.update(updated_asks={FunctionalFacilityType.INDUSTRY: -5}, updated_bids={})
    except GameError:
        assert True
    else:
        assert False


def test_price_randomization():
    """Test that the prices are randomized."""
    engine.random_seed = 0
    player_a = Player("player1", "pwhash")
    player_b = Player("player2", "pwhash")
    assert player_a.network_prices.bid_prices["coal_burner"] != player_b.network_prices.bid_prices["coal_burner"]
