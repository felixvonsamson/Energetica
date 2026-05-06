"""Schemas for the weather api."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from energetica.enums import ClimateEventType

if TYPE_CHECKING:
    from energetica.database.climate_event_recovery import ClimateEventRecovery
    from energetica.database.player import Player


class WeatherOut(BaseModel):
    year_progress: float = Field(ge=0, le=1, description="Fractional progression of the current year, from 0.0 to 1.0")
    month_number: int = Field(ge=1, le=12, description="1=January, 2=February, ...")
    solar_irradiance: float = Field(description="Solar irradiance in W/m², capped at 950")
    clear_sky_value: float = Field(description="Clear sky irradiance in W/m² (before cloud cover)")
    clear_sky_index: float = Field(
        description="Clear sky index (0–1): fraction of clear sky irradiance reaching ground"
    )
    wind_speed: float = Field(description="Wind speed in km/h")
    river_flow_speed: float = Field(description="River flow speed in m/s")


class ClimateEventRecoveryOut(BaseModel):
    id: int
    event_key: ClimateEventType
    end_tick: float = Field(description="Tick at which the recovery completes")
    duration: float = Field(description="Total recovery duration in ticks")
    recovery_cost: float = Field(description="Recovery cost per tick in ¤/tick")

    @classmethod
    def from_recovery(cls, recovery: ClimateEventRecovery) -> ClimateEventRecoveryOut:
        return ClimateEventRecoveryOut(
            id=recovery.id,
            event_key=ClimateEventType(recovery.name),
            end_tick=recovery.end_tick,
            duration=recovery.duration,
            recovery_cost=recovery.recovery_cost,
        )


class ClimateEventRecoveryListOut(BaseModel):
    recoveries: list[ClimateEventRecoveryOut] = Field(description="List of active climate event recoveries")

    @classmethod
    def from_player(cls, player: Player) -> ClimateEventRecoveryListOut:
        from energetica.database.climate_event_recovery import ClimateEventRecovery

        recoveries = [
            ClimateEventRecoveryOut.from_recovery(recovery)
            for recovery in ClimateEventRecovery.filter_by(player=player)
        ]
        return ClimateEventRecoveryListOut(recoveries=recoveries)
