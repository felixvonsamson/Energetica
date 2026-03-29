"""Schemas for API routes for the map."""

from pydantic import BaseModel


class HexTileOut(BaseModel):
    id: int
    q: int
    r: int
    solar: float
    wind: float
    hydro: float
    coal: float
    gas: float
    uranium: float
    climate_risk: float
    player_id: int | None


class SettleRequest(BaseModel):
    region_id: int


class SettleResponse(BaseModel):
    player_id: int
