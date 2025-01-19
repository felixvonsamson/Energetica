from energetica import engine
from energetica.database.engine_data import NetworkPrices
from energetica.database.player import Player
from energetica.game_error import GameError


def test_blank_network_prices():
    """Test that the NetworkPrices class is initialized with the correct attributes."""
    network_prices = NetworkPrices()
    assert not network_prices.renewable_bids
    assert not network_prices.ask_prices.keys()
    assert not network_prices.bid_prices.keys()


def test_default_player_network_prices():
    """Test that the NetworkPrices class is initialized with the correct attributes."""
    engine.data["random_seed"] = 0
    player = Player("player1", "pwhash")
    assert not player.network_prices.renewable_bids
    assert player.network_prices.ask_prices.keys() == {"industry", "construction"}
    assert player.network_prices.bid_prices.keys() == {"steam_engine"}


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


def test_add_bogus_names():
    """Test that adding a bogus ask or bid price raises an error."""
    engine.data["random_seed"] = 0
    player = Player("player1", "pwhash")

    try:
        player.network_prices.create_ask_entry("bogus", player)
    except KeyError:
        assert True
    else:
        assert False

    try:
        player.network_prices.create_bid_entry("bogus", player)
    except KeyError:
        assert True
    else:
        assert False


def test_update_bogus_prices():
    """Test that updating a bogus ask or bid price raises an error."""
    network_prices = NetworkPrices()

    network_prices.update(updated_asks={"industry": -4.999}, updated_bids={})
    try:
        network_prices.update(updated_asks={"industry": -5}, updated_bids={})
    except GameError:
        assert True
    else:
        assert False


def test_add_bid_and_ask_prices():
    """Test that adding a bid and ask price works."""
    engine.data["random_seed"] = 0
    player = Player("player1", "pwhash")
    player.network_prices.create_ask_entry("coal_mine", player)
    player.network_prices.create_bid_entry("gas_burner", player)
    assert "coal_mine" in player.network_prices.ask_prices
    assert "gas_burner" in player.network_prices.bid_prices


def test_price_randomization():
    """Test that the prices are randomized."""
    engine.data["random_seed"] = 0
    player_a = Player("player1", "pwhash")
    player_b = Player("player2", "pwhash")
    player_a.network_prices.create_bid_entry("coal_burner", player_a)
    player_b.network_prices.create_bid_entry("coal_burner", player_b)
    assert player_a.network_prices.bid_prices["coal_burner"] != player_b.network_prices.bid_prices["coal_burner"]
