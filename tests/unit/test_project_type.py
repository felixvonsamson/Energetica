"""Tests for the energetica.enums module."""

from energetica.enums import ExtractionFacilityType, Fuel, WorkerType, project_types


def test_associated_fuel_and_mine() -> None:
    """Test the associated_fuel and associated_mine properties."""
    for fuel in Fuel:
        assert fuel.associated_mine.associated_fuel == fuel
    for mine in ExtractionFacilityType:
        assert mine.associated_fuel.associated_mine == mine


def test_associated_worker_type() -> None:
    """Test that each project type has an associated worker type."""
    for project_type in project_types:
        assert project_type.worker_type in WorkerType
