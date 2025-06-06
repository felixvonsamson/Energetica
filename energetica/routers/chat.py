from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

import energetica.utils.chat
from energetica.auth import get_current_user
from energetica.database.messages import Chat
from energetica.database.player import Player
from energetica.schemas.chat import (
    ChatListResponse,
    ChatOut,
    MessageListResponse,
    MessageOut,
    NewChatRequest,
    NewGroupChatRequest,
    NewMessageRequest,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/hide_disclaimer", status_code=204)
async def hide_disclaimer(user: Annotated[Player, Depends(get_current_user)]):  #  noqa: ANN201
    """Do not show the chat disclaimer again."""
    user.show_chat_disclaimer = False


@router.get("/chat_list")
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
    request_data: NewMessageRequest,
) -> MessageOut:
    """Send a message."""
    chat = Chat.get(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if user not in chat.participants:
        raise HTTPException(status_code=403, detail="You are not a participant in this chat")
    new_message = energetica.utils.chat.add_message(user, request_data.new_message, chat)
    return MessageOut.from_message(new_message)


@router.post("/create_chat", status_code=204)
async def create_chat(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request_data: NewChatRequest,
):
    """Create a chat with one other player."""
    buddy = Player.get(request_data.buddy_id)
    if buddy is None:
        raise HTTPException(status_code=404, detail="Buddy not found")
    if buddy == user:
        raise HTTPException(status_code=400, detail="You cannot create a chat with yourself")
    energetica.utils.chat.create_chat(user, None, {user, buddy})


# @http.route("create_group_chat", methods=["POST"])
# def create_group_chat() -> Response:
#     """Create a group chat."""
#     request_data = request.get_json()
#     chat_title = request_data["chat_title"]
#     group_members = {g.player, *(map(Player.getitem, map(int, request_data["group_members"])))}
#     energetica.utils.chat.create_chat(g.player, chat_title, group_members)
#     return jsonify({"response": "success"})


@router.post("/create_group_chat", status_code=204)
async def create_group_chat(  # noqa: ANN201
    user: Annotated[Player, Depends(get_current_user)],
    request_data: NewGroupChatRequest,
):
    """Create a group chat."""
    try:
        group_members = {user, *map(Player.getitem, request_data.group_member_ids)}
    except KeyError:
        raise HTTPException(status_code=404, detail="One or more group members not found")
    new_chat = energetica.utils.chat.create_chat(user, request_data.group_chat_name, group_members)
    return ChatOut(
        id=new_chat.id,
        display_name=new_chat.display_name(user),
        initials=new_chat.initials(user),
        is_group=new_chat.is_group(),
        unread_messages_count=new_chat.unread_messages_count_for_player(user),
    )
