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
        engine.__dict__[cls.__name__] = {}

    def __post_init__(self) -> None:
        """Assign an id to the object and store it in the engine."""
        self.id = next(self.__next_id)
        getattr(engine, self.__class__.__name__)[self.id] = self

    @classmethod
    def get(cls: type[T], id: int) -> T | None:  # pylint: disable=redefined-builtin
        """Get an object by its id."""
        class_objects = getattr(engine, cls.__name__)
        return class_objects[id] if id in class_objects else None

    @classmethod
    def all(cls: type[T]) -> Iterator[T]:
        """Get all instances of this class."""
        return getattr(engine, cls.__name__).values()

    @classmethod
    def count(cls: type[T]) -> int:
        """Get all instances of this class."""
        return len(getattr(engine, cls.__name__))

    # TODO(mglst): there are a number of places where the pattern of filtering, converting to a list, and then getting
    # the length is used. Notably, this is used for filtering and counting OngoingProjects, to compute levels.
    # As such I suggest the following two methods: "count" and "count_by". Advantages include:
    # - More readable code
    # - Less memory usage / better performance
    # Disadvantages include:
    # - More complex DBModel class
    # - More methods to maintain

    # @classmethod
    # def count(cls: type[T], condition: Callable[[T], bool] | None = None) -> int:
    #     """Get all instances of this class."""
    #     if condition is None:
    #         return len(getattr(engine, cls.__name__))
    #     return sum(1 for item in cls.all() if condition(item))

    # @classmethod
    # def count_by(cls: type[T], **conditions: Any) -> int:
    #     """Get all instances of this class."""
    #     return cls.count(lambda item: all(getattr(item, field) == value for field, value in conditions.items()))

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
        del getattr(engine, self.__class__.__name__)[self.id]
