from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from energetica.auth import get_current_user
from energetica.database.messages import Chat
from energetica.database.player import Player

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/hide_disclaimer", status_code=204)
async def hide_disclaimer(user: Annotated[Player, Depends(get_current_user)]) -> None:
    """Do not show the chat disclaimer again."""
    user.show_chat_disclaimer = False


class ChatOut(BaseModel):
    id: int
    display_name: str
    initials: list[str]
    is_group: bool
    unread_messages_count: int


class ChatListResponse(BaseModel):
    """Response model for the chat list."""

    chats: list[ChatOut]
    last_opened_chat_id: int | None
    unread_chat_count: int


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
