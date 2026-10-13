"""Unit tests for the Recap's content (#1013): what the newspaper between two Rounds reports."""

from __future__ import annotations

import pytest

from energetica.workshop.events import EVENTS, FiredEvent, Severity
from energetica.workshop.facilities import CATALOG, FacilityId, Fuel
from energetica.workshop.fleet import Purchase
from energetica.workshop.recap import recap
from energetica.workshop.round_plan import PlannedEvent, RoundLevers, RoundPlan
from energetica.workshop.seasons import Season
from energetica.workshop.session import (
    Checkpoint,
    Finished,
    Investment,
    NotStarted,
    Recap,
    TradingPeriod,
    recap_open,
)
from energetica.workshop.trading import FacilityPerformance, TradingResult
from energetica.workshop.unlocks import Unlock

PEAK = 100e6


def _plans(*events: list[PlannedEvent], rounds: int = 3) -> list[RoundPlan]:
    """A plan per Round, the first ones holding ``events`` in order."""
    padded = [*events, *([[]] * (rounds - len(events)))]
    return [RoundPlan(levers=RoundLevers(), events=round_events) for round_events in padded]


def _fired(event: str, severity: Severity = "base", *, round_number: int, season: Season | None = None) -> FiredEvent:
    return FiredEvent.of(PlannedEvent(event=event, severity=severity), round_number=round_number, season=season)


def _performance(*, sold: float, revenue: float, emissions: float = 0.0) -> FacilityPerformance:
    return FacilityPerformance(
        generation=sold,
        sold=sold,
        dumped=0.0,
        bought=0.0,
        revenue=revenue,
        dump_cost=0.0,
        purchase_cost=0.0,
        om=0.0,
        emissions=emissions,
        capacity_factor=0.5,
    )


def _recap(round_number: int = 1, **overrides: object):  # noqa: ANN202
    arguments: dict = {
        "round_count": 3,
        "plans": _plans(),
        "fired": [],
        "blackouts": [],
        "unlocks": [],
        "purchases": [],
        "results": [],
        "peak_demand": PEAK,
    }
    arguments.update(overrides)
    return recap(round_number, **arguments)


def test_the_year_in_review_tells_every_event_that_fired_in_the_round() -> None:
    fired = [
        _fired("demand.recession", round_number=1),
        _fired("demand.ev_tipping_point", round_number=2),
        _fired("climate.wildfire", "moderate", round_number=2, season="autumn"),
        _fired("climate.heatwave", "major", round_number=2, season="summer"),
    ]
    stories = _recap(2, fired=fired).stories
    # The Round's own event first, then the seasons in order.
    assert [story.event for story in stories] == ["demand.ev_tipping_point", "climate.heatwave", "climate.wildfire"]
    heatwave = stories[1]
    assert heatwave.name == "Heatwave"
    assert heatwave.season == "summer"
    assert heatwave.severity == "major"
    assert heatwave.headline == EVENTS["climate.heatwave"].headlines["major"]
    assert heatwave.effect == "Demand +18% for the summer"


def test_an_event_the_catalog_no_longer_has_is_left_out() -> None:
    gone = FiredEvent(
        event="climate.meteor",
        severity="base",
        fuel=None,
        round=1,
        season="spring",
        kind="revenue_tax",
        target=(),
        magnitude=0.5,
    )
    assert _recap(1, fired=[gone]).stories == []


def test_a_blackout_names_its_season() -> None:
    assert _recap(2, blackouts=[(1, "winter"), (2, "summer")]).blackout == "summer"
    assert _recap(3, blackouts=[(1, "winter")]).blackout is None


def test_the_rooms_figures_cover_the_round() -> None:
    wind, coal = FacilityId.ONSHORE_WIND_TURBINE, FacilityId.COAL_BURNER
    purchases = [
        Purchase(facility=wind, round=1, price=1.0),
        Purchase(facility=coal, round=2, price=1.0),
        Purchase(facility=wind, round=2, price=1.0),
    ]
    results = [
        TradingResult(round=1, season="spring", facilities={coal: _performance(sold=1e6, revenue=1.0, emissions=7.0)}),
        TradingResult(
            round=2,
            season="spring",
            facilities={
                wind: _performance(sold=3e6, revenue=150.0),
                coal: _performance(sold=1e6, revenue=50.0, emissions=1000.0),
            },
        ),
        TradingResult(
            round=2,
            season="summer",
            facilities={FacilityId.LITHIUM_ION_BATTERIES: _performance(sold=1e6, revenue=40.0)},
        ),
    ]
    figures = _recap(2, purchases=purchases, results=results).figures
    built = CATALOG[coal].base_construction_pollution + CATALOG[wind].base_construction_pollution
    assert figures.emissions_round == pytest.approx(built + 1000.0)
    assert figures.emissions_total == pytest.approx(built + CATALOG[wind].base_construction_pollution + 1007.0)
    assert figures.capacity_built == CATALOG[coal].base_power_generation + CATALOG[wind].base_power_generation
    # Storage resells energy generated elsewhere, so it is left out.
    assert figures.energy_sold == pytest.approx(4e6)
    assert figures.average_price == pytest.approx(200.0 / 4)
    assert figures.renewable_share == pytest.approx(0.75)


