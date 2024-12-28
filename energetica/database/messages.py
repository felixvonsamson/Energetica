"""Module that contains the classes for the built-in chat."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from energetica import engine
from energetica.database import DB

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class Message(DB):
    """Class for storing data about messages for the in-game messaging system."""

    text: str
    time: datetime

    chat: Chat
    player: Player


    def package(self) -> dict:
        """Package this message's data into a dictionary."""
        return {
            "id": self.id,
            "text": self.text,
            "date": self.time.timestamp(),
            "player_id": self.player.id,
        }


@dataclass
class Chat(DB):
    """Class for chats with 2 or more players."""

    name: str
    participants: list[Player]
    messages: list[Message] = field(default_factory=list)



@dataclass
class Notification:
    """Class for storing data about in-game notifications."""
    title: str
    content: str
    time: datetime = None
    read: bool = False

