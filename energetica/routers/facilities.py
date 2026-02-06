"""Routes for facilities."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.active_facility import ActiveFacility
from energetica.database.player import Player
from energetica.enums import ExtractionFacilityType, PowerFacilityType, StorageFacilityType
from energetica.schemas.facilities import FacilitiesListOut, FacilityStatuses
from energetica.schemas.players import MoneyOut
from energetica.utils import facilities
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/facilities", tags=["Facilities"])


@router.get("")
def get_active_facilities(
    player: Annotated[Player, Depends(get_settled_player)],
) -> FacilitiesListOut:
    """Get the active facilities for this player."""
    return FacilitiesListOut.from_player(player)


@router.post("/{facility_id}:upgrade")
def upgrade_facility(
    player: Annotated[Player, Depends(get_settled_player)],
    facility_id: int,
) -> MoneyOut:
    """Upgrade a facility."""
    facility = ActiveFacility.getitem(facility_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if facility.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    facilities.upgrade_facility(facility=facility)
    return MoneyOut.from_player(player)


@router.post(":upgrade-all")
async def upgrade_all_of_type(
    player: Annotated[Player, Depends(get_settled_player)],
    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
) -> MoneyOut:
    """Upgrade all facilities of a certain type."""
    facilities.upgrade_all_facilities(player=player, facility_type=facility_type)
    return MoneyOut.from_player(player)


@router.post("/{facility_id}:dismantle")
async def dismantle_facility(
    player: Annotated[Player, Depends(get_settled_player)],
    facility_id: int,
) -> MoneyOut:
    """Dismantle a facility."""
    facility = ActiveFacility.getitem(facility_id, HTTPException(status_code=status.HTTP_404_NOT_FOUND))
    if facility.player != player:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    facilities.dismantle_facility(facility=facility)
    return MoneyOut.from_player(player)


@router.post(":dismantle-all")
async def dismantle_all_of_type(
    player: Annotated[Player, Depends(get_settled_player)],
    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
) -> MoneyOut:
    """Dismantle all facilities of a certain type."""
    facilities.dismantle_all_facilities(player=player, facility_type=facility_type)
    return MoneyOut.from_player(player)


@router.get("/statuses")
async def facility_statuses(player: Annotated[Player, Depends(get_settled_player)]) -> FacilityStatuses:
    """Statuses for the players facilities: renewables, producing and consuming facilities."""
    return FacilityStatuses.from_player(player)
