"""Routes for shipments."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.database.ongoing_shipment import OngoingShipment
from energetica.database.player import Player
from energetica.schemas.shipments import ShipmentListOut, ShipmentOut
from energetica.utils.auth import get_current_user

router = APIRouter(prefix="/shipments", tags=["Shipment"])


@router.get("")
def get_shipments(
    player: Annotated[Player, Depends(get_current_user)],
) -> ShipmentListOut:
    shipments = [ShipmentOut.from_shipment(shipment) for shipment in OngoingShipment.filter_by(player=player)]
    return ShipmentListOut(shipments=shipments)
