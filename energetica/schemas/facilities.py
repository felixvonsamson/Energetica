"""Schemas for API routes related to facilities."""

from __future__ import annotations

from energetica.database.active_facility import ActiveFacility
from energetica.enums import ExtractionFacilityType, PowerFacilityType, StorageFacilityType, WindFacilityType
from energetica.schemas.common import BaseApiModel


class PowerFacilityOut(BaseApiModel):
    id: int
    facility: PowerFacilityType
    max_power_generation: float
    usage: float
    hourly_op_cost: float
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
            hourly_op_cost=power_facility.hourly_op_cost,
            remaining_lifespan=power_facility.remaining_lifespan,
            upgrade_cost=None if power_facility.decommissioning else power_facility.upgrade_cost,
            dismantle_cost=None if power_facility.decommissioning else power_facility.dismantle_cost,
            cut_out_speed_exceeded=(
                power_facility.cut_out_speed_exceeded
                if isinstance(power_facility.facility_type, WindFacilityType)
                else None
            ),
        )


class StorageFacilityOut(BaseApiModel):
    id: int
    facility: StorageFacilityType
    storage_capacity: float
    state_of_charge: float
    hourly_op_cost: float
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
            hourly_op_cost=storage_facility.hourly_op_cost,
            efficiency=storage_facility.efficiency,
            remaining_lifespan=storage_facility.remaining_lifespan,
            upgrade_cost=None if storage_facility.decommissioning else storage_facility.upgrade_cost,
            dismantle_cost=None if storage_facility.decommissioning else storage_facility.dismantle_cost,
        )


class ExtractionFacilityOut(BaseApiModel):
    id: int
    facility: ExtractionFacilityType
    extraction_rate: float
    usage: float
    hourly_op_cost: float
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
            hourly_op_cost=storage_facility.hourly_op_cost,
            max_power_use=storage_facility.max_power_use,
            remaining_lifespan=storage_facility.remaining_lifespan,
            upgrade_cost=None if storage_facility.decommissioning else storage_facility.upgrade_cost,
            dismantle_cost=None if storage_facility.decommissioning else storage_facility.dismantle_cost,
        )
