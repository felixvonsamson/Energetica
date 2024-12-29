"""Util functions relating to the in game chat"""

from datetime import datetime
from typing import TYPE_CHECKING

from energetica.database.messages import Chat, Message
from energetica.game_engine import GameEngine, GameError
from energetica.globals import engine
from energetica.utils.misc import display_new_message

if TYPE_CHECKING:
    from energetica.database.player import Player

from __future__ import annotations


def hide_chat_disclaimer(player):
    """Stores the player's choice to not show the chat disclaimer anymore"""
    player.show_disclaimer = False
    #    # message = websocket.rest_get_show_chat_disclaimer(player)
    # websocket.rest_notify_player(player, message)


def check_existing_chats(participants: set[Player]):
    """Checks if a chat with exactly these participants already exists"""
    return any(chat.participants == participants for chat in Chat.all())


def create_chat(player: Player, chat_name: str | None, participants: set[Player]):
    """
    Creates a group chat with specified name and participants

    :param player: the Player object which requested the group chat creation

    :param chat_name: a string for the name of the chat

    :param participant_ids: a list of numbers corresponding to player ids

    """
    if None in participants:
        # TODO (Felix): Catch this error in the frontend
        raise GameError("playerDoesNotExist")
    if len(chat_name) == 0 or len(chat_name) > 25:
        raise GameError("wrongTitleLength")
    if len(participants) < 2:
        raise GameError("groupTooSmall")
    if check_existing_chats(participants):
        raise GameError("chatAlreadyExist")
    new_chat = Chat(
        name=chat_name,
        participants=set(participants),
    )
    for participant in participants:
        participant.chats.append(new_chat)
    participant_list = ", ".join(participant.username for participant in participants if participant != player)
    if len(participants) == 2:
        engine.log(f"{player.username} created a chat with {participant_list}")
    else:
        engine.log(f"{player.username} created a group chat called {chat_name} with {participant_list}")
    # websocket.notify_new_chat(new_chat)


def add_message(player, message_text, chat):
    """This function is called when a player sends a message in a chat. It returns either success or an error."""
    if player not in chat.participants:
        raise GameError("notInChat")
    if len(message_text) == 0:
        raise GameError("noMessage")
    if len(message_text) > 500:
        raise GameError("messageTooLong", message=message_text)
    new_message = Message(
        text=message_text,
        player=player,
        chat=chat,
    )
    chat.messages.append(new_message)
    chat.last_read_message[player] = len(chat.messages) - 1

    display_new_message(new_message, chat)
