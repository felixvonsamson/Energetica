from pydantic import BaseModel, Field

from energetica.enums import Fuel


class ShipmentBase(BaseModel):
    resource: Fuel = Field(description="The kind of fuel being shipped")
    quantity: float = Field(gt=0, description="The amount of the fuel being shipped, in kg")


class ShipmentOut(ShipmentBase):
    id: int
    arrival_tick: float = Field(gt=0)
    duration: float


class ShipmentList(BaseModel):
    shipments: list[ShipmentOut] = Field(description="List of shipments")
