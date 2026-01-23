"""Routes for API for game notifications."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from energetica.database.messages import Notification
from energetica.database.player import Player
from energetica.schemas.notifications import NotificationListOut, NotificationOut
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/notifications", tags=["Game Notifications"])


@router.get("")
def get_notifications(player: Annotated[Player, Depends(get_settled_player)]) -> NotificationListOut:
    """Get all notifications for the current player."""
    return NotificationListOut(
        notifications=[NotificationOut.from_notification(notification) for notification in player.notifications]
    )


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    player: Annotated[Player, Depends(get_settled_player)],
    notification_id: int,
) -> None:
    """Delete a notification from the player's notification list."""
    notification = Notification.get(notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    player.delete_notification(notification)


@router.post(":markAllRead", status_code=status.HTTP_204_NO_CONTENT)
def marked_all_read(player: Annotated[Player, Depends(get_settled_player)]) -> None:
    """Mark all notification as read."""
    player.notifications_read()
