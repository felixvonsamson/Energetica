"""Schemas for API routes related to authentication."""

from __future__ import annotations

from pydantic import BaseModel, Field

from energetica.database.user import UserRole
from energetica.schemas.capabilities import PlayerCapabilities


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=18)
    password: str = Field(min_length=7)


class ChangePasswordRequest(BaseModel):  # TODO(mglst): use PUT or something
    old_password: str
    new_password: str = Field(min_length=7)


class UserOut(BaseModel):
    """Response model for authenticated user information."""

    id: int = Field(description="ID of the user")
    username: str = Field(description="Username of the user")
    role: UserRole = Field(description="User role")
    player_id: int | None = Field(None, description="Player ID if role is 'player' and settled")
    is_settled: bool = Field(description="Whether the user has chosen a location (only relevant for players)")
    capabilities: PlayerCapabilities | None = Field(
        None,
        description="Feature capability flags (null for non-players or unsettled players)",
    )
