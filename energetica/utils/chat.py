"""Utility functions relating to the in game chat."""

from __future__ import annotations

from typing import TYPE_CHECKING

from energetica.database.messages import Chat, Message
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.schemas.notifications import ChatMessagePayload
from energetica.utils.misc import send_new_message_sio

if TYPE_CHECKING:
    from energetica.database.player import Player


def check_existing_chats(participants: set[Player]) -> bool:
    """Return true if a chat with exactly these participants already exists."""
    return any(chat.participants == participants and chat.id != engine.general_chat_id for chat in Chat.all())


def create_chat(player: Player, chat_name: str | None, participants: set[Player]) -> Chat:
    """
    Create a group chat with specified name and participants.

    :param Player player: the Player object which requested the group chat creation
    :param str chat_name: a string for the name of the chat
    :param participant_ids: a list of numbers corresponding to player ids
    """
    if chat_name and (len(chat_name) == 0 or len(chat_name) > 25):
        raise GameError(GameExceptionType.WRONG_TITLE_LENGTH)
    if check_existing_chats(participants):
        raise GameError(GameExceptionType.CHAT_ALREADY_EXISTS)
    new_chat = Chat(
        name=chat_name,
        participants=set(participants),
    )
    participant_list = ", ".join(participant.username for participant in participants if participant != player)
    if len(participants) == 2:
        engine.log(f"{player.username} created a chat with {participant_list}")
    else:
        engine.log(f"{player.username} created a group chat called {chat_name} with {participant_list}")

    for participant in participants:
        participant.invalidate_queries(["chats"])

    return new_chat


def add_message(player: Player, message_text: str, chat: Chat) -> Message:
    """Add a player sent message to a chat."""
    if player not in chat.participants:
        # TODO(mglst): this logic should be handled by the router so that it can return a relevant HTTP error code such
        # as HTTP_401_UNAUTHORIZED
        raise GameError(GameExceptionType.NOT_IN_CHAT)
    if len(message_text) == 0:
        # TODO(mglst): this validation logic should be handled by pydantic
        raise GameError(GameExceptionType.NO_MESSAGE)
    if len(message_text) > 500:
        # TODO(mglst): this validation logic should be handled by pydantic
        raise GameError(GameExceptionType.MESSAGE_TOO_LONG)
    new_message = Message(
        id=len(chat.messages),
        text=message_text,
        player=player,
        chat=chat,
    )
    chat.messages.append(new_message)
    chat.player_last_read_index[player.id] = len(chat.messages) - 1

    send_new_message_sio(new_message, chat)

    payload = ChatMessagePayload(
        sender_username=player.username,
        message=message_text,
        chat_id=chat.id,
    )
    for participant in chat.participants:
        # Ensure the "unread chats" is updated
        if participant != player:
            participant.invalidate_queries(["chats"])
            for subscription in list(participant.push_subscriptions):
                participant.notify_subscription(subscription, payload)

        participant.invalidate_queries(
            ["chats"],
            ["chats", chat.id, "messages"],
        )

    return new_message
