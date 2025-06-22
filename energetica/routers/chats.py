"""Routes for the in-game chat."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

import energetica.utils.chat
from energetica.auth import get_current_user
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.schemas.chats import ChatCreate, ChatListOut, ChatOut, MessageCreate, MessageListOut, MessageOut

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.get("")
def get_chat_list(player: Annotated[Player, Depends(get_current_user)]) -> ChatListOut:
    """Get the chat list for the current user."""
    return ChatListOut(
        chats=[ChatOut.from_chat(player, chat) for chat in Chat.filter(lambda chat: player in chat.participants)],
        last_opened_chat_id=player.last_opened_chat_id,
        unread_chat_count=player.unread_chat_count(),
    )


@router.get("/{chat_id}/messages")
def get_chat_messages(
    user: Annotated[Player, Depends(get_current_user)],
    chat_id: int,
) -> MessageListOut:
    """Get the messages for a chat."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=404, detail="Chat not found"))
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    return MessageListOut(messages=[MessageOut.from_message(message) for message in chat.messages])


@router.post("/{chat_id}/messages")
def new_message(
    user: Annotated[Player, Depends(get_current_user)],
    chat_id: int,
    request_data: MessageCreate,
) -> MessageOut:
    """Send a message."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=404, detail="Chat not found"))
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    new_message = energetica.utils.chat.add_message(user, request_data.new_message, chat)
    return MessageOut.from_message(new_message)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group_chat(
    player: Annotated[Player, Depends(get_current_user)],
    request_data: ChatCreate,
) -> ChatOut:
    """Create a chat."""
    group_members = {
        *{
            Player.getitem(
                member_id,
                error=HTTPException(status_code=404, detail="One or more group members not found"),
            )
            for member_id in request_data.group_member_ids
        },
        player,
    }
    new_chat = energetica.utils.chat.create_chat(player, request_data.group_chat_name, group_members)
    return ChatOut(
        id=new_chat.id,
        display_name=new_chat.display_name(player),
        initials=new_chat.initials(player),
        is_group=new_chat.is_group(),
        unread_messages_count=new_chat.unread_messages_count_for_player(player),
    )
