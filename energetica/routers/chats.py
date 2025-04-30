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

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("")
async def get_chat_list(user: Annotated[Player, Depends(get_current_user)]) -> ChatListResponse:
    """Get the chat list for the current user."""

    def display_name(chat: Chat) -> str:
        """Get the display name for a chat."""
        if chat.name is not None:
            return chat.name
        for participant in chat.participants:
            if participant != user:
                return participant.username
        msg = "Chat has no name and no other participant"
        raise ValueError(msg)

    def initials(chat: Chat) -> list[str]:
        """Get the initials for a chat."""
        if chat.name is None:
            for participant in chat.participants:
                if participant != user:
                    return [participant.username[0]]
        max_initials_size = 4
        initials = []
        for participant in chat.participants:
            initials.append(participant.username[0])
            if len(initials) == max_initials_size:
                break
        return initials

    return ChatListResponse(
        chats=[
            ChatOut(
                id=chat.id,
                display_name=display_name(chat),
                initials=initials(chat),
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
    chat = Chat.get(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    return MessageListResponse(messages=[MessageOut.from_message(message) for message in chat.messages])


@router.post("/{chat_id}/messages")
async def new_message(
    user: Annotated[Player, Depends(get_current_user)],
    chat_id: int,
    request_data: NewMessageRequest,
) -> None:
    """Send a message."""
    chat = Chat.get(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    energetica.utils.chat.add_message(user, request_data.new_message, chat)


@router.post("", status_code=204)
async def create_group_chat(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request_data: NewChatRequest,
):
    """Create a chat."""
    try:
        group_members = {user, *map(Player.getitem, request_data.group_member_ids)}
    except KeyError:
        raise HTTPException(status_code=404, detail="One or more group members not found")
    energetica.utils.chat.create_chat(user, request_data.group_chat_name, group_members)
