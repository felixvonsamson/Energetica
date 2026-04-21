"""Lightweight record of a banned player, kept for historical data attribution."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class BannedRecord:
    id: int
    username: str
    banned_at: datetime
