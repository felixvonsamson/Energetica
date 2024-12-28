from dataclasses import dataclass, field
from itertools import count
from typing import Any, Callable, Iterator, TypeVar

T = TypeVar("T", bound="DB")
from energetica import engine


@dataclass
class DB:
    id: int = field(init=False)

    def __init_subclass__(cls) -> None:
        """Initialize the next id counter for each subclass."""
        cls.__next_id = count()
        engine.__dict__[cls.__name__] = {}

    def __post_init__(self) -> None:
        """Assign an id to the object and store it in the engine."""
        self.id = next(self.__next_id)
        getattr(engine, self.__class__.__name__)[self.id] = self

    @classmethod
    def get(cls: type[T], id: int) -> T:
        """Get an object by its id."""
        return getattr(engine, cls.__name__)[id]

    @classmethod
    def all(cls: type[T]) -> Iterator[T]:
        """Get all instances of this class."""
        return getattr(engine, cls.__name__).values()

    @classmethod
    def count(cls: type[T]) -> int:
        """Get all instances of this class."""
        return len(getattr(engine, cls.__name__))

    @classmethod
    def filter(cls: type[T], condition: Callable[[T], bool]) -> Iterator[T]:
        """Filter instances of this class by a condition method."""
        return filter(condition, cls.all())

    @classmethod
    def filter_by(cls: type[T], **conditions: Any) -> Iterator[T]:
        """Filter instances of this class by a list of conditions."""
        return cls.filter(lambda item: all(getattr(item, field) == value for field, value in conditions))

    def __del__(self: T) -> None:
        """Get an object by its id."""
        del getattr(engine, self.__class__.__name__)[self.id]
