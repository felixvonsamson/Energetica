"""Schemas for API for networks."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    FunctionalFacilityType,
    NonFacilityAskType,
    StorageFacilityType,
)


class NetworkBase(BaseModel):
    name: str = Field(min_length=3, max_length=40, description="Name of the network")


class NetworkOut(NetworkBase):
    id: int = Field(description="ID of the network")
    member_ids: list[int] = Field(description="List of player IDs in the network")


class NetworkIn(NetworkBase):
    pass


class NetworkList(BaseModel):
    networks: list[NetworkOut] = Field(description="List of networks")


BidType = ControllableFacilityType | StorageFacilityType
AskType = (
    NonFacilityAskType
    | ExtractionFacilityType
    | Literal[FunctionalFacilityType.INDUSTRY, FunctionalFacilityType.CARBON_CAPTURE]
    | StorageFacilityType
)


class ChangeNetworkPrices(BaseModel):
    bids: list[Bid]
    asks: list[Ask]


class Bid(BaseModel):
    type: BidType
    price: float = Field(ge=-5)


class Ask(BaseModel):
    type: AskType
    price: float = Field(ge=-5)
