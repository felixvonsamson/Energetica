"""Unit tests for Round plans (#1190): the default plan, carrying a lever forward, and planning events."""

from __future__ import annotations

import pytest

from energetica.workshop.events import FiredEvent, InvalidPickError
from energetica.workshop.round_format import RoundFormat
from energetica.workshop.round_plan import (
    LeverInvalidInLaterRoundError,
    PlannedEvent,
    RoundLevers,
    RoundPlan,
    event_status,
    plans_from,
    with_event,
    with_levers,
    without_event,
)

FULL_SEASON = RoundFormat(trading_format="full_season", storage="all")


def _plans(*levers: RoundLevers) -> list[RoundPlan]:
    return [RoundPlan(levers=lever) for lever in levers]


def test_a_session_as_long_as_the_default_plan_copies_it() -> None:
    default = [RoundLevers(), RoundLevers(fuel_procurement="manual")]

    assert plans_from(default, round_count=2) == _plans(*default)


def test_a_shorter_session_uses_the_start_of_the_default_plan() -> None:
    default = [RoundLevers(), RoundLevers(fuel_procurement="manual")]

    assert plans_from(default, round_count=1) == _plans(RoundLevers())


def test_a_longer_session_repeats_the_last_entry_of_the_default_plan() -> None:
    default = [RoundLevers(), RoundLevers(fuel_procurement="manual")]

    assert plans_from(default, round_count=4) == _plans(RoundLevers(), *[RoundLevers(fuel_procurement="manual")] * 3)


def test_a_changed_lever_carries_to_every_later_round_but_not_earlier_ones() -> None:
    plans = _plans(*[RoundLevers()] * 4)

    changed = with_levers(plans, 2, RoundLevers(fuel_procurement="manual"))

    assert [plan.levers.fuel_procurement for plan in changed] == ["automatic", "manual", "manual", "manual"]


def test_only_the_changed_lever_carries() -> None:
    plans = _plans(
        RoundLevers(),
        RoundLevers(),
        RoundLevers(round_format=RoundFormat(clearings_per_day=288)),
    )

    changed = with_levers(plans, 2, RoundLevers(fuel_procurement="manual"))

    assert changed[2].levers == RoundLevers(round_format=RoundFormat(clearings_per_day=288), fuel_procurement="manual")


def test_each_part_of_the_round_format_carries_on_its_own() -> None:
    plans = _plans(
        RoundLevers(),
        RoundLevers(round_format=RoundFormat(storage="off")),
    )

    changed = with_levers(plans, 1, RoundLevers(round_format=RoundFormat(clearings_per_day=96)))

    assert changed[1].levers.round_format == RoundFormat(clearings_per_day=96, storage="off")


def test_several_levers_changed_together_carry_together() -> None:
    plans = _plans(*[RoundLevers()] * 3)

    changed = with_levers(plans, 2, RoundLevers(round_format=FULL_SEASON))

    assert [plan.levers.round_format for plan in changed] == [RoundFormat(), FULL_SEASON, FULL_SEASON]


def test_a_change_that_would_make_a_later_round_invalid_is_refused_and_names_that_round() -> None:
    full_season_batteries = RoundFormat(trading_format="full_season")
    plans = _plans(
        RoundLevers(),
        RoundLevers(round_format=full_season_batteries),
        RoundLevers(round_format=full_season_batteries),
        RoundLevers(),
    )

    # Every storage type would reach Round 4, which uses a representative day.
    with pytest.raises(LeverInvalidInLaterRoundError) as refused:
        with_levers(plans, 2, RoundLevers(round_format=FULL_SEASON))
    assert refused.value.round_number == 4

    plans = _plans(
        RoundLevers(), RoundLevers(round_format=full_season_batteries), RoundLevers(round_format=FULL_SEASON)
    )
    # A representative day would reach Round 3, which allows every storage type.
    with pytest.raises(LeverInvalidInLaterRoundError) as refused:
        with_levers(plans, 2, RoundLevers())
    assert refused.value.round_number == 3


def test_leaving_the_levers_as_they_are_changes_nothing() -> None:
    plans = _plans(RoundLevers(), RoundLevers(fuel_procurement="manual"))

    assert with_levers(plans, 1, RoundLevers()) == plans


def test_events_never_carry_forward() -> None:
    plans = [
        RoundPlan(levers=RoundLevers(), events=[PlannedEvent(event="demand.recession", severity="base")]),
        RoundPlan(levers=RoundLevers()),
    ]

    changed = with_levers(plans, 1, RoundLevers(fuel_procurement="manual"))

    assert changed[1].events == []
    assert changed[0].events == plans[0].events


def test_a_planned_event_takes_the_place_of_the_one_in_the_same_slot() -> None:
    plan = RoundPlan(levers=RoundLevers())
    plan = with_event(plan, PlannedEvent(event="climate.heatwave", severity="minor", season="summer"))
    plan = with_event(plan, PlannedEvent(event="climate.flood", severity="major", season="winter"))
    plan = with_event(plan, PlannedEvent(event="demand.recession", severity="base"))
    plan = with_event(plan, PlannedEvent(event="climate.flood", severity="major", season="summer"))

    assert plan.events == [
        PlannedEvent(event="climate.flood", severity="major", season="winter"),
        PlannedEvent(event="demand.recession", severity="base"),
        PlannedEvent(event="climate.flood", severity="major", season="summer"),
    ]


def test_a_seasonal_event_needs_a_season_and_a_round_event_takes_none() -> None:
    plan = RoundPlan(levers=RoundLevers())

    with pytest.raises(InvalidPickError):
        with_event(plan, PlannedEvent(event="climate.heatwave", severity="minor"))
    with pytest.raises(InvalidPickError):
        with_event(plan, PlannedEvent(event="demand.recession", severity="base", season="spring"))


def test_a_planned_event_can_be_dropped() -> None:
    plan = RoundPlan(
        levers=RoundLevers(),
        events=[
            PlannedEvent(event="climate.flood", severity="major", season="winter"),
            PlannedEvent(event="climate.flood", severity="major", season="summer"),
        ],
    )

    assert without_event(plan, "climate.flood", "summer").events == [plan.events[0]]
    assert without_event(plan, "climate.flood", "spring") == plan


def _fired(planned: PlannedEvent, round_number: int) -> FiredEvent:
    return FiredEvent.of(planned, round_number=round_number, season=planned.season)


def test_a_planned_event_is_planned_until_it_fires() -> None:
    planned = PlannedEvent(event="climate.flood", severity="major", season="summer")

    assert event_status(planned, 2, fired=[], blackout=None) == "planned"
    assert event_status(planned, 2, fired=[_fired(planned, 2)], blackout=None) == "fired"
    assert event_status(planned, 2, fired=[_fired(planned, 3)], blackout=None) == "planned"


def test_an_event_planned_for_a_season_a_blackout_skipped_is_skipped() -> None:
    summer = PlannedEvent(event="climate.flood", severity="major", season="summer")
    spring = PlannedEvent(event="climate.heatwave", severity="minor", season="spring")
    shift = PlannedEvent(event="demand.recession", severity="base")

    assert event_status(summer, 2, fired=[], blackout="spring") == "skipped"
    assert event_status(summer, 2, fired=[], blackout="summer") == "planned"
    assert event_status(spring, 2, fired=[_fired(spring, 2)], blackout="spring") == "fired"
    assert event_status(shift, 2, fired=[], blackout="spring") == "planned"
