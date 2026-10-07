"""The seasons of a Workshop Round (#992). Each Round has one Trading period per season, in this order."""

from __future__ import annotations

from typing import Literal, get_args

Season = Literal["spring", "summer", "autumn", "winter"]
SEASONS: tuple[Season, ...] = get_args(Season)
