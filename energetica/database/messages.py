"""Module that contains the classes for the built-in chat."""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, ClassVar

from flask import current_app

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class Message:
    """Class for storing data about messages for the in-game messaging system."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    text: str
    time: datetime

    chat: Chat
    player: Player

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(Message.__next_id)
        self.time = datetime.now()
        current_app.config["engine"].players[self.id] = self

    def package(self) -> dict:
        """Package this message's data into a dictionary."""
        return {
            "id": self.id,
            "text": self.text,
            "date": self.time.timestamp(),
            "player_id": self.player.id,
        }


@dataclass
class Chat:
    """Class for chats with 2 or more players."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    name: str
    messages: list[Message] = field(default_factory=list)

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(Chat.__next_id)
        current_app.config["engine"].players[self.id] = self


@dataclass
class Notification:
    """Class for storing data about in-game notifications."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    title: str
    content: str
    time: datetime = None
    read: bool = False

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(Notification.__next_id)
        self.time = datetime.now()
        current_app.config["engine"].players[self.id] = self
