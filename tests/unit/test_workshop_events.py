"""Unit tests for Workshop's event catalog and the effects of events that fired (#1012)."""

from __future__ import annotations

import re
from string import Formatter

import pytest
from pydantic import ValidationError

from energetica.workshop.events import (
    CLIMATE_SEVERITY_THRESHOLDS,
    EVENTS,
    EventPick,
    FiredEvent,
    InvalidPickError,
    Severity,
    WorkshopEvent,
    demand_factor,
    effect_line,
    facility_price_factor,
    fuel_shocks,
    revenue_tax_rate,
    slot,
    suggested_severity,
    validate_pick,
)
from energetica.workshop.facilities import FacilityId, Fuel
from energetica.workshop.seasons import Season


def _fired(event: str, severity: Severity = "base", *, round_number: int, season: Season | None = None) -> FiredEvent:
    return FiredEvent.of(EventPick(event=event, severity=severity), round_number=round_number, season=season)


def test_every_event_follows_the_locked_shape() -> None:
    for event_id, event in EVENTS.items():
        assert event.id == event_id
        assert event_id.split(".")[0] in {"climate", "geo", "demand"}
        assert set(event.magnitude) == set(event.severities)
        assert set(event.headlines) == set(event.severities)
        assert all(magnitude > 0 for magnitude in event.magnitude.values())


def test_every_seasonal_event_has_a_forecast_per_severity_and_round_wide_ones_have_none() -> None:
    for event in EVENTS.values():
        if event.boundary_type == "trading_period":
            assert event.forecasts is not None
            assert set(event.forecasts) == set(event.severities)
        else:
            assert event.forecasts is None


def _with_forecasts(event_id: str, forecasts: object) -> dict[str, object]:
    """The catalog event ``event_id``'s fields, with ``forecasts`` in place of its own."""
    return {**EVENTS[event_id].model_dump(), "forecasts": forecasts}


@pytest.mark.parametrize(
    ("event_id", "forecasts"),
    [
        ("climate.flood", None),
        ("climate.flood", {"moderate": "A wet {season}.", "major": "A very wet {season}."}),
        (
            "climate.flood",
            {
                "moderate": "A wet {season}.",
                "major": "A very wet {season}.",
                "catastrophic": "Prepare for {season}.",
                "minor": "A damp {season}.",
            },
        ),
        ("demand.recession", {"base": "A slow {season}."}),
    ],
    ids=["seasonal without forecasts", "a severity missing", "a severity it does not have", "round-wide with one"],
)
def test_forecasts_that_do_not_match_the_events_boundary_and_severities_are_refused(
    event_id: str, forecasts: object
) -> None:
    with pytest.raises(ValidationError):
        WorkshopEvent.model_validate(_with_forecasts(event_id, forecasts))


def test_a_forecast_names_its_season_and_the_picked_fuel_and_nothing_else() -> None:
    for event in EVENTS.values():
        for forecast in (event.forecasts or {}).values():
            fields = {field for _, field, _, _ in Formatter().parse(forecast) if field is not None}
            assert fields == ({"season", "fuel"} if event.fuel_chosen else {"season"}), event.id


def test_no_forecast_contains_a_figure() -> None:
    for event in EVENTS.values():
        for forecast in (event.forecasts or {}).values():
            assert not re.search(r"\d", forecast), event.id


def test_the_wording_of_a_forecast_grows_more_certain_with_severity() -> None:
    marker: dict[Severity, str] = {
        "minor": "could",
        "moderate": "likely",
        "major": "almost certainly",
        "catastrophic": "almost certainly",
    }
    for event in EVENTS.values():
        for severity, forecast in (event.forecasts or {}).items():
            if severity != "base":
                assert marker[severity] in forecast, (event.id, severity)
            if severity in ("minor", "moderate"):
                assert "almost certainly" not in forecast, (event.id, severity)
            if severity == "catastrophic":
                assert "urge" in forecast, event.id


def test_a_forecast_fills_in_its_season_and_fuel() -> None:
    heatwave = EVENTS["climate.heatwave"].forecast("minor", season="summer")
    assert "summer" in heatwave
    assert "{" not in heatwave
    resolution = EVENTS["geo.conflict_resolution"].forecast("base", season="winter", fuel=Fuel.COAL)
    assert "winter" in resolution
    assert "coal" in resolution


