"""Schemas for API for app services."""

from __future__ import annotations

from pydantic import BaseModel


class VapidPublicKey(BaseModel):
    public_key: str


class Subscription(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str
