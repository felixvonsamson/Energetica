from pydantic import BaseModel, Field

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


class AskCreate(AskBase):
    """Schema for creating an ask in the resource market."""

    pass


class AskPatch(BaseModel):
    """Schema for a patch in the resource market."""

    unit_price: float = Field(gt=0, description="Unit price of the resource per kg.")
    quantity: float = Field(gt=0, description="Quantity of the resource in kg.")


class AskList(BaseModel):
    """Schema for the resource market."""

    asks: list[AskOut]


class PurchaseOrderCreate(BaseModel):
    """Schema for a purchase order in the resource market."""

    quantity: float = Field(gt=0, description="Quantity of the resource in kg.")
