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

    # TODO: make this a frontend piece of code
    def display_name(self, player: Player) -> str:
        """Get the display name for a chat."""
        if self.name is not None:
            return self.name
        for participant in self.participants:
            if participant != player:
                return participant.username
        msg = "Chat has no name and no other participant"
        raise ValueError(msg)

    def initials(self, player: Player) -> list[str]:
        """Get the initials for a chat, used for displaying in the UI."""
        if self.name is None:
            for participant in self.participants:
                if participant != player:
                    return [participant.username[0]]
        max_initials_size = 4
        initials = []
        for participant in self.participants:
            initials.append(participant.username[0])
            if len(initials) == max_initials_size:
                break
        return initials

    def open_for_player(self, player: Player) -> None:
        """Mark the chat as opened by a player, setting it as their last opened chat and marking it as read."""
        player.last_opened_chat_id = self.id
        self.player_last_read_index[player.id] = len(self.messages) - 1


@dataclass
class Notification(DBModel):
    """Class for storing data about in-game notifications."""

    title: str
    content: str
    player: Player
    time: datetime = field(default_factory=datetime.now)
    read: bool = False
