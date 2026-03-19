"""Notification-related Pydantic models for request and response validation."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter, ValidationError

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
    type: Literal["construction_finished"]
    project_type: str
    project_name: str
    level: int | None = None  # None for non-levelable facilities


class TechnologyResearchedPayload(BaseModel):
    type: Literal["technology_researched"]
    technology_type: str
    technology_name: str
    new_level: int


class FacilityDecommissionedPayload(BaseModel):
    type: Literal["facility_decommissioned"]
    facility_name: str
    dismantle_cost: float


class FacilityDestroyedPayload(BaseModel):
    type: Literal["facility_destroyed"]
    facility_name: str
    event_name: str
    cleanup_cost: float


class EmergencyFacilityCreatedPayload(BaseModel):
    type: Literal["emergency_facility_created"]
    facility_name: str


class ClimateEventPayload(BaseModel):
    type: Literal["climate_event"]
    event_name: str
    duration_days: int
    cost_per_hour: str


class ResourceSoldPayload(BaseModel):
    type: Literal["resource_sold"]
    buyer_username: str
    resource: str
    quantity_kg: float
    total_price: float


class ShipmentArrivedPayload(BaseModel):
    type: Literal["shipment_arrived"]
    resource: str
    quantity_kg: float
    stored_kg: float
    warehouse_full: bool


class CreditLimitExceededPayload(BaseModel):
    type: Literal["credit_limit_exceeded"]


class AchievementUnlockedPayload(BaseModel):
    type: Literal["achievement_unlocked"]
    achievement_key: str
    achievement_name: str


# ---------------------------------------------------------------------------
# Discriminated union — register every payload variant here.
# Adding a new *Payload class above without adding it to this union means
# it will never be reachable; no error will be raised.
# ---------------------------------------------------------------------------

NotificationPayload = Annotated[
    Union[
        ConstructionFinishedPayload,
        TechnologyResearchedPayload,
        FacilityDecommissionedPayload,
        FacilityDestroyedPayload,
        EmergencyFacilityCreatedPayload,
        ClimateEventPayload,
        ResourceSoldPayload,
        ShipmentArrivedPayload,
        CreditLimitExceededPayload,
        AchievementUnlockedPayload,
    ],
    Field(discriminator="type"),
]

_payload_adapter = TypeAdapter(NotificationPayload)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class NotificationOut(BaseModel):
    id: int
    time: datetime
    read: bool
    flagged: bool
    archived: bool
    payload: NotificationPayload

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
            payload = _payload_adapter.validate_python({**n.payload, "type": n.type})
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


class NotificationSubscriptionPrefsOut(BaseModel):
    resource_market_bid: bool
    network_join_leave: bool
    resource_market_bid_push: bool
    network_join_leave_push: bool


class NotificationSubscriptionPrefsIn(BaseModel):
    resource_market_bid: bool | None = None
    network_join_leave: bool | None = None
    resource_market_bid_push: bool | None = None
    network_join_leave_push: bool | None = None
