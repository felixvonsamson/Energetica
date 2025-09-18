"""Test upgrading active facilities."""

from energetica import create_app
from energetica.database.active_facility import ActiveFacility
from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.enums import (
    TechnologyType,
    WindFacilityType,
)
from energetica.init_test_players import add_asset
from energetica.utils.assets import upgrade_facility
from energetica.utils.auth import generate_password_hash
from energetica.utils.map_helpers import confirm_location
from energetica.utils.tick_execution import tick


def test_upgrading_active_facilities() -> None:
    """
    Test upgrading active facilities.

    See https://github.com/felixvonsamson/Energetica/issues/371
    """
    create_app(rm_instance=True, skip_adding_handlers=True, env="dev")
    user1 = User(username="username", pwhash=generate_password_hash("password"), role="player")
    hex_tile = HexTile.getitem(1)
    player1 = confirm_location(user1, hex_tile)

    add_asset(player1, TechnologyType.PHYSICS, 6)
    add_asset(player1, TechnologyType.AERODYNAMICS, 1)
    add_asset(player1, TechnologyType.MATERIALS, 4)
    add_asset(player1, TechnologyType.THERMODYNAMICS, 5)
    add_asset(player1, TechnologyType.CHEMISTRY, 3)
    add_asset(player1, TechnologyType.CIVIL_ENGINEERING, 1)

    add_asset(player1, WindFacilityType.ONSHORE_WIND_TURBINE, 1)

    add_asset(player1, TechnologyType.AERODYNAMICS, 1)

    player1.money = 1_000_000_000

    tick()

    offshore_wind_turbine = next(
        ActiveFacility.filter_by(
            player=player1,
            facility_type=WindFacilityType.ONSHORE_WIND_TURBINE,
        ),
    )
    upgrade_facility(offshore_wind_turbine)
    assert offshore_wind_turbine.is_upgradable is False
