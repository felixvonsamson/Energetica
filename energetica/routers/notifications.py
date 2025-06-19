"""Routes for API for game notifications."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from energetica.auth import get_current_user
from energetica.database.messages import Notification
from energetica.database.player import Player

router = APIRouter(prefix="/notifications", tags=["Game Notifications"])


@router.delete("/{notification_id}")
def delete_notification(
    player: Annotated[Player, Depends(get_current_user)],
    notification_id: int,
) -> Response:
    """Delete a notification from the player's notification list."""
    notification = Notification.get(notification_id)
    if notification is None:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    player.delete_notification(notification)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(":markAllRead")
def marked_all_read(user: Annotated[Player, Depends(get_current_user)]) -> Response:
    """Mark all notification as read."""
    user.notifications_read()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