def test_a_round_wide_event_has_no_forecast_to_fill_in() -> None:
    with pytest.raises(ValueError):
        EVENTS["geo.wind_supply_war"].forecast("base", season="summer")


def test_the_boundary_follows_the_category_and_effect() -> None:
    for event in EVENTS.values():
        match event.effect.kind:
            case "fuel_price_multiplier":
                assert event.boundary_type == "trading_period"
            case "facility_capex_multiplier":
                assert event.boundary_type == "round"
        if event.category == "climate":
            assert event.boundary_type == "trading_period"
        if event.category == "demand_shift":
            assert event.boundary_type == "round"


def test_climate_vignettes_never_carry_both_effects() -> None:
    kinds = {event.effect.kind for event in EVENTS.values() if event.category == "climate"}
    assert kinds == {"demand_amplitude_shift", "revenue_tax"}


def test_the_chip_shortage_is_dropped() -> None:
    assert "geo.chip_shortage" not in EVENTS


def test_a_pick_must_name_a_known_event_and_one_of_its_severities() -> None:
    validate_pick(EventPick(event="climate.flood", severity="major"))
    with pytest.raises(InvalidPickError):
        validate_pick(EventPick(event="climate.nope", severity="major"))
    with pytest.raises(InvalidPickError):
        validate_pick(EventPick(event="climate.flood", severity="minor"))


def test_only_the_conflict_resolution_takes_a_fuel_and_it_needs_one() -> None:
    validate_pick(EventPick(event="geo.conflict_resolution", severity="base", fuel=Fuel.COAL))
    with pytest.raises(InvalidPickError):
        validate_pick(EventPick(event="geo.conflict_resolution", severity="base"))
    with pytest.raises(InvalidPickError):
        validate_pick(EventPick(event="geo.gas_pipeline_disruption", severity="base", fuel=Fuel.COAL))


def test_price_shocks_on_facilities_and_on_fuel_use_different_slots() -> None:
    assert slot(EVENTS["geo.wind_supply_war"]) == ("price_shock_geopolitical", "round")
    assert slot(EVENTS["geo.gas_pipeline_disruption"]) == ("price_shock_geopolitical", "trading_period")


def test_a_temperature_event_moves_demand_for_its_trading_period_only() -> None:
    fired = [_fired("climate.heatwave", "major", round_number=1, season="summer")]
    assert demand_factor(fired, 1, "summer") == pytest.approx(1.18)
    assert demand_factor(fired, 1, "autumn") == 1.0
    assert demand_factor(fired, 2, "summer") == 1.0


def test_a_demand_shift_lasts_from_its_round_on_and_builds_on_earlier_ones() -> None:
    fired = [
        _fired("demand.ev_tipping_point", round_number=2),
        _fired("demand.recession", round_number=3),
    ]
    assert demand_factor(fired, 1, "winter") == 1.0
    assert demand_factor(fired, 2, "spring") == pytest.approx(1.12)
    assert demand_factor(fired, 3, "spring") == pytest.approx(1.12 * 0.90)


def test_a_disaster_taxes_revenue_in_its_trading_period_only() -> None:
    fired = [_fired("climate.hurricane", "catastrophic", round_number=1, season="autumn")]
    assert revenue_tax_rate(fired, 1, "autumn") == pytest.approx(0.18)
    assert revenue_tax_rate(fired, 1, "winter") == 0.0


def test_a_facility_price_shock_moves_every_tier_of_its_targets_for_one_round() -> None:
    fired = [_fired("geo.rare_earth_ban", round_number=2)]
    for facility in (
        FacilityId.ONSHORE_WIND_TURBINE,
        FacilityId.OFFSHORE_WIND_TURBINE,
        FacilityId.SOLID_STATE_BATTERIES,
    ):
        assert facility_price_factor(fired, facility, 2) == pytest.approx(1.20)
    assert facility_price_factor(fired, FacilityId.PV_SOLAR, 2) == 1.0
    assert facility_price_factor(fired, FacilityId.ONSHORE_WIND_TURBINE, 3) == 1.0


