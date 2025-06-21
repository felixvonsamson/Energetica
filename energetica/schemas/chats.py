"""Chat-related Pydantic models for request and response validation."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from energetica.database.messages import Chat, Message
from energetica.database.player import Player


class ChatListResponse(BaseModel):
    """Response model for the chat list."""

    chats: list[ChatOut]
    last_opened_chat_id: int
    unread_chat_count: int


class ChatOut(BaseModel):
    """Response model for a chat."""

    id: int
    display_name: str
    initials: list[str]
    is_group: bool
    unread_messages_count: int

    @classmethod
    def from_chat(cls, player: Player, chat: Chat) -> ChatOut:
        return ChatOut(
            id=chat.id,
            display_name=chat.display_name(player),
            initials=chat.initials(player),
            is_group=chat.is_group(),
            unread_messages_count=chat.unread_messages_count_for_player(player),
        )


class MessageOut(BaseModel):
    """Response model for a message."""

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

    new_message: str = Field(min_length=1, max_length=1000)


class NewChatRequest(BaseModel):
    """Request model for creating a new group chat."""

    group_chat_name: str | None = Field(None, min_length=1, max_length=30)
    group_member_ids: list[int] = Field(min_length=1)
