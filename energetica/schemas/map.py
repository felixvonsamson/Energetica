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
