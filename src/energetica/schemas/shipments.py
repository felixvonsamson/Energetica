"""Schemas for API routes for shipments."""

from __future__ import annotations

from pydantic import BaseModel, Field

from energetica.enums import Fuel
from energetica.freeplay.database.ongoing_shipment import OngoingShipment


class ShipmentBase(BaseModel):
    resource: Fuel = Field(description="The kind of fuel being shipped")
    quantity: float = Field(gt=0, description="The amount of the fuel being shipped, in kg")


class ShipmentOut(ShipmentBase):
    id: int
    arrival_tick: float = Field(gt=0)
    duration: float
    speed: float

    @classmethod
    def from_shipment(cls, shipment: OngoingShipment) -> ShipmentOut:
        return ShipmentOut(
            id=shipment.id,
            resource=shipment.resource,
            quantity=shipment.quantity,
            arrival_tick=shipment.arrival_tick,
            duration=shipment.duration,
            speed=shipment.speed,
        )


class ShipmentListOut(BaseModel):
    shipments: list[ShipmentOut] = Field(description="List of shipments")