def test_a_round_with_nothing_sold_has_no_price_or_share() -> None:
    figures = _recap(1).figures
    assert figures.energy_sold == 0.0
    assert figures.average_price is None
    assert figures.renewable_share is None


def test_the_last_round_has_no_year_ahead() -> None:
    assert _recap(3).year_ahead is None
    assert _recap(2).year_ahead is not None


def test_the_year_ahead_announces_what_unlocks_next_round() -> None:
    unlocks = [
        Unlock(facility=FacilityId.OFFSHORE_WIND_TURBINE, round=2, trigger="investment_threshold"),
        Unlock(facility=FacilityId.CSP_SOLAR, round=3, trigger="round_gate"),
        Unlock(facility=FacilityId.HYDROGEN_STORAGE, round=3, trigger="format_lever"),
    ]
    year_ahead = _recap(2, unlocks=unlocks).year_ahead
    assert year_ahead is not None
    assert year_ahead.round == 3
    assert [unlock.facility for unlock in year_ahead.unlocks] == [FacilityId.CSP_SOLAR, FacilityId.HYDROGEN_STORAGE]
    assert year_ahead.unlocks[0].name == CATALOG[FacilityId.CSP_SOLAR].name
    assert year_ahead.unlocks[0].base is None


def test_an_upgrade_names_the_base_tier_it_replaces() -> None:
    unlocks = [Unlock(facility=FacilityId.OFFSHORE_WIND_TURBINE, round=2, trigger="investment_threshold")]
    year_ahead = _recap(1, unlocks=unlocks).year_ahead
    assert year_ahead is not None
    assert year_ahead.unlocks[0].base == FacilityId.ONSHORE_WIND_TURBINE
    assert year_ahead.unlocks[0].base_name == CATALOG[FacilityId.ONSHORE_WIND_TURBINE].name


def test_the_year_ahead_tells_next_rounds_round_events_with_their_effect() -> None:
    plans = _plans([], [PlannedEvent(event="geo.wind_supply_war", severity="base")])
    year_ahead = _recap(1, plans=plans).year_ahead
    assert year_ahead is not None
    [story] = year_ahead.stories
    assert story.headline == EVENTS["geo.wind_supply_war"].headlines["base"]
    assert story.effect == "Wind turbines cost 35% more in Round 2"
    assert story.season is None


def test_the_year_ahead_forecasts_next_rounds_seasonal_events_without_figures() -> None:
    plans = _plans(
        [],
        [
            PlannedEvent(event="climate.flood", severity="major", season="winter"),
            PlannedEvent(event="geo.conflict_resolution", severity="base", fuel=Fuel.GAS, season="spring"),
            PlannedEvent(event="climate.heatwave", severity="moderate", season="summer"),
        ],
    )
    year_ahead = _recap(1, plans=plans).year_ahead
    assert year_ahead is not None
    assert year_ahead.stories == []
    assert [forecast.season for forecast in year_ahead.forecasts] == ["spring", "summer", "winter"]
    assert year_ahead.forecasts[1].text == EVENTS["climate.heatwave"].forecast("moderate", season="summer")
    assert "gas" in year_ahead.forecasts[0].text
    # Only the forecast: nothing that says which event it is or how severe.
    assert set(type(year_ahead.forecasts[0]).model_fields) == {"season", "text"}


def test_the_demand_forecast_scales_this_rounds_measured_peak_by_next_rounds_demand_shifts() -> None:
    fired = [
        _fired("demand.ev_tipping_point", round_number=2),
        # A climate event passes with its season, so it moves neither Round's peak.
        _fired("climate.heatwave", "major", round_number=2, season="summer"),
    ]
    plans = _plans([], [], [PlannedEvent(event="demand.recession", severity="base")])
    year_ahead = _recap(2, fired=fired, plans=plans).year_ahead
    assert year_ahead is not None
    assert year_ahead.demand is not None
    # The peak measured this Round already holds the shifts that came before it.
    assert year_ahead.demand.peak_this_round == PEAK
    assert year_ahead.demand.peak_next_round == pytest.approx(PEAK * 0.90)


def test_there_is_no_demand_forecast_when_the_market_never_cleared() -> None:
    year_ahead = _recap(1, peak_demand=None).year_ahead
    assert year_ahead is not None
    assert year_ahead.demand is None


@pytest.mark.parametrize(
    ("checkpoint", "opened"),
    [
        (NotStarted(), set()),
        (Investment(round=1), set()),
        (TradingPeriod(round=1, season="winter"), set()),
        (Recap(round=1), {1}),
        (Investment(round=2), {1}),
        (Recap(round=2), {1, 2}),
        (Finished(), {1, 2, 3}),
    ],
)
def test_a_recap_opens_with_its_checkpoint_and_stays_open(checkpoint: Checkpoint, opened: set[int]) -> None:
    assert {round_number for round_number in (1, 2, 3) if recap_open(checkpoint, round_number)} == opened
