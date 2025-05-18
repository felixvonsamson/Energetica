from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

import energetica.utils.chat
from energetica.auth import get_current_user
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.schemas.chats import (
    ChatListResponse,
    ChatOut,
    MessageListResponse,
    MessageOut,
    NewChatRequest,
    NewMessageRequest,
)

router = APIRouter(prefix="/chats", tags=["Chat"])


@router.get("")
async def get_chat_list(user: Annotated[Player, Depends(get_current_user)]) -> ChatListResponse:
    """Get the chat list for the current user."""
    return ChatListResponse(
        chats=[
            ChatOut(
                id=chat.id,
                display_name=chat.display_name(user),
                initials=chat.initials(user),
                is_group=chat.is_group(),
                unread_messages_count=chat.unread_messages_count_for_player(user),
            )
            for chat in Chat.filter(lambda chat: user in chat.participants)
        ],
        last_opened_chat_id=user.last_opened_chat_id,
        unread_chat_count=user.unread_chat_count(),
    )


@router.get("/{chat_id}/messages")
async def get_chat_messages(
    user: Annotated[Player, Depends(get_current_user)],
    chat_id: int,
) -> MessageListResponse:
    """Get the messages for a chat."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=404, detail="Chat not found"))
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    return MessageListResponse(messages=[MessageOut.from_message(message) for message in chat.messages])


@router.post("/{chat_id}/messages")
async def new_message(
    user: Annotated[Player, Depends(get_current_user)],
    chat_id: int,
    request_data: NewMessageRequest,
) -> MessageOut:
    """Send a message."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=404, detail="Chat not found"))
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    new_message = energetica.utils.chat.add_message(user, request_data.new_message, chat)
    return MessageOut.from_message(new_message)


@router.post("", status_code=201)
async def create_group_chat(
    user: Annotated[Player, Depends(get_current_user)],
    request_data: NewChatRequest,
) -> ChatOut:
    """Create a chat."""
    group_members = {
        Player.getitem(member_id, error=HTTPException(status_code=404, detail="One or more group members not found"))
        for member_id in request_data.group_member_ids
    }
    new_chat = energetica.utils.chat.create_chat(user, request_data.group_chat_name, group_members)
    return ChatOut(
        id=new_chat.id,
        display_name=new_chat.display_name(user),
        initials=new_chat.initials(user),
        is_group=new_chat.is_group(),
        unread_messages_count=new_chat.unread_messages_count_for_player(user),
    )
