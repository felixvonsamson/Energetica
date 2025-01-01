from dataclasses import dataclass, field
from itertools import count
from typing import Any, Callable, ClassVar, Iterator, TypeVar

from energetica.globals import engine

T = TypeVar("T", bound="DBModel")


@dataclass
class DBModel:
    """Base class for all managed objects in the database."""

    __next_id: ClassVar[Iterator[int]]

    id: int = field(init=False)

    def __init_subclass__(cls) -> None:
        """Initialize the next id counter for each subclass."""
        cls.__next_id = count(1)
        engine.data[cls.__name__] = {}

    @classmethod
    @property
    def instances_dict(cls: type[T]) -> dict[int, T]:
        return engine.data[cls.__name__]

    def __post_init__(self) -> None:
        """Assign an id to the object and store it in the engine."""
        self.id = next(self.__next_id)
        self.instances_dict[self.id] = self

    @classmethod
    def get(cls: type[T], id: int) -> T | None:  # pylint: disable=redefined-builtin
        """Get an object by its id."""
        return cls.instances_dict[id] if id in cls.instances_dict else None

    @classmethod
    def all(cls: type[T]) -> Iterator[T]:
        """Get all instances of this class."""
        return cls.instances_dict.values()

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
        del self.instances_dict[self.id]
