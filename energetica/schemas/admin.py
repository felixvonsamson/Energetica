"""Schemas for admin API endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AdminPlayerOut(BaseModel):
    """Player summary for the admin dashboard."""

    id: int = Field(description="ID of the player")
    username: str = Field(description="Username of the player")
