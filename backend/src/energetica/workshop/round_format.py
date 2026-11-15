"""How a Workshop Round's Trading periods are simulated, and which storage they allow (#1004, #992 §2).

Three levers make up a Round's format:

- The **trading-round format**. In representative-week mode the middle week of the season stands for each
  Trading period, with borrowed weather, scaled to the season (ADR-0008). In full-season mode every day of the
  season is simulated.
- The **clearings per day**: how often the market clears within a simulated day, 24, 96 or 288 times.
  It sets how much intraday detail players see, in either format.
- The **storage availability**: no storage, batteries only, or every storage type. Every type needs
  full-season mode. With one representative week per season, seasonal storage could charge cheaply in the
  spring week and sell in the summer week with none of the real time in between, which is an exploit.

Each Round has its own format, part of its plan (:mod:`~energetica.workshop.round_plan`, #1190). The facilitator
changes it until the plan locks, a Round ahead.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

TradingFormat = Literal["representative_week", "full_season"]
ClearingsPerDay = Literal[24, 96, 288]
StorageAvailability = Literal["off", "batteries", "all"]


class RoundFormat(BaseModel):
    """The format of one Round."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    trading_format: TradingFormat = Field(
        default="representative_week",
        description="How each Trading period is simulated: one representative week scaled to the season, or every "
        "day of the season",
    )
    clearings_per_day: ClearingsPerDay = Field(
        default=24, description="How many times a day the market clears in a Trading period"
    )
    storage: StorageAvailability = Field(
        default="batteries",
        description="Which storage players can buy: none, batteries only, or every type. Every type needs the "
        "full-season format",
    )

    @model_validator(mode="after")
    def _all_storage_needs_full_season(self) -> RoundFormat:
        if self.storage == "all" and self.trading_format != "full_season":
            raise ValueError("every storage type is only allowed in the full-season format")
        return self
