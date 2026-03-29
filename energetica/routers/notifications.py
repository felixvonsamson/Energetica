"""Routes for API for game notifications."""

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path, status

from energetica.database.messages import Notification
from energetica.database.player import Player
from energetica.schemas.notifications import (
    NotificationFeedSubscriptionsIn,
    NotificationFeedSubscriptionsOut,
    NotificationListOut,
    NotificationOut,
    NotificationPatchIn,
)
from energetica.utils.auth import get_settled_player

router = APIRouter(prefix="/notifications", tags=["Game Notifications"])


@router.get("")
def get_notifications(player: Annotated[Player, Depends(get_settled_player)]) -> NotificationListOut:
    """Get all notifications for the current player."""
    return NotificationListOut(
        notifications=[
            out
            for notification in player.notifications
            if (out := NotificationOut.from_notification(notification)) is not None
        ]
    )


# IMPORTANT: feed-subscriptions routes must come BEFORE /{notification_id} to avoid
# FastAPI matching "feed-subscriptions" as a path parameter.


@router.get("/feed-subscriptions")
def get_feed_subscriptions(
    player: Annotated[Player, Depends(get_settled_player)],
) -> NotificationFeedSubscriptionsOut:
    """Get notification feed subscriptions for the current player."""
    return NotificationFeedSubscriptionsOut(**player.notification_feed_subscriptions)


@router.patch("/feed-subscriptions", status_code=status.HTTP_204_NO_CONTENT)
def patch_feed_subscriptions(
    player: Annotated[Player, Depends(get_settled_player)],
    body: Annotated[NotificationFeedSubscriptionsIn, Body(...)],
) -> None:
    """Update notification feed subscriptions for the current player."""
    for field_name, value in body.model_dump(exclude_none=True).items():
        player.notification_feed_subscriptions[field_name] = value


@router.patch("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def patch_notification(
    player: Annotated[Player, Depends(get_settled_player)],
    notification_id: Annotated[int, Path(...)],
    body: Annotated[NotificationPatchIn, Body(...)],
) -> None:
    """Update read/flagged/archived state of a notification."""
    notification = Notification.get(notification_id)
    if notification is None or notification.player != player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if body.read is not None:
        notification.read = body.read
    if body.flagged is not None:
        notification.flagged = body.flagged
    if body.archived is not None:
        notification.archived = body.archived


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    player: Annotated[Player, Depends(get_settled_player)],
    notification_id: int,
) -> None:
    """Delete a notification from the player's notification list."""
    notification = Notification.get(notification_id)
    if notification is None or notification.player != player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    player.delete_notification(notification)


@router.post(":markAllRead", status_code=status.HTTP_204_NO_CONTENT)
def marked_all_read(player: Annotated[Player, Depends(get_settled_player)]) -> None:
    """Mark all notification as read."""
    player.notifications_read()
