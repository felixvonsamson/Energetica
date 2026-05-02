"""Schemas for API routes related to facilities."""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel

from energetica.database.active_facility import ActiveFacility
from energetica.enums import (
    ExtractionFacilityType,
    PowerFacilityType,
    RenewableFacilityType,
    StorageFacilityType,
    WindFacilityType,
)
from energetica.schemas.electricity_markets import AskType, BidType
from energetica.types.facility_statuses import ConsumptionStatus, ProductionStatus, RenewableStatus

if TYPE_CHECKING:
    from energetica.database.player import Player


class PowerFacilityOut(BaseModel):
    id: int
    facility: PowerFacilityType
    max_power_generation: float
    usage: float
    op_cost_per_tick: float
    remaining_lifespan: float | None
    upgrade_cost: float | None
    dismantle_cost: float | None
    cut_out_speed_exceeded: bool | None

    @classmethod
    def from_active_facility(cls, power_facility: ActiveFacility) -> PowerFacilityOut:
        if not isinstance(power_facility.facility_type, PowerFacilityType):
            raise ValueError(f"Cannot create a PowerFacilityOut from ${power_facility.facility_type}")
        return PowerFacilityOut(
            id=power_facility.id,
            facility=power_facility.facility_type,
            max_power_generation=power_facility.max_power_generation,
            usage=power_facility.usage,
            op_cost_per_tick=power_facility.op_cost_per_tick,
            remaining_lifespan=power_facility.remaining_lifespan,
            upgrade_cost=None if power_facility.decommissioning else power_facility.upgrade_cost,
            dismantle_cost=None if power_facility.decommissioning else power_facility.dismantle_cost,
            cut_out_speed_exceeded=(
                power_facility.cut_out_speed_exceeded
                if isinstance(power_facility.facility_type, WindFacilityType)
                else None
            ),
        )


class StorageFacilityOut(BaseModel):
    id: int
    facility: StorageFacilityType
    storage_capacity: float
    state_of_charge: float
    max_power_generation: float
    max_power_use: float
    op_cost_per_tick: float
    efficiency: float
    remaining_lifespan: float | None
    upgrade_cost: float | None
    dismantle_cost: float | None

    @classmethod
    def from_active_facility(cls, storage_facility: ActiveFacility) -> StorageFacilityOut:
        if not isinstance(storage_facility.facility_type, StorageFacilityType):
            raise ValueError(f"Cannot create a StorageFacilityOut from ${storage_facility.facility_type}")
        return StorageFacilityOut(
            id=storage_facility.id,
            facility=storage_facility.facility_type,
            storage_capacity=storage_facility.storage_capacity,
            state_of_charge=storage_facility.state_of_charge,
            max_power_generation=storage_facility.max_power_generation,
            max_power_use=storage_facility.max_power_use,
            op_cost_per_tick=storage_facility.op_cost_per_tick,
            efficiency=storage_facility.efficiency,
            remaining_lifespan=storage_facility.remaining_lifespan,
            upgrade_cost=None if storage_facility.decommissioning else storage_facility.upgrade_cost,
            dismantle_cost=None if storage_facility.decommissioning else storage_facility.dismantle_cost,
        )


class ExtractionFacilityOut(BaseModel):
    id: int
    facility: ExtractionFacilityType
    extraction_rate: float
    usage: float
    op_cost_per_tick: float
    max_power_use: float
    remaining_lifespan: float | None
    upgrade_cost: float | None
    dismantle_cost: float | None

    @classmethod
    def from_active_facility(cls, storage_facility: ActiveFacility) -> ExtractionFacilityOut:
        if not isinstance(storage_facility.facility_type, ExtractionFacilityType):
            raise ValueError(f"Cannot create a ExtractionFacilityOut from ${storage_facility.facility_type}")
        return ExtractionFacilityOut(
            id=storage_facility.id,
            facility=storage_facility.facility_type,
            extraction_rate=storage_facility.extraction_rate,
            usage=storage_facility.usage,
            op_cost_per_tick=storage_facility.op_cost_per_tick,
            max_power_use=storage_facility.max_power_use,
            remaining_lifespan=storage_facility.remaining_lifespan,
            upgrade_cost=None if storage_facility.decommissioning else storage_facility.upgrade_cost,
            dismantle_cost=None if storage_facility.decommissioning else storage_facility.dismantle_cost,
        )


class FacilitiesListOut(BaseModel):
    power_facilities: list[PowerFacilityOut]
    storage_facilities: list[StorageFacilityOut]
    extraction_facilities: list[ExtractionFacilityOut]

    @classmethod
    def from_player(cls, player: Player) -> FacilitiesListOut:
        return FacilitiesListOut(
            power_facilities=[
                PowerFacilityOut.from_active_facility(power_facility) for power_facility in player.power_facilities
            ],
            storage_facilities=[
                StorageFacilityOut.from_active_facility(storage_facility)
                for storage_facility in player.storage_facilities
            ],
            extraction_facilities=[
                ExtractionFacilityOut.from_active_facility(extraction_facility)
                for extraction_facility in player.extraction_facilities
            ],
        )


class FacilityStatuses(BaseModel):
    renewables: dict[RenewableFacilityType, RenewableStatus]
    production: dict[AskType, ProductionStatus]
    consumption: dict[BidType, ConsumptionStatus]

    @classmethod
    def from_player(cls, player: Player) -> FacilityStatuses:
        return FacilityStatuses(
            renewables=player.renewable_statuses,
            production=player.production_statuses,
            consumption=player.consumption_statuses,
        )
