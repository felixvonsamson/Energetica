"""Routes for the map."""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.map.hex_tile import HexTile
from energetica.database.user import User
from energetica.schemas.map import SettleRequest, SettleResponse
from energetica.schemas.map import HexTileOut
from energetica.utils import map_helpers
from energetica.utils.auth import get_playing_user

router = APIRouter(prefix="/map", tags=["Map"])


@router.get("")
def get_map() -> list[HexTileOut]:
    """Get the map data."""
    from energetica.database.map.hex_tile import HexTile
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


@router.post("/settle")
def settle_region(
    user: Annotated[User, Depends(get_playing_user)],
    request_data: SettleRequest,
) -> SettleResponse:
    if user.player is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has a player")
    region = HexTile.getitem(
        request_data.region_id,
        error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Region not found"),
    )
    player = map_helpers.confirm_location(user, region)
    # Returning player_id will probably be useful for debugging in the future
    return SettleResponse(player_id=player.id)
