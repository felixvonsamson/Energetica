from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from energetica import utils
from energetica.auth import get_current_user
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.schemas.chat import ChatListResponse, ChatOut, MessageListResponse, MessageOut, NewMessageRequest

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/hide_disclaimer", status_code=204)
async def hide_disclaimer(user: Annotated[Player, Depends(get_current_user)]):  #  noqa: ANN201
    """Do not show the chat disclaimer again."""
    user.show_chat_disclaimer = False


@router.get("/chat_list")
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


@router.post("/{chat_id}/new_message")
async def new_message(
    user: Annotated[Player, Depends(get_current_user)],
    chat_id: int,
    request: NewMessageRequest,
) -> None:
    """Send a message."""
    chat = Chat.get(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    utils.chat.add_message(user, request.new_message, chat)
