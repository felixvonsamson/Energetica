"""Unit tests for Workshop's event catalog and the effects of events that fired (#1012)."""

from __future__ import annotations

import pytest

from energetica.workshop.events import (
    CLIMATE_SEVERITY_THRESHOLDS,
    EVENTS,
    EventPick,
    FiredEvent,
    InvalidPickError,
    Severity,
    demand_factor,
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


def test_a_fuel_shock_moves_its_target_or_the_fuel_the_moderator_picked() -> None:
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
