"""Schemas for API for app services."""

from pydantic import BaseModel


class Subscription(BaseModel):
    endpoint: str
    keys: dict[str, str] = {}
