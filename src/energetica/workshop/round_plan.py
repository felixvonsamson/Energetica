"""Each Round's plan: its levers and its planned events (#1190).

A session holds one :class:`RoundPlan` per Round. When the session is created, each plan is copied from the
**default plan**, :data:`DEFAULT_PLAN`, the lever configuration the workshop recommends for each Round. The
facilitator then edits the copies. A plan is **locked** once players can rely on it: Round 1's when the session
starts, and Round N+1's when Recap N opens, since the Recap tells players what is coming. The session works out
which Rounds are locked from where it is, and refuses to change a locked plan.

A plan's levers are the Round's format (:mod:`~energetica.workshop.round_format`), its fuel procurement
(:mod:`~energetica.workshop.fuel`), and whether players vote on a carbon tax in it
(:mod:`~energetica.workshop.votes`). Changing a lever in one Round also changes it in every later Round, so a
change made early lasts. A change names only the levers it sets (:class:`LeverChanges`), and those that differ
from the Round's carry, each on its own: the trading format, the clearings per day, the storage availability, the
fuel procurement and the carbon tax vote. A lever the change leaves out stays as it is in every Round. A change that
would leave the Round or a later one invalid, such as every storage type in a Round with a representative week, is
refused.

A plan's events are the vignettes (:mod:`~energetica.workshop.events`) the facilitator planned for the Round: a
Round event fires when its Investment phase opens, and a seasonal event when the Trading period of its season
opens. Each category holds one event per boundary, as before: one per Round for a Round event, and one per
season for a seasonal event. Events never carry to later Rounds, and Round 1 holds none. An event planned for a
season that a blackout skips never fires, but stays in the plan.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from energetica.workshop.events import (
    EVENTS,
    EventPick,
    FiredEvent,
    InvalidPickError,
    WorkshopEvent,
    slot,
    validate_pick,
)
from energetica.workshop.fuel import FuelProcurement
from energetica.workshop.game_error import WorkshopError, WorkshopErrorCode
from energetica.workshop.round_format import ClearingsPerDay, RoundFormat, StorageAvailability, TradingFormat
from energetica.workshop.seasons import SEASONS, Season


class RoundLevers(BaseModel):
    """The levers of one Round, fixed for the whole Round."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    # A default instance rather than a factory, so the schema states the default and the generated
    # types do not mark the format optional. The format is frozen, so sharing the instance is safe.
    round_format: RoundFormat = RoundFormat()
    fuel_procurement: FuelProcurement = Field(default="automatic", description="How players get fuel in the Round")
    carbon_tax_vote: bool = Field(
        default=False,
        description="Whether players vote on a carbon tax in the Round's Investment phase. Once a vote closes, the "
        "lever turns off in the later Rounds, and once a carbon tax has passed, it cannot be turned on again",
    )


#: The levers the workshop recommends for each Round, in order. A shorter session uses the start of the list, and a
#: longer one repeats its last entry. A placeholder until the game-balance pass (#1145).
DEFAULT_PLAN: tuple[RoundLevers, ...] = (RoundLevers(),)


class PlannedEvent(EventPick):
    """An event planned for a Round, and for a seasonal event, a season."""

    season: Season | None = Field(
        default=None,
        description="The season whose Trading period it fires at, for a seasonal event. Null for a Round event, "
        "which fires when the Round's Investment phase opens",
    )


class RoundPlan(BaseModel):
    """One Round's levers and planned events."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    levers: RoundLevers
    events: list[PlannedEvent] = Field(default=[], description="The events planned for the Round, in planning order")


EventStatus = Literal["planned", "fired", "skipped"]


class LeverChanges(BaseModel):
    """The levers a change to one Round sets. A lever left out stays as it is."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    trading_format: TradingFormat | None = None
    clearings_per_day: ClearingsPerDay | None = None
    storage: StorageAvailability | None = None
    fuel_procurement: FuelProcurement | None = None
    carbon_tax_vote: bool | None = None


class InvalidLeversError(WorkshopError):
    """Raised when a lever change would leave a Round invalid: the Round changed, or a later one it carries to."""

    code = WorkshopErrorCode.WORKSHOP_LEVERS_INVALID

    def __init__(self, round_number: int) -> None:
        super().__init__(f"the change would leave Round {round_number} invalid", round=round_number)
        self.round_number = round_number


