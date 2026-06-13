"""Tests for storage facility decommissioning logic.

Regression tests for https://github.com/felixvonsamson/Energetica/issues/762
"""

from energetica import create_app
from energetica.database.active_facility import ActiveFacility
from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.enums import StorageFacilityType
from energetica.init_test_players import add_asset
from energetica.utils.auth import generate_password_hash
from energetica.utils.facilities import dismantle_facility
from energetica.utils.map_helpers import confirm_location
from energetica.utils.tick_execution import tick

STORAGE_TYPE = StorageFacilityType.LITHIUM_ION_BATTERIES


def _make_player(username: str):
    user = User(username=username, pwhash=generate_password_hash("password"), role="player", account_id=1)
    hex_tile = HexTile.getitem(1)
    return confirm_location(user, hex_tile)


def test_empty_decommissioning_facility_is_removed():
    """
    A decommissioning storage facility with 0 stored energy and no remaining
    active capacity must be removed on the next tick.

    Bug: `stored_energy < available_capacity` → `0 < 0` = False → never removed.
    Fix: `stored_energy <= available_capacity` → `0 <= 0` = True → removed.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    player = _make_player("decomm_empty")

    add_asset(player, STORAGE_TYPE, 1)
    facility = next(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))

    dismantle_facility(facility)

    assert facility.decommissioning is True
    assert player.rolling_history.get_last_data("storage", STORAGE_TYPE) == 0.0
    assert player.capacities[STORAGE_TYPE]["capacity"] == 0.0

    tick()

    remaining = list(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))
    assert remaining == [], "Empty decommissioning facility should be removed on tick"


def test_decommissioning_facility_stays_while_stored_energy_exceeds_remaining_capacity():
    """
    A decommissioning storage facility must NOT be removed while the stored
    energy would not fit into the remaining active facilities.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    player = _make_player("decomm_overflow")

    add_asset(player, STORAGE_TYPE, 2)
    facilities = list(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))
    assert len(facilities) == 2

    single_capacity = facilities[0].storage_capacity

    # Store 1.5× the capacity of one facility — more than can fit in the remaining one
    player.rolling_history._data["storage"][STORAGE_TYPE][-1] = single_capacity * 1.5

    dismantle_facility(facilities[0])

    remaining_capacity = player.capacities[STORAGE_TYPE]["capacity"]
    assert remaining_capacity == single_capacity

    # The decommissioning check runs before production_update in tick(), so
    # stored_energy (1.5c) > remaining_capacity (c) → facility must stay.
    tick()

    alive = list(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))
    assert len(alive) == 2, "Facility should not be removed while stored energy > remaining capacity"


def test_decommissioning_facility_removed_when_energy_fits_in_remaining_capacity():
    """
    A decommissioning storage facility must be removed when the stored energy
    fits entirely within the remaining active facilities.
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    player = _make_player("decomm_fits")

    add_asset(player, STORAGE_TYPE, 2)
    facilities = list(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))

    # Leave stored energy at 0 (default) — fits in the remaining facility
    dismantle_facility(facilities[0])

    remaining_capacity = player.capacities[STORAGE_TYPE]["capacity"]
    assert remaining_capacity > 0

    tick()

    alive = list(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))
    assert len(alive) == 1, "Decommissioning facility should be removed when stored energy fits"
    assert alive[0].decommissioning is False


def test_decommissioning_facility_state_of_charge_is_finite():
    """
    A decommissioning facility with 0 active capacity must not expose np.inf
    as usage/state_of_charge — it should compute SoC from its own capacity.
    """
    from math import isfinite

    from energetica.production_update import set_facilities_usage
    from energetica.schemas.facilities import StorageFacilityOut

    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    player = _make_player("decomm_soc")

    add_asset(player, STORAGE_TYPE, 1)
    facility = next(ActiveFacility.filter_by(player=player, facility_type=STORAGE_TYPE))
    capacity = facility.storage_capacity

    # Store 60% of the facility's capacity
    player.rolling_history._data["storage"][STORAGE_TYPE][-1] = capacity * 0.6
    dismantle_facility(facility)
    assert player.capacities[STORAGE_TYPE]["capacity"] == 0.0

    # Simulate the usage update that runs during production_update
    new_values = player.rolling_history.init_new_data()
    set_facilities_usage(new_values, player)

    out = StorageFacilityOut.from_active_facility(facility)
    assert isfinite(out.state_of_charge), "state_of_charge must be finite, not inf"
    assert 0.0 <= out.state_of_charge <= 1.0, "state_of_charge must be in [0, 1]"
    assert out.decommissioning is True
