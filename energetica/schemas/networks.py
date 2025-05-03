from pydantic import BaseModel, Field


class NetworkBase(BaseModel):
    name: str = Field(min_length=3, max_length=40, description="Name of the network")


class NetworkOut(NetworkBase):
    id: int = Field(description="ID of the network")
    member_ids: list[int] = Field(description="List of player IDs in the network")


class NetworkIn(NetworkBase):
    pass


class NetworkList(BaseModel):
    networks: list[NetworkOut] = Field(description="List of networks")
