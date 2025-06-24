"""Schemas for API for a player."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from energetica.schemas.common import BaseApiModel

if TYPE_CHECKING:
    from energetica.database.player import Player


class PlayerOut(BaseModel):
    """Response model for player information."""

    id: int = Field(description="ID of the player")
    username: str = Field(description="Username of the player")


class SettingsPatch(BaseModel):
    """Request model for user configuration."""

    show_disclaimer: bool | None = Field(None, description="Whether to show the chat disclaimer or not")


class UIStatePatch(BaseModel):
    """Model for updating the state of the UI."""

    last_opened_chat_id: int | None = Field(None, description="ID of the last opened chat")


class MoneyOut(BaseApiModel):
    """Model for the player's money."""

    money: float

    @classmethod
    def from_player(cls, player: Player) -> MoneyOut:
        return MoneyOut.from_player(player)
