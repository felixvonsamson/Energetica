"""Schemas for API routes for electricity markets."""

# TODO(mglst): rename all appearances of 'network' with 'electricity market'

from __future__ import annotations

from pydantic import BaseModel, Field

from energetica.database.network import Network


class NetworkBase(BaseModel):
    name: str = Field(min_length=3, max_length=40, description="Name of the network")


class NetworkOut(NetworkBase):
    id: int = Field(description="ID of the network")
    member_ids: list[int] = Field(description="List of player IDs in the network")

    @classmethod
    def from_network(cls, network: Network) -> NetworkOut:
        return NetworkOut(id=network.id, name=network.name, member_ids=[member.id for member in network.members])


class NetworkIn(NetworkBase):
    pass


class NetworkList(BaseModel):
    networks: list[NetworkOut] = Field(description="List of networks")
