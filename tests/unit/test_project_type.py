"""Tests for the energetica.enums module."""

from energetica.enums import (
    ExtractionFacilityType,
    Fuel,
)


def test_associated_fuel_and_mine():
    """Test the associated_fuel and associated_mine properties."""
    for fuel in Fuel:
        assert fuel.associated_mine.associated_fuel == fuel
    for mine in ExtractionFacilityType:
        assert mine.associated_fuel.associated_mine == mine
