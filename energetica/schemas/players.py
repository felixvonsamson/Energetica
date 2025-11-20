"""Schemas for API for a player."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

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


class MoneyOut(BaseModel):
    """Model for the player's money."""

    money: float

    @classmethod
    def from_player(cls, player: Player) -> MoneyOut:
        return MoneyOut(money=player.money)


class WorkerInfo(BaseModel):
    """Information about a specific worker type."""

    available: int = Field(description="Number of available workers")
    total: int = Field(description="Total number of workers")


class WorkersOut(BaseModel):
    """Model for the player's workers."""

    construction: WorkerInfo = Field(description="Construction workers")
    laboratory: WorkerInfo = Field(description="Laboratory/research workers")

    @classmethod
    def from_player(cls, player: Player) -> WorkersOut:
        from energetica.enums import WorkerType

        return WorkersOut(
            construction=WorkerInfo(
                available=player.available_workers(WorkerType.CONSTRUCTION),
                total=player.workers[WorkerType.CONSTRUCTION],
            ),
            laboratory=WorkerInfo(
                available=player.available_workers(WorkerType.RESEARCH),
                total=player.workers[WorkerType.RESEARCH],
            ),
        )
