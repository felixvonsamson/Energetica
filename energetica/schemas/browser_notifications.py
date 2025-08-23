"""Schemas for API for app services."""

from pydantic import BaseModel


class VapidPublicKey(BaseModel):
    public_key: str


class Subscription(BaseModel):
    endpoint: str
    keys: dict[str, str] = {}
