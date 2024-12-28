from dataclasses import dataclass, field
from itertools import count
from typing import Callable, Iterator, Type, TypeVar

T = TypeVar("T", bound="DB")
from energetica import engine


@dataclass
class DB:
    id: int = field(init=False)

    def __init_subclass__(cls):
        cls.__next_id = count()

    def __post_init__(self):
        self.id = next(self.__next_id)
        getattr(engine, self.__class__.__name__)[self.id] = self

    @classmethod
    def get(cls: Type[T], id: int) -> T:
        """Get an object by its id."""
        return getattr(engine, cls.__name__)[id]

    @classmethod
    def all(cls: Type[T]) -> Iterator[T]:
        """Get all instances of this class"""
        return getattr(engine, cls.__name__).values()

    @classmethod
    def count(cls: Type[T]) -> int:
        """Get all instances of this class"""
        return len(getattr(engine, cls.__name__))

    @classmethod
    def filter(cls: Type[T], condition: Callable[[T], bool]) -> Iterator[T]:
        """Filter instances of this class by a condition method."""
        return filter(condition, cls.all())

    @classmethod
    def filter_by(cls: Type[T], **conditions) -> Iterator[T]:
        """Filter instances of this class by a list of conditions."""
        return cls.filter(lambda item: all(getattr(item, field) == value for field, value in conditions))

    def __del__(self: T) -> None:
        """Get an object by its id."""
        del getattr(engine, type(T).__name__)[self.id]
