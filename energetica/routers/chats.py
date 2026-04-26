"""Routes for the in-game chat."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

import energetica.utils.chat
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.schemas.chats import ChatCreate, ChatListOut, ChatOut, MessageCreate, MessageListOut, MessageOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.get("")
def get_chat_list(player: Annotated[Player, Depends(get_settled_player)]) -> ChatListOut:
    """Get the chat list for the current user."""
    return ChatListOut(
        chats=[ChatOut.from_chat(player, chat) for chat in Chat.filter(lambda chat: player in chat.participants)],
        last_opened_chat_id=player.last_opened_chat_id,
        unread_chat_count=player.unread_chat_count(),
    )


@router.get("/{chat_id}/messages")
def get_chat_messages(
    player: Annotated[Player, Depends(get_settled_player)],
    chat_id: int,
    before: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> MessageListOut:
    """Get the messages for a chat, newest `limit` messages or those before `before` message id."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"))
    if player not in chat.participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a participant in this chat")
    messages = chat.messages
    if before is not None:
        before_index = next((i for i, m in enumerate(messages) if m.id == before), None)
        if before_index is None:
            return MessageListOut(messages=[], has_more=False)
        messages = messages[:before_index]
    has_more = len(messages) > limit
    return MessageListOut(
        messages=[MessageOut.from_message(m) for m in messages[-limit:]],
        has_more=has_more,
    )


@router.post("/{chat_id}/messages")
def new_message(
    player: Annotated[Player, Depends(get_settled_player)],
    chat_id: int,
    request_data: MessageCreate,
) -> MessageOut:
    """Send a message."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"))
    if player not in chat.participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a participant in this chat")
    new_message = energetica.utils.chat.add_message(player, request_data.new_message, chat)
    return MessageOut.from_message(new_message)


@router.post("/{chat_id}:open", status_code=status.HTTP_204_NO_CONTENT)
def open_chat(  # noqa: ANN201
    player: Annotated[Player, Depends(get_settled_player)],
    chat_id: int,
):
    """Mark a chat as opened by setting it as the last opened chat."""
    chat = Chat.getitem(chat_id, error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"))
    if player not in chat.participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a participant in this chat")
    chat.open_for_player(player)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group_chat(
    player: Annotated[Player, Depends(get_settled_player)],
    request_data: ChatCreate,
) -> ChatOut:
    """Create a chat."""
    group_members = {
        Player.getitem(
            member_id,
            error=HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more group members not found"),
        )
        for member_id in request_data.group_member_ids
    } | {player}
    new_chat = energetica.utils.chat.create_chat(player, request_data.group_chat_name, group_members)
    return ChatOut.from_chat(player=player, chat=new_chat)
