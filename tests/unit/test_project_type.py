"""Tests for the energetica.enums module."""

import pickle

from energetica.enums import ExtractionFacilityType, Fuel, ProjectStatus, WorkerType, project_types


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


def test_project_status_ordering_all_pairs() -> None:
    """Test all pairs of ProjectStatus comparisons preserve PAUSED < WAITING < ONGOING ordering."""
    # Test less than
    assert ProjectStatus.PAUSED < ProjectStatus.WAITING
    assert ProjectStatus.PAUSED < ProjectStatus.ONGOING
    assert ProjectStatus.WAITING < ProjectStatus.ONGOING

    # Test greater than
    assert ProjectStatus.ONGOING > ProjectStatus.WAITING
    assert ProjectStatus.ONGOING > ProjectStatus.PAUSED
    assert ProjectStatus.WAITING > ProjectStatus.PAUSED

    # Test less than or equal
    assert ProjectStatus.PAUSED <= ProjectStatus.PAUSED
    assert ProjectStatus.PAUSED <= ProjectStatus.WAITING
    assert ProjectStatus.PAUSED <= ProjectStatus.ONGOING
    assert ProjectStatus.WAITING <= ProjectStatus.WAITING
    assert ProjectStatus.WAITING <= ProjectStatus.ONGOING
    assert ProjectStatus.ONGOING <= ProjectStatus.ONGOING

    # Test greater than or equal
    assert ProjectStatus.PAUSED >= ProjectStatus.PAUSED
    assert ProjectStatus.WAITING >= ProjectStatus.PAUSED
    assert ProjectStatus.WAITING >= ProjectStatus.WAITING
    assert ProjectStatus.ONGOING >= ProjectStatus.PAUSED
    assert ProjectStatus.ONGOING >= ProjectStatus.WAITING
    assert ProjectStatus.ONGOING >= ProjectStatus.ONGOING

    # Test negations (ensure transitivity)
    assert not (ProjectStatus.WAITING < ProjectStatus.PAUSED)
    assert not (ProjectStatus.ONGOING < ProjectStatus.WAITING)
    assert not (ProjectStatus.ONGOING < ProjectStatus.PAUSED)


def test_project_status_sorting() -> None:
    """Test that sorted() respects the custom ordering."""
    unsorted = [ProjectStatus.ONGOING, ProjectStatus.PAUSED, ProjectStatus.WAITING]

    # Sort ascending: PAUSED, WAITING, ONGOING
    ascending = sorted(unsorted)
    assert ascending == [ProjectStatus.PAUSED, ProjectStatus.WAITING, ProjectStatus.ONGOING]

    # Sort descending: ONGOING, WAITING, PAUSED
    descending = sorted(unsorted, reverse=True)
    assert descending == [ProjectStatus.ONGOING, ProjectStatus.WAITING, ProjectStatus.PAUSED]


def test_project_status_pickle_roundtrip() -> None:
    """Test that ProjectStatus can be pickled and unpickled correctly."""
    for status in [ProjectStatus.PAUSED, ProjectStatus.WAITING, ProjectStatus.ONGOING]:
        pickled = pickle.dumps(status)
        unpickled = pickle.loads(pickled)
        assert unpickled == status
        assert unpickled.value == status.value
        assert type(unpickled) is ProjectStatus
