"""Test that NotificationType stays in sync with PersistableNotificationPayload."""

from typing import get_args, get_type_hints

from energetica.database.messages import NotificationType
from energetica.schemas.notifications import PersistableNotificationPayload


def test_notification_type_matches_payload_union() -> None:
    """NotificationType must contain exactly the type strings from PersistableNotificationPayload.

    Catches the case where a payload class is added/removed from the union but
    NotificationType (or vice versa) is not updated to match.
    """
    literal_types = set(get_args(NotificationType))

    payload_types: set[str] = set()
    for cls in get_args(PersistableNotificationPayload):
        hints = get_type_hints(cls)
        payload_types.update(get_args(hints["type"]))

    only_in_literal = literal_types - payload_types
    only_in_union = payload_types - literal_types

    assert not only_in_literal and not only_in_union, (
        "NotificationType and PersistableNotificationPayload are out of sync.\n"
        f"  Only in NotificationType:            {only_in_literal}\n"
        f"  Only in PersistableNotificationPayload: {only_in_union}"
    )
