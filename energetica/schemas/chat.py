from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from energetica.database.messages import Message


class ChatOut(BaseModel):
    id: int
    display_name: str
    initials: list[str]
    is_group: bool
    unread_messages_count: int


class ChatListResponse(BaseModel):
    """Response model for the chat list."""

    chats: list[ChatOut]
    last_opened_chat_id: int | None
    unread_chat_count: int


class MessageOut(BaseModel):
    id: int
    text: str
    player_id: int
    timestamp: datetime

    @classmethod
    def from_message(cls, message: Message) -> MessageOut:
        """Create a MessageOut instance from a Message."""
        return MessageOut(id=message.id, text=message.text, player_id=message.player.id, timestamp=message.timestamp)


class MessageListResponse(BaseModel):
    """Response model for the message list."""

    messages: list[MessageOut]


class NewMessageRequest(BaseModel):
    """Request model for sending a new message."""

    new_message: str = Field(..., min_length=1, max_length=500)
