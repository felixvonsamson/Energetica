"""Schemas for API routes for electricity markets."""

# TODO(mglst): rename all appearances of 'network' with 'electricity market'

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

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


class NetworkBase(BaseModel):
    name: str = Field(min_length=3, max_length=40, description="Name of the network")


class NetworkOut(NetworkBase):
    id: int = Field(description="ID of the network")
    member_ids: list[int] = Field(description="List of player IDs in the network")

    @classmethod
    def from_network(cls, network: Network) -> NetworkOut:
        return NetworkOut(id=network.id, name=network.name, member_ids=[member.id for member in network.members])


class NetworkCreate(NetworkBase):
    pass


class NetworkListOut(BaseModel):
    networks: list[NetworkOut] = Field(description="List of networks")


AskType = ControllableFacilityType | StorageFacilityType
BidType = (
    NonFacilityBidType
    | ExtractionFacilityType
    | Literal[FunctionalFacilityType.INDUSTRY, FunctionalFacilityType.CARBON_CAPTURE]
    | StorageFacilityType
)


class ChangeNetworkPrices(BaseModel):
    asks: list[Ask]
    bids: list[Bid]


class Ask(BaseModel):
    type: AskType
    price: float = Field(ge=-5)


class Bid(BaseModel):
    type: BidType
    price: float = Field(ge=-5)
