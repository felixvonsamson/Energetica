"""Module that contains the classes for the built-in chat."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from functools import partial
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

    name: str | None
    participants: set[Player]
    messages: list[Message] = field(default_factory=list)

    last_read_message: dict[int, int | None] = field(
        default_factory=lambda: defaultdict(partial(int, -1)),
    )  # {player: message index in messages}

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


@dataclass
class Notification(DBModel):
    """Class for storing data about in-game notifications."""

    title: str
    content: str
    player: Player
    time: datetime = field(default_factory=datetime.now)
    read: bool = False