def test_the_suggested_severity_grows_with_the_emissions_per_player() -> None:
    moderate, major, catastrophic = (CLIMATE_SEVERITY_THRESHOLDS[s] for s in ("moderate", "major", "catastrophic"))
    flood = EVENTS["climate.flood"]  # moderate, major, catastrophic
    assert suggested_severity(flood, emissions=0, players=2) == "moderate"
    assert suggested_severity(flood, emissions=2 * major, players=2) == "major"
    assert suggested_severity(flood, emissions=2 * catastrophic, players=2) == "catastrophic"
    # A vignette that stops short of the severity the emissions call for suggests its worst.
    heatwave = EVENTS["climate.heatwave"]  # minor, moderate, major
    assert suggested_severity(heatwave, emissions=0, players=2) == "minor"
    assert suggested_severity(heatwave, emissions=2 * moderate, players=2) == "moderate"
    assert suggested_severity(heatwave, emissions=2 * catastrophic, players=2) == "major"
    # Without players, there is nothing to go on.
    assert suggested_severity(flood, emissions=1e12, players=0) == "moderate"


def test_only_climate_vignettes_get_a_suggestion() -> None:
    assert suggested_severity(EVENTS["demand.recession"], emissions=0, players=1) is None


def test_a_fuel_shock_moves_its_target_or_the_fuel_the_facilitator_picked() -> None:
    fired = [
        _fired("geo.gas_pipeline_disruption", round_number=1, season="summer"),
        FiredEvent.of(
            EventPick(event="geo.conflict_resolution", severity="base", fuel=Fuel.COAL), round_number=1, season="autumn"
        ),
    ]
    assert fuel_shocks(fired, 1, "summer") == {Fuel.GAS: pytest.approx(1.50)}
    assert fuel_shocks(fired, 1, "autumn") == {Fuel.COAL: pytest.approx(0.85)}
    assert fuel_shocks(fired, 1, "winter") == {}


def test_a_fired_event_keeps_its_effect_whatever_the_catalog_later_says() -> None:
    fired = _fired("geo.rare_earth_ban", round_number=2).model_copy(update={"event": "geo.renamed"})
    assert facility_price_factor([fired], FacilityId.ONSHORE_WIND_TURBINE, 2) == pytest.approx(1.20)


@pytest.mark.parametrize(
    ("event", "severity", "season", "line"),
    [
        ("climate.heatwave", "major", "summer", "Demand +18% for the summer"),
        ("climate.mild_season", "base", "spring", "Demand −3% for the spring"),
        ("demand.ev_tipping_point", "base", None, "Demand +12% from Round 3 on"),
        ("demand.recession", "base", None, "Demand −10% from Round 3 on"),
        ("climate.wildfire", "moderate", "autumn", "3% of every player's autumn sales lost"),
        ("geo.wind_supply_war", "base", None, "Wind turbines cost 35% more in Round 3"),
        ("geo.pv_megafactory", "base", None, "Solar panels cost 20% less in Round 3"),
        ("geo.rare_earth_ban", "base", None, "Wind turbines and batteries cost 20% more in Round 3"),
        ("geo.gas_pipeline_disruption", "base", "winter", "Gas costs 50% more in winter, then eases back"),
        ("geo.gas_discovery", "base", "summer", "Gas costs 20% less in summer, then eases back"),
    ],
)
def test_an_event_states_its_effect_in_plain_numbers(
    event: str, severity: Severity, season: Season | None, line: str
) -> None:
    assert effect_line(_fired(event, severity, round_number=3, season=season)) == line


def test_a_shock_on_a_picked_fuel_names_that_fuel() -> None:
    fired = FiredEvent.of(
        EventPick(event="geo.conflict_resolution", severity="base", fuel=Fuel.COAL), round_number=2, season="autumn"
    )
    assert effect_line(fired) == "Coal costs 15% less in autumn, then eases back"


def test_every_event_has_an_effect_line_at_every_severity() -> None:
    for event in EVENTS.values():
        season: Season | None = "spring" if event.boundary_type == "trading_period" else None
        for severity in event.severities:
            fuel = Fuel.GAS if event.fuel_chosen else None
            pick = EventPick(event=event.id, severity=severity, fuel=fuel)
            assert effect_line(FiredEvent.of(pick, round_number=2, season=season))
