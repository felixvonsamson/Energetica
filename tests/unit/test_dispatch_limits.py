"""Characterization of the output limits ``calculate_prod`` puts on a controllable or storage facility (#1099).

A facility's output for one tick is bounded by how fast it can ramp from its previous output, by its power,
and by what it can draw on: fuel in the player's stock for a fuel-burning facility, or stored energy (or free
storage room when charging) for a storage facility. These tests pin the persistent world's results with a real
player. Expected values are worked out from the player's own capacities, so a rebalance of facility power
or ramping time does not break them.
"""

from __future__ import annotations

import pytest

from energetica import create_app
from energetica.accounts import Account
from energetica.database.map.hex_tile import HexTile
from energetica.database.player import Player
from energetica.enums import ControllableFacilityType, Fuel, StorageFacilityType
from energetica.globals import engine
from energetica.init_test_players import add_asset
from energetica.production_update import calculate_prod
from energetica.utils.map_helpers import confirm_location

COAL = ControllableFacilityType.COAL_BURNER
BATTERY = StorageFacilityType.LITHIUM_ION_BATTERIES

PREVIOUS_COAL_OUTPUT = 2_000_000.0
PREVIOUS_BATTERY_OUTPUT = 3_000_000.0
PREVIOUS_BATTERY_INTAKE = 4_000_000.0
STORED_ENERGY = 1_000_000.0


@pytest.fixture
def player() -> Player:
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    account = Account(account_id=1, username="dispatch", pwhash="pwhash", email=None, created_at="")
    p = confirm_location(account, HexTile.getitem(1))
    add_asset(p, COAL, 1)
    add_asset(p, BATTERY, 1)
    p.resources[Fuel.COAL] = 1e12
    p.rolling_history._data["generation"][COAL][-1] = PREVIOUS_COAL_OUTPUT
    p.rolling_history._data["generation"][BATTERY][-1] = PREVIOUS_BATTERY_OUTPUT
    p.rolling_history._data["demand"][BATTERY][-1] = PREVIOUS_BATTERY_INTAKE
    p.rolling_history._data["storage"][BATTERY][-1] = STORED_ENERGY
    return p


def _reservations() -> dict[Fuel, float]:
    return {fuel: 0.0 for fuel in Fuel}


def _ramping_speed(p: Player, facility: str) -> float:
    return (
        p.capacities[facility]["power"]
        / engine.const_config["assets"][facility]["ramping_time"]
        * (engine.in_game_seconds_per_tick)
    )


def _storage_limit(energy: float, p: Player, facility: str) -> float:
    energy_capacity = max(0.0, energy) * 3600 / engine.in_game_seconds_per_tick
    energy_capacity *= p.capacities[facility]["efficiency"] ** 0.5
    return max(0.0, min(energy_capacity, (2 * energy_capacity * _ramping_speed(p, facility)) ** 0.5))


def test_fuel_facility_max_is_bounded_by_ramping_and_power(player: Player) -> None:
    power = player.capacities[COAL]["power"]
    ramp = _ramping_speed(player, COAL)

    result = calculate_prod("max", player, COAL, _reservations())

    assert result == pytest.approx(min(PREVIOUS_COAL_OUTPUT + ramp, power))


def test_fuel_facility_min_is_what_it_cannot_ramp_below(player: Player) -> None:
    ramp = _ramping_speed(player, COAL)

    result = calculate_prod("min", player, COAL, _reservations())

    assert result == pytest.approx(max(0.0, PREVIOUS_COAL_OUTPUT - ramp))
    assert result > 0, "this scenario is meant to leave the facility with must-run output"


def test_fuel_facility_max_is_bounded_by_the_fuel_left_after_sales_and_reservations(player: Player) -> None:
    power = player.capacities[COAL]["power"]
    burn_per_tick = player.capacities[COAL]["fuel_use"][Fuel.COAL]
    fuel_for_one_twentieth = burn_per_tick / 20
    player.resources[Fuel.COAL] = fuel_for_one_twentieth + 30.0
    player.resources_on_sale[Fuel.COAL] = 20.0
    reservations = _reservations()
    reservations[Fuel.COAL] = 10.0

    result = calculate_prod("max", player, COAL, reservations)

    assert result == pytest.approx(power / 20)
    assert result < PREVIOUS_COAL_OUTPUT + _ramping_speed(player, COAL), "fuel, not ramping, must be the binding limit"


def test_producing_reserves_fuel_in_proportion_to_output(player: Player) -> None:
    power = player.capacities[COAL]["power"]
    burn_per_tick = player.capacities[COAL]["fuel_use"][Fuel.COAL]
    reservations = _reservations()

    result = calculate_prod("max", player, COAL, reservations)

    assert reservations[Fuel.COAL] == pytest.approx(burn_per_tick * result / power)


def test_a_facility_with_no_fuel_cannot_produce(player: Player) -> None:
    player.resources[Fuel.COAL] = 0.0
    reservations = _reservations()

    assert calculate_prod("max", player, COAL, reservations) == 0.0
    assert calculate_prod("min", player, COAL, reservations) == 0.0


def test_storage_discharge_is_bounded_by_stored_energy(player: Player) -> None:
    power = player.capacities[BATTERY]["power"]
    ramp = _ramping_speed(player, BATTERY)
    limit = _storage_limit(STORED_ENERGY, player, BATTERY)

    maximum = calculate_prod("max", player, BATTERY, _reservations())
    minimum = calculate_prod("min", player, BATTERY, _reservations())

    assert maximum == pytest.approx(min(limit, PREVIOUS_BATTERY_OUTPUT + ramp, power))
    assert minimum == pytest.approx(max(0.0, min(limit, PREVIOUS_BATTERY_OUTPUT - ramp, power)))


def test_storage_charging_is_bounded_by_free_room_and_previous_intake(player: Player) -> None:
    power = player.capacities[BATTERY]["power"]
    ramp = _ramping_speed(player, BATTERY)
    room = player.capacities[BATTERY]["capacity"] - STORED_ENERGY
    limit = _storage_limit(room, player, BATTERY)

    result = calculate_prod("max", player, BATTERY, None, filling=True)

    assert result == pytest.approx(min(limit, PREVIOUS_BATTERY_INTAKE + ramp, power))


def test_a_full_battery_cannot_charge(player: Player) -> None:
    player.rolling_history._data["storage"][BATTERY][-1] = player.capacities[BATTERY]["capacity"]

    assert calculate_prod("max", player, BATTERY, None, filling=True) == 0.0


def test_an_empty_battery_cannot_discharge(player: Player) -> None:
    player.rolling_history._data["storage"][BATTERY][-1] = 0.0

    assert calculate_prod("max", player, BATTERY, _reservations()) == 0.0
