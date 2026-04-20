"""Notification-related Pydantic models for request and response validation."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from energetica.enums import (
    ClimateEventType,
    Fuel,
    ProjectType,
    TechnologyType,
)
from energetica.enums import FacilityType

if TYPE_CHECKING:
    from energetica.database.messages import Notification

# ---------------------------------------------------------------------------
# Payload variants — one per notification type.
#
# Rules:
#  - `type: Literal["..."]` must be the first field (Pydantic uses it as the
#    discriminator key to select the correct variant at validation time).
#  - After adding a class here you MUST also add it to NotificationPayload
#    below — defining the class alone has no effect.
#  - The type string must match the corresponding entry in NotificationType
#    (energetica/database/messages.py). Pydantic validates this at runtime;
#    the type checker does not cross-check across the two files.
# ---------------------------------------------------------------------------


class ConstructionFinishedPayload(BaseModel):
    type: Literal["construction_finished"] = "construction_finished"
    project_type: ProjectType
    level: int | None = None  # None for non-levelable facilities


class TechnologyResearchedPayload(BaseModel):
    type: Literal["technology_researched"] = "technology_researched"
    technology_type: TechnologyType
    new_level: int


class FacilityDecommissionedPayload(BaseModel):
    type: Literal["facility_decommissioned"] = "facility_decommissioned"
    facility_type: FacilityType
    dismantle_cost: float


class FacilityDestroyedPayload(BaseModel):
    type: Literal["facility_destroyed"] = "facility_destroyed"
    facility_type: FacilityType
    event_key: ClimateEventType
    cleanup_cost: float


class EmergencyFacilityCreatedPayload(BaseModel):
    type: Literal["emergency_facility_created"] = "emergency_facility_created"
    facility_type: FacilityType


class ClimateEventPayload(BaseModel):
    type: Literal["climate_event"] = "climate_event"
    event_key: ClimateEventType
    duration_days: int
    cost_per_hour: float


class ResourceSoldPayload(BaseModel):
    type: Literal["resource_sold"] = "resource_sold"
    buyer_username: str
    resource: Fuel
    quantity_kg: float
    total_price: float


class ShipmentArrivedPayload(BaseModel):
    type: Literal["shipment_arrived"] = "shipment_arrived"
    resource: str
    quantity_kg: float
    stored_kg: float
    warehouse_full: bool


class NetworkExpelledPayload(BaseModel):
    type: Literal["network_expelled"] = "network_expelled"
    network_name: str


class AchievementUnlockPayload(BaseModel):
    """One-shot achievement unlocked by constructing a specific facility."""

    type: Literal["achievement_unlock"] = "achievement_unlock"
    achievement_key: Literal["laboratory", "warehouse", "storage_facilities", "GHG_effect"]
    xp: int


class TutorialPushNotificationsPayload(BaseModel):
    """Tutorial notification encouraging the player to enable browser push notifications."""

    type: Literal["tutorial_push_notifications"] = "tutorial_push_notifications"


class ChatMessagePayload(BaseModel):
    type: Literal["chat_message"] = "chat_message"
    sender_username: str
    message: str
    chat_id: int


class PushNotificationTestPayload(BaseModel):
    """Dummy notification used exclusively for end-to-end push notification testing."""

    type: Literal["push_notification_test"] = "push_notification_test"


class QuizReminderPayload(BaseModel):
    """Push-only reminder that a new daily quiz is available."""

    type: Literal["quiz_reminder"] = "quiz_reminder"


# ---------------------------------------------------------------------------
# Achievement milestone payload — discriminated union on achievement_key.
# All variants share type: Literal["achievement_milestone"].
# ---------------------------------------------------------------------------


class AchievementMilestonePowerConsumptionPayload(BaseModel):
    type: Literal["achievement_milestone"] = "achievement_milestone"
    achievement_key: Literal["power_consumption"]
    comparison_key: Literal[
        "village-in-europe",
        "city-of-basel",
        "switzerland",
        "japan",
        "world-population",
    ]
    threshold: float
    xp: int


class AchievementMilestoneEnergyStoragePayload(BaseModel):
    type: Literal["achievement_milestone"] = "achievement_milestone"
    achievement_key: Literal["energy_storage"]
    comparison_key: Literal[
        "zurich-for-a-day",
        "switzerland-for-a-day",
        "switzerland-for-a-month",
    ]
    threshold: float
    xp: int


class AchievementMilestoneBasePayload(BaseModel):
    """Milestone achievement without a real-world comparison."""

    type: Literal["achievement_milestone"] = "achievement_milestone"
    achievement_key: Literal[
        "mineral_extraction",
        "network_import",
        "network_export",
        "network",
        "technology",
        "trading_export",
        "trading_import",
    ]
    threshold: float
    xp: int


AchievementMilestonePayload = Annotated[
    Union[
        AchievementMilestonePowerConsumptionPayload,
        AchievementMilestoneEnergyStoragePayload,
        AchievementMilestoneBasePayload,
    ],
    Field(discriminator="achievement_key"),
]


# ---------------------------------------------------------------------------
# Discriminated union — register every payload variant here.
# Adding a new *Payload class above without adding it to this union means
# it will never be reachable; no error will be raised.
# ---------------------------------------------------------------------------

# Payloads that create a persistent Notification record (the in-game inbox).
PersistableNotificationPayload = Union[
    ConstructionFinishedPayload,
    TechnologyResearchedPayload,
    FacilityDecommissionedPayload,
    FacilityDestroyedPayload,
    EmergencyFacilityCreatedPayload,
    ClimateEventPayload,
    ResourceSoldPayload,
    ShipmentArrivedPayload,
    NetworkExpelledPayload,
    AchievementMilestonePowerConsumptionPayload,
    AchievementMilestoneEnergyStoragePayload,
    AchievementMilestoneBasePayload,
    AchievementUnlockPayload,
    TutorialPushNotificationsPayload,
]

# Payloads that only trigger a browser push — no inbox entry.
PushOnlyPayload = Union[
    ChatMessagePayload,
    PushNotificationTestPayload,
    QuizReminderPayload,
]

# Full union — used by the service worker / push text generation.
NotificationPayload = Union[PersistableNotificationPayload, PushOnlyPayload]

_payload_adapter = TypeAdapter(NotificationPayload)
_persistable_payload_adapter = TypeAdapter(PersistableNotificationPayload)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class NotificationOut(BaseModel):
    id: int
    time: datetime
    read: bool
    flagged: bool
    archived: bool
    payload: PersistableNotificationPayload

    @classmethod
    def from_notification(cls, n: Notification) -> NotificationOut | None:
        """Convert a DB Notification to its API representation.

        Returns None (and silently skips the notification) if the stored
        payload does not match its declared type — which can happen when a
        notification was created by an older code version before a payload
        schema change. The GET /notifications endpoint filters out Nones so
        one malformed notification does not block the rest.
        """
        try:
            payload = _persistable_payload_adapter.validate_python({**n.payload, "type": n.type})
        except ValidationError:
            return None
        return cls(
            id=n.id,
            time=n.time,
            read=n.read,
            flagged=n.flagged,
            archived=n.archived,
            payload=payload,
        )


class NotificationListOut(BaseModel):
    notifications: list[NotificationOut]


# ---------------------------------------------------------------------------
# Patch schema
# ---------------------------------------------------------------------------


class NotificationPatchIn(BaseModel):
    read: bool | None = None
    flagged: bool | None = None
    archived: bool | None = None


# ---------------------------------------------------------------------------
# Subscription preferences
# ---------------------------------------------------------------------------


class NotificationFeedSubscriptionsOut(BaseModel):
    resource_market_bid: bool
    network_join_leave: bool


class NotificationFeedSubscriptionsIn(BaseModel):
    resource_market_bid: bool | None = None
    network_join_leave: bool | None = None
