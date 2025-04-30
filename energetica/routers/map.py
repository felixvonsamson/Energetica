from __future__ import annotations

from fastapi import APIRouter

from energetica.schemas.map import HexTileOut

router = APIRouter(prefix="/map", tags=["map"])


@router.get("")
def get_map() -> list[HexTileOut]:
    """Get the map data."""
    from energetica.database.map import HexTile
    from energetica.enums import Fuel, Renewable

    hex_map = HexTile.all()
    hex_list = [
        HexTileOut(
            id=tile.id,
            q=tile.coordinates[0],
            r=tile.coordinates[1],
            solar=tile.potentials[Renewable.SOLAR],
            wind=tile.potentials[Renewable.WIND],
            hydro=tile.potentials[Renewable.HYDRO],
            coal=tile.fuel_reserves[Fuel.COAL],
            gas=tile.fuel_reserves[Fuel.GAS],
            uranium=tile.fuel_reserves[Fuel.URANIUM],
            climate_risk=tile.climate_risk,
            player_id=tile.player.id if tile.player else None,
        )
        for tile in hex_map
    ]
    return hex_list
