"""Module that contains the classes for the built-in chat."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class Message:
    """Class for storing data about messages for the in-game messaging system."""

    id: int
    text: str
    chat: Chat
    player: Player
    timestamp: datetime = field(default_factory=datetime.now)

    def package(self) -> dict:
        """Package this message's data into a dictionary."""
        return {
            "id": self.id,
            "text": self.text,
            "date": self.timestamp.timestamp(),
            "player_id": self.player.id,
        }


@dataclass
class Chat(DBModel):
    """Class for chats with 2 or more players."""

    name: str | None
    participants: set[Player]
    messages: list[Message] = field(default_factory=list)
    player_last_read_index: dict[int, int] = field(default_factory=dict)

    def is_group(self) -> bool:
        """Check if the chat is a group chat."""
        return len(self.participants) > 2

    def unread_messages_count_for_player(self, player: Player) -> int:
        """Get the number of unread messages for a player."""
        last_read_message = self.player_last_read_index.get(player.id)
        if last_read_message is None:
            return len(self.messages)
        return len(self.messages) - last_read_message - 1


@dataclass
class Notification(DBModel):
    """Class for storing data about in-game notifications."""

    title: str
    content: str
    player: Player
    time: datetime = field(default_factory=datetime.now)
    read: bool = False
