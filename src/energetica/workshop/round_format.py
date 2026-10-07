"""How a Workshop Round's Trading periods are simulated, and which storage they allow (#1004, #992 §2).

Three levers make up a Round's format:

- The **trading-round format**. In representative-day mode one simulated day stands for each Trading
  period, scaled to the season. In full-season mode every day of the season is simulated.
- The **clearings per day**: how often the market clears within a simulated day, 24, 96 or 288 times.
  It sets how much intraday detail players see, in either format.
- The **storage availability**: no storage, batteries only, or every storage type. Every type needs
  full-season mode. With one representative day per season, storage could charge cheaply on the spring
  day and sell on the summer day with none of the real time in between, which is an exploit.

The moderator changes the levers at any time. A Round keeps the format it started with, so a change
takes effect at the next Round.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

TradingFormat = Literal["representative_day", "full_season"]
ClearingsPerDay = Literal[24, 96, 288]
StorageAvailability = Literal["off", "batteries", "all"]


class RoundFormat(BaseModel):
    """The format of one Round."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    trading_format: TradingFormat = Field(
        default="representative_day",
        description="How each Trading period is simulated: one representative day scaled to the season, or every "
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
