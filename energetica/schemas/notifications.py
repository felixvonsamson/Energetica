"""Notification-related Pydantic models for request and response validation."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from energetica.database.messages import Notification


class NotificationOut(BaseModel):
    """Response model for a notification."""

    id: int
    title: str
    content: str
    time: datetime
    read: bool

    @classmethod
    def from_notification(cls, notification: Notification) -> NotificationOut:
        """Create a NotificationOut instance from a Notification."""
        return NotificationOut(
            id=notification.id,
            title=notification.title,
            content=notification.content,
            time=notification.time,
            read=notification.read,
        )


class NotificationListOut(BaseModel):
    """Response model for the notification list."""

    notifications: list[NotificationOut]
