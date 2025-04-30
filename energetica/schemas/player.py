from pydantic import BaseModel, Field


class SettingsRequest(BaseModel):
    """Request model for user configuration."""

    last_opened_chat_id: int | None = Field(None, description="ID of the last opened chat")
    show_disclaimer: bool | None = Field(None, description="Whether to show the chat disclaimer or not")
