"""Util functions relating to the in game chat"""

from datetime import datetime

from flask import current_app

from website import db
from website.api import websocket
from website.database.messages import Chat, Message
from website.database.player import Player, PlayerUnreadMessages
from website.game_engine import GameEngine


def hide_chat_disclaimer(player):
    """Stores the player's choice to not show the chat disclaimer anymore"""
    player.show_disclaimer = False
    db.session.commit()
    engine: GameEngine = current_app.config["engine"]
    message = websocket.rest_get_show_chat_disclaimer(player)
    websocket.rest_notify_player(engine, player, message)


def check_existing_chats(participants):
    """Checks if a chat with exactly these participants already exists"""
    participant_ids = [participant.id for participant in participants]
    conditions = [Chat.participants.any(id=participant_id) for participant_id in participant_ids]
    existing_chats = Chat.query.filter(*conditions)
    for chat in existing_chats:
        if len(chat.participants) == len(participants):
            return True
    return False


def create_chat_2(player, buddy_id):
    """creates a chat with 2 players"""
    buddy = Player.query.get(buddy_id)
    if buddy is None:
        # When create_chat calls create_chat_2, this branch is unreachable
        return {"response": "buddyIDDoesNotExist"}
    if buddy.id == player.id:
        return {"response": "cannotChatWithYourself"}
    if check_existing_chats([player, buddy]):
        return {"response": "chatAlreadyExist"}
    new_chat = Chat(
        name=None,
        participants=[player, buddy],
    )
    db.session.add(new_chat)
    db.session.commit()
    engine: GameEngine = current_app.config["engine"]
    engine.log(f"{player.username} created a chat with {buddy.username}")
    websocket.notify_new_chat(new_chat)
    return {"response": "success"}


def create_chat(player, buddy_username):
    """creates a chat with 2 players"""
    # TODO: change web frontend to send ID's, then deprecate this function
    buddy = Player.query.filter_by(username=buddy_username).first()
    if buddy is None:
        return {"response": "usernameIsWrong"}
    return create_chat_2(player, buddy.id)


def create_group_chat_2(player, chat_name, participant_ids):
    """
    Creates a group chat with specified name and participants

    :param player: the Player object which requested the group chat creation

    :param chat_name: a string for the name of the chat

    :param participant_ids: a list of numbers corresponding to player ids

    :return: '{"response": X}' where X can be
     * "success" if all is well
     * "wrongTitleLength" if the `chat_name` is too long or too short
     * "groupTooSmall" if there are fewer than 3 participants (including player)
     * "chatAlreadyExist" if there is an existing group chat with the same
       participants
    """
    if len(chat_name) == 0 or len(chat_name) > 25:
        return {"response": "wrongTitleLength"}
    participants = [player]
    for participant_id in participant_ids:
        participant = Player.query.get(participant_id)
        if participant is not None:
            participants.append(participant)
    if len(participants) < 3:
        return {"response": "groupTooSmall"}
    if check_existing_chats(participants):
        return {"response": "chatAlreadyExist"}
    new_chat = Chat(
        name=chat_name,
        participants=participants,
    )
    db.session.add(new_chat)
    db.session.commit()
    engine: GameEngine = current_app.config["engine"]
    engine.log(f"{player.username} created a group chat called {chat_name} with {participants}")
    websocket.notify_new_chat(new_chat)
    return {"response": "success"}


def create_group_chat(player, title, group):
    """
    Creates a group chat with specified name and participants

    :param player: the Player object which requested the group chat creation

    :param chat_name: a string for the name of the chat

    :param participant_ids: a list of numbers corresponding to player ids

    :return: '{"response": X}' where X can be
     * "success" if all is well
     * "wrongTitleLength" if the `chat_name` is too long or too short
     * "groupTooSmall" if there are fewer than 3 participants (including player)
     * "chatAlreadyExist" if there is an existing group chat with the same
       participants
    """
    # TODO: change web frontend to send ID's, then deprecate this function
    participants = [Player.query.filter_by(username=username).first() for username in group]
    participant_ids = [participant.id for participant in participants]
    return create_group_chat_2(player, chat_name=title, participant_ids=participant_ids)


def add_message(player, message_text, chat_id):
    """This function is called when a player sends a message in a chat. It returns either success or an error."""
    engine: GameEngine = current_app.config["engine"]
    if not chat_id:
        return {"response": "noChatID"}
    if len(message_text) == 0:
        return {"response": "noMessage"}
    if len(message_text) > 500:
        return {"response": "messageTooLong", "message": message_text}
    chat = Chat.query.filter_by(id=chat_id).first()
    new_message = Message(
        text=message_text,
        time=datetime.now(),
        player_id=player.id,
        chat_id=chat.id,
    )
    db.session.add(new_message)
    db.session.commit()
    for participant in chat.participants:
        if participant == player:
            continue
        player_read_message = PlayerUnreadMessages(player_id=participant.id, message_id=new_message.id)
        db.session.add(player_read_message)
    db.session.commit()
    engine.display_new_message(new_message, chat)
    return {"response": "success"}
