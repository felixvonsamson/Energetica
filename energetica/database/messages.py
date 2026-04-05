"""Module that contains the classes for the built-in chat and notifications."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Literal

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player


# ---------------------------------------------------------------------------
# Adding a new notification type? Here is the full checklist:
#
# 1. Add the type string to NotificationType below (you are here).
#
# 2. In energetica/schemas/notifications.py:
#    a. Add a new *Payload class with `type: Literal["your_type"]` as its
#       first field (the Literal is required for Pydantic's discriminator).
#    b. Add that class to the NotificationPayload union.
#
# 3. Run `bun run generate-types` to regenerate the TypeScript types from
#    the updated OpenAPI schema. This propagates the new type to the frontend.
#
# 4. In frontend/src/types/notifications.ts:
#    Add an entry to NOTIFICATION_CATEGORIES (TypeScript will error if missing).
#
# 5. In frontend/src/components/layout/notification-popup.tsx:
#    Add a case to getNotificationText (TypeScript will error if missing).
#
# 6. In frontend/src/service-worker.ts:
#    Add cases to getNotificationText and getNotificationUrl.
#    NOTE: these switches have `default` fallbacks, so TypeScript will NOT
#    catch a missing case — you must add it manually.
#
# 7. Add a player.notify(YourTypePayload(...)) call at the relevant backend
#    event site (utils/, production_update.py, etc.).
# ---------------------------------------------------------------------------

NotificationType = Literal[
    "construction_finished",
    "technology_researched",
    "facility_decommissioned",
    "facility_destroyed",
    "emergency_facility_created",
    "climate_event",
    "resource_sold",
    "shipment_arrived",
    "credit_limit_exceeded",
    "network_expelled",
    "achievement_milestone",
    "achievement_unlock",
    "push_notification_test",
]


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

    def add_player(self, player: Player) -> None:
        """Add a player to the list of participants."""
        self.participants.add(player)
        for player in self.participants:
            player.invalidate_queries(["chats"])

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

    type: NotificationType
    payload: dict
    player: Player
    time: datetime = field(default_factory=datetime.now)
    read: bool = False
    flagged: bool = False
    archived: bool = False
