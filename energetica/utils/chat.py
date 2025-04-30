"""Utility functions relating to the in game chat."""

from __future__ import annotations

from typing import TYPE_CHECKING

from energetica.database.messages import Chat, Message
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.misc import display_new_message

if TYPE_CHECKING:
    from energetica.database.player import Player


def check_existing_chats(participants: set[Player]) -> bool:
    """Return true if a chat with exactly these participants already exists."""
    return any(chat.participants == participants for chat in Chat.all())


def create_chat(player: Player, chat_name: str | None, participants: set[Player]) -> Chat:
    """
    Create a group chat with specified name and participants.

    :param Player player: the Player object which requested the group chat creation
    :param str chat_name: a string for the name of the chat
    :param participant_ids: a list of numbers corresponding to player ids
    """
    if chat_name and (len(chat_name) == 0 or len(chat_name) > 25):
        raise GameError("wrongTitleLength")
    if len(participants) < 2:
        raise GameError("groupTooSmall")
    if check_existing_chats(participants):
        raise GameError("chatAlreadyExist")
    new_chat = Chat(
        name=chat_name,
        participants=set(participants),
    )
    participant_list = ", ".join(participant.username for participant in participants if participant != player)
    if len(participants) == 2:
        engine.log(f"{player.username} created a chat with {participant_list}")
    else:
        engine.log(f"{player.username} created a group chat called {chat_name} with {participant_list}")
    return new_chat


def add_message(player: Player, message_text: str, chat: Chat) -> None:
    """Add a player sent message to a chat."""
    if player not in chat.participants:
        raise GameError("notInChat")
    if len(message_text) == 0:
        raise GameError("noMessage")
    if len(message_text) > 500:
        raise GameError("messageTooLong")
    new_message = Message(
        id=len(chat.messages),
        text=message_text,
        player=player,
        chat=chat,
    )
    chat.messages.append(new_message)
    chat.player_last_read_index[player.id] = len(chat.messages) - 1

    display_new_message(new_message, chat)
