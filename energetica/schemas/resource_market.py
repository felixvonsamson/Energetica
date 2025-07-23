"""Schemas for API routes for the resource market."""

from __future__ import annotations

from pydantic import BaseModel, Field

from energetica.database.resource_on_sale import ResourceOnSale
from energetica.enums import Fuel

# TODO: Add units to descriptions


class AskBase(BaseModel):
    """Schema for creating an ask in the resource market."""

    resource_type: Fuel
    unit_price: float = Field(gt=0, description="Unit price of the resource per kg.")
    quantity: float = Field(gt=0, description="Quantity of the resource in kg.")


class AskOut(AskBase):
    """Schema for an ask in the resource market."""

    id: int = Field(description="ID of the ask in the resource market.")

    @classmethod
    def from_resource_on_sale(cls, resource_on_sale: ResourceOnSale) -> AskOut:
        return AskOut(
            id=resource_on_sale.id,
            resource_type=resource_on_sale.resource,
            unit_price=resource_on_sale.unit_price,
            quantity=resource_on_sale.quantity,
        )


class AskCreate(AskBase):
    """Schema for creating an ask in the resource market."""

    pass


class AskPatch(BaseModel):
    """Schema for a patch in the resource market."""

    unit_price: float = Field(gt=0, description="Unit price of the resource per kg.")
    quantity: float = Field(gt=0, description="Quantity of the resource in kg.")


class AskListOut(BaseModel):
    """Schema for the resource market."""

    asks: list[AskOut]


class PurchaseOrderCreate(BaseModel):
    """Schema for a purchase order in the resource market."""

    quantity: float = Field(gt=0, description="Quantity of the resource in kg.")
