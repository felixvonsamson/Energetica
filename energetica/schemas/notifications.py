"""Notification-related Pydantic models for request and response validation."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter

if TYPE_CHECKING:
    from energetica.database.messages import Notification


# ---------------------------------------------------------------------------
# Payload variants — one per notification type.
# Each has `type: Literal[...]` at the top level (required for discriminator).
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
# Discriminated union
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
    def from_notification(cls, n: Notification) -> NotificationOut:
        return cls(
            id=n.id,
            time=n.time,
            read=n.read,
            flagged=n.flagged,
            archived=n.archived,
            payload=_payload_adapter.validate_python(n.payload),
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
