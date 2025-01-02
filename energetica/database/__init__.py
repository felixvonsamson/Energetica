"""Database module for the Energetica application."""

from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from itertools import count
from typing import Any, Generic, TypeVar

from energetica.globals import engine

T = TypeVar("T", bound="DBModel")


class AutoIDDict(Generic[T], dict[int, T]):
    """Dictionary that automatically assigns an id to each item added."""

    def __init__(self) -> None:
        """Initialize the next id counter."""
        self.reset()

    def reset(self) -> None:
        """Clear the dictionary and reset the next id counter."""
        self.clear()
        self._next_id = count(1)

    def add(self, item: T) -> None:
        """Add an item to the dictionary and assign it an id."""
        item.id = next(self._next_id)
        self[item.id] = item


@dataclass
class DBModel:
    """Base class for all managed objects in the database."""

    id: int = field(init=False)

    def __init_subclass__(cls) -> None:
        """Initialize the next id counter for each subclass."""
        engine.data[cls.__name__] = AutoIDDict()

    @classmethod
    def instances(cls: type[T]) -> AutoIDDict[T]:
        """Get the dictionary of instances for this class."""
        return engine.data[cls.__name__]

    def __post_init__(self) -> None:
        """Assign an id to the object and store it in the engine."""
        self.instances().add(self)

    @classmethod
    def get(cls: type[T], id: int) -> T | None:  # pylint: disable=redefined-builtin
        """Get an object by its id."""
        return cls.instances().get(id, None)

    @classmethod
    def all(cls: type[T]) -> Iterator[T]:
        """Get all instances of this class."""
        return (v for v in cls.instances().values())

    @classmethod
    def count(cls: type[T], *, condition: Callable[[T], bool] | None = None) -> int:
        """Get all instances of this class."""
        return sum(1 for _ in (cls.filter(condition) if condition else cls.all()))

    @classmethod
    def count_when(cls: type[T], **conditions: Any) -> int:
        """Get all instances of this class."""
        return sum(1 for _ in cls.filter_by(**conditions))

    @classmethod
    def filter(cls: type[T], condition: Callable[[T], bool]) -> Iterator[T]:
        """Filter instances of this class by a condition method."""
        return filter(condition, cls.all())

    @classmethod
    def filter_by(cls: type[T], **conditions: Any) -> Iterator[T]:
        """Filter instances of this class by a list of conditions."""
        return cls.filter(lambda item: all(getattr(item, field) == value for field, value in conditions.items()))

    def delete(self: T) -> None:
        """Delete the object from the engine."""
        del self.instances()[self.id]