def plans_from(default: Sequence[RoundLevers], *, round_count: int) -> list[RoundPlan]:
    """One plan per Round of a session of ``round_count`` Rounds, copied from ``default``."""
    return [RoundPlan(levers=default[min(index, len(default) - 1)]) for index in range(round_count)]


def _flat(levers: RoundLevers) -> dict[str, object]:
    """Each lever on its own, by name."""
    return {
        **levers.round_format.model_dump(),
        "fuel_procurement": levers.fuel_procurement,
        "carbon_tax_vote": levers.carbon_tax_vote,
    }


def _from_flat(flat: dict[str, object]) -> RoundLevers:
    fuel_procurement = flat.pop("fuel_procurement")
    carbon_tax_vote = flat.pop("carbon_tax_vote")
    return RoundLevers.model_validate(
        {"round_format": flat, "fuel_procurement": fuel_procurement, "carbon_tax_vote": carbon_tax_vote}
    )


def with_levers(plans: Sequence[RoundPlan], round_number: int, changes: LeverChanges) -> list[RoundPlan]:
    """``plans`` with ``changes`` applied to Round ``round_number``, and each lever that changed there carried to
    every later Round. Earlier Rounds, the levers ``changes`` leaves out, and every Round's events stay as they were.

    Raises :class:`InvalidLeversError`, naming the first such Round, if the Round or a later one would be invalid.
    """
    index = round_number - 1
    before = _flat(plans[index].levers)
    changed = {name: value for name, value in changes.model_dump(exclude_none=True).items() if before[name] != value}
    if not changed:
        return list(plans)
    updated = list(plans[:index])
    for number, plan in enumerate(plans[index:], start=round_number):
        try:
            levers = _from_flat({**_flat(plan.levers), **changed})
        except ValidationError as exc:
            raise InvalidLeversError(number) from exc
        updated.append(plan.model_copy(update={"levers": levers}))
    return updated


def validate_planned(planned: PlannedEvent) -> WorkshopEvent:
    """The event ``planned`` names, or :class:`~energetica.workshop.events.InvalidPickError` if the pick is not one
    the facilitator can make, a seasonal event has no season, or a Round event has one.
    """
    event = validate_pick(planned)
    if event.boundary_type == "trading_period" and planned.season is None:
        raise InvalidPickError(f"{event.name} fires with a Trading period, so it needs a season")
    if event.boundary_type == "round" and planned.season is not None:
        raise InvalidPickError(f"{event.name} fires with the Round, so it takes no season")
    return event


def with_event(plan: RoundPlan, planned: PlannedEvent) -> RoundPlan:
    """``plan`` with ``planned`` in place of any event in the same slot: the same category and boundary, and for a
    seasonal event the same season. Raises like :func:`validate_planned`.
    """
    event = validate_planned(planned)
    place = (slot(event), planned.season)
    kept = [other for other in plan.events if (slot(EVENTS[other.event]), other.season) != place]
    return plan.model_copy(update={"events": [*kept, planned]})


def without_event(plan: RoundPlan, event_id: str, season: Season | None) -> RoundPlan:
    """``plan`` without the event ``event_id`` planned for ``season``, or for the Round if None."""
    return plan.model_copy(
        update={"events": [other for other in plan.events if (other.event, other.season) != (event_id, season)]}
    )


def still_valid(planned: PlannedEvent) -> bool:
    """Whether ``planned``, saved earlier, is still one the facilitator could plan."""
    try:
        validate_planned(planned)
    except InvalidPickError:
        return False
    return True


def event_status(
    planned: PlannedEvent, round_number: int, *, fired: Iterable[FiredEvent], blackout: Season | None
) -> EventStatus:
    """Whether ``planned``, planned for Round ``round_number``, has fired, was skipped, or is still to come.

    ``fired`` is every event that fired in the session, and ``blackout`` the season of the Round's blackout, if
    the grid went down in it. An event planned for a season after the blackout is skipped.
    """
    if any(
        (event.event, event.round, event.season) == (planned.event, round_number, planned.season) for event in fired
    ):
        return "fired"
    if blackout is not None and planned.season is not None and SEASONS.index(planned.season) > SEASONS.index(blackout):
        return "skipped"
    return "planned"
