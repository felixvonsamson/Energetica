"""Schemas for API routes for electricity markets."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import BaseModel, Field

from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    FunctionalFacilityType,
    NonFacilityBidType,
    StorageFacilityType,
)

if TYPE_CHECKING:
    from energetica.database.network import Network


class ElectricityMarketBase(BaseModel):
    name: str = Field(min_length=3, max_length=40, description="Name of the electricity market")


class ElectricityMarketOut(ElectricityMarketBase):
    id: int = Field(description="ID of the electricity market")
    member_ids: list[int] = Field(description="List of player IDs in the electricity market")

    @classmethod
    def from_network(cls, network: Network) -> ElectricityMarketOut:
        return ElectricityMarketOut(
            id=network.id, name=network.name, member_ids=[member.id for member in network.members]
        )


class ElectricityMarketCreate(ElectricityMarketBase):
    pass


class ElectricityMarketListOut(BaseModel):
    electricity_markets: list[ElectricityMarketOut] = Field(description="List of electricity markets")


AskType = ControllableFacilityType | StorageFacilityType
BidType = (
    NonFacilityBidType
    | ExtractionFacilityType
    | Literal[FunctionalFacilityType.INDUSTRY, FunctionalFacilityType.CARBON_CAPTURE]
    | StorageFacilityType
)


class ChangeElectricityMarketPrices(BaseModel):
    asks: list[Ask]
    bids: list[Bid]


class Ask(BaseModel):
    type: AskType
    price: float = Field(gt=-5)


class Bid(BaseModel):
    type: BidType
    price: float = Field(gt=-5)


# TODO(mglst): The following class definitions shouldn't be placed here - this temporarily resolves a circular import
# is the reason for this. The `enums.py` file should also be reworked


class BidItem(BaseModel):
    side: Literal["bid"]
    type: BidType

    class Config:
        frozen = True


class AskItem(BaseModel):
    side: Literal["ask"]
    type: AskType

    class Config:
        frozen = True


PowerPriorityItem = Annotated[BidItem | AskItem, Field(discriminator="side")]
