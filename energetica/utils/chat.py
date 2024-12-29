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


def check_existing_chats(participants):
    """Checks if a chat with exactly these participants already exists"""
    participant_ids = [participant.id for participant in participants]
    conditions = [Chat.participants.any(id=participant_id) for participant_id in participant_ids]
    existing_chats = Chat.filter(*conditions)
    for chat in existing_chats:
        if len(chat.participants) == len(participants):
            return True
    return False


# TODO (Felix): We should have only one function to create a chat or group chat
def create_chat(player, buddy):
    """creates a chat with 2 players"""
    if buddy is None:
        raise GameError("buddyIDDoesNotExist")
    if buddy.id == player.id:
        raise GameError("cannotChatWithYourself")
    if check_existing_chats([player, buddy]):
        raise GameError("chatAlreadyExist")
    new_chat = Chat(
        name=None,
        participants=[player, buddy],
    )
    db.session.add(new_chat)
    engine.log(f"{player.username} created a chat with {buddy.username}")
    # websocket.notify_new_chat(new_chat)


def create_group_chat(player: Player, chat_name: str | None, participants: set[Player]):
    """
    Creates a group chat with specified name and participants

    :param player: the Player object which requested the group chat creation

    :param chat_name: a string for the name of the chat

    :param participant_ids: a list of numbers corresponding to player ids

    """
    if len(chat_name) == 0 or len(chat_name) > 25:
        raise GameError("wrongTitleLength")
    if len(participants) < 3:
        raise GameError("groupTooSmall")
    if check_existing_chats(participants):
        raise GameError("chatAlreadyExist")
    new_chat = Chat(
        name=chat_name,
        participants=set(participants),
    )
    for participant in participants:
        participant.chats.append(new_chat)
    engine.log(f"{player.username} created a group chat called {chat_name} with {participants}")
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
