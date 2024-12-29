"""Module that contains the classes for the built-in chat."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class Message(DBModel):
    """Class for storing data about messages for the in-game messaging system."""

    text: str
    chat: Chat
    player: Player
    time: datetime = field(default_factory=datetime.now)

    def package(self) -> dict:
        """Package this message's data into a dictionary."""
        return {
            "id": self.id,
            "text": self.text,
            "date": self.time.timestamp(),
            "player_id": self.player.id,
        }


@dataclass
class Chat(DBModel):
    """Class for chats with 2 or more players."""

    name: str
    participants: set[Player]
    messages: list[Message] = field(default_factory=list)
    last_read_message: dict[Player, int | None] = field(
        default_factory=lambda: defaultdict(lambda: -1),
    )  # {player: message index in messages}


@dataclass
class Notification(DBModel):
    """Class for storing data about in-game notifications."""

    title: str
    content: str
    player: Player
    time: datetime = field(default_factory=datetime.now)
    read: bool = False
