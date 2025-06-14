"""Routes for shipments."""

# from typing import Annotated

# from fastapi import APIRouter, Depends

# from energetica.auth import get_current_user
# from energetica.database.player import Player
# from energetica.database.shipment import OngoingShipment
# from energetica.schemas.shipments import ShipmentList

# router = APIRouter(prefix="/shipments", tags=["Shipment"])


# @router.get("")
# def get_shipments(
#     user: Annotated[Player, Depends(get_current_user)],
# ) -> ShipmentList:
#     return ShipmentList(shipments=[shipment.to_schema() for shipment in OngoingShipment.filter_by(player=user)])
