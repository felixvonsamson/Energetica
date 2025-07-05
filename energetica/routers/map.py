"""Routes for the map."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from energetica.auth import get_current_user
from energetica.database.map import HexTile
from energetica.database.player import Player
from energetica.schemas.map import HexTileOut
from energetica.utils import map_helpers

router = APIRouter(prefix="/map", tags=["Map"])


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


@router.post("/{region_id}:settle", status_code=204)
def settle_region(
    user: Annotated[Player, Depends(get_current_user)],
    region_id: int,
) -> None:
    region = HexTile.getitem(region_id, error=HTTPException(status_code=404, detail="Region not found"))
    map_helpers.confirm_location(user, region)
