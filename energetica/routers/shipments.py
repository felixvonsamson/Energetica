"""Routes for shipments."""

from typing import Annotated

from fastapi import APIRouter, Depends

from energetica.utils.auth import get_current_user
from energetica.database.player import Player
from energetica.database.shipment import OngoingShipment
from energetica.schemas.shipments import ShipmentListOut, ShipmentOut

router = APIRouter(prefix="/shipments", tags=["Shipment"])


@router.get("")
def get_shipments(
    player: Annotated[Player, Depends(get_current_user)],
) -> ShipmentListOut:
    shipments = [ShipmentOut.from_shipment(shipment) for shipment in OngoingShipment.filter_by(player=player)]
    return ShipmentListOut(shipments=shipments)
