"""Utility functions for player assets."""

import math
from typing import cast


from energetica import technology_effects
from energetica.database.active_facility import ActiveFacility
from energetica.database.player import Player
from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    PowerFacilityType,
    StorageFacilityType,
    power_facility_types,
)
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.utils.projects import invalidate_data_on_project_update


def upgrade_facility(facility: ActiveFacility) -> None:
    """Upgrade a facility."""
    upgrade_cost = facility.upgrade_cost
    if upgrade_cost is None:
        raise GameError(GameExceptionType.FACILITY_NOT_UPGRADABLE)
    if facility.player.money < upgrade_cost:
        raise GameError(GameExceptionType.NOT_ENOUGH_MONEY)
    if facility.decommissioning:
        raise GameError(GameExceptionType.FACILITY_IS_DECOMMISSIONING)
    facility.player.money -= upgrade_cost
    new_multipliers = technology_effects.current_multipliers(facility.player, facility.facility_type)
    new_multipliers.pop("next_available_location", None)
    new_multipliers.pop("hydro_price_multiplier", None)
    new_multipliers.pop("wind_speed_multiplier", None)
    facility.multipliers.update(new_multipliers)
    facility.player.capacities.update(facility.player, facility.facility_type)
    engine.log(f"{facility.player.username} upgraded the facility {facility.facility_type}.")

    # Invalidate queries so frontend updates
    facility.player.invalidate_queries(
        ["facilities"],
        ["players", "me", "money"],
    )


def upgrade_all_facilities(
    player: Player,
    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
) -> None:
    """Upgrade all facilities of a certain type."""
    facilities = list(
        ActiveFacility.filter(
            lambda facility: facility.player == player
            and facility.facility_type == facility_type
            and facility.upgrade_cost is not None
            and not facility.decommissioning,
        ),
    )
    if player.money < sum(map(lambda facility: cast(float, facility.upgrade_cost), facilities)):
        raise GameError(GameExceptionType.NOT_ENOUGH_MONEY)
    for facility in facilities:
        upgrade_facility(facility)
    engine.log(f"All facilities of type {facility_type} upgraded for {player.username}.")

    # Note: upgrade_facility already invalidates per facility, but we invalidate again
    # here to ensure a single invalidation after all upgrades are complete
    player.invalidate_queries(
        ["facilities"],
        ["players", "me", "money"],
    )


def remove_facility(facility: ActiveFacility) -> None:
    """
    Remove a facility.

    This function is called either when a facility is dismantled or destroyed by a natural disasters.
    """
    player = facility.player
    facility.delete()

    save_powerless_player(player)

    player.capacities.update(player, facility.facility_type)
    engine.config.update_config_for_user(player)
    invalidate_data_on_project_update(player, facility.facility_type)


def destroy_facility(player: Player, facility: ActiveFacility, event_name: str) -> None:
    """Destroyed a facility, by a climate event."""
    cleanup_cost = 0.1 * facility.total_cost
    player.money -= cleanup_cost
    if facility.facility_type in StorageFacilityType:
        # The player looses the stored energy in that facility. Assume energy is stored uniformly across storage facilities of that type.
        n = ActiveFacility.count_when(facility_type=facility.facility_type)
        stored = player.rolling_history.get_last_data("storage", facility.facility_type)
        player.rolling_history._data["storage"][facility.facility_type][-1] = stored * (n - 1) / n
    remove_facility(facility)
    player.notify(
        "Destruction",
        (
            f"The facility {facility.facility_type} was destroyed by the {event_name}. The cost of the cleanup was "
            f"{round(cleanup_cost)}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>."
        ),
    )
    engine.log(f"{player.username} : {facility.facility_type} destroyed by {event_name}.")


def dismantle_facility(facility: ActiveFacility) -> None:
    """Dismantle a facility."""
    dismantle_cost = facility.dismantle_cost
    player = facility.player
    player.money -= dismantle_cost

    if isinstance(facility.facility_type, StorageFacilityType):
        facility.end_of_life = 0  # This sets facility.decommissioning to True
        player.capacities.update(player, facility.facility_type)
        engine.log(f"{player.username} marked the storage facility {facility.facility_type} for dismantlement.")
    else:
        remove_facility(facility)
        engine.log(f"{player.username} dismantled the facility {facility.facility_type}.")


def dismantle_all_facilities(
    player: Player,
    facility_type: PowerFacilityType | StorageFacilityType | ExtractionFacilityType,
) -> None:
    """Dismantle all facilities of a certain type."""
    facilities = list(
        ActiveFacility.filter(
            lambda facility: facility.player == player
            and facility.facility_type == facility_type
            and not facility.decommissioning,
        ),
    )
    if player.money < sum(map(lambda facility: cast(float, facility.dismantle_cost), facilities)):
        raise GameError(GameExceptionType.NOT_ENOUGH_MONEY)
    for facility in facilities:
        dismantle_facility(facility)


def save_powerless_player(player: Player) -> None:
    """
    Save players who do not have any means of producing power.

    If the player has no generation capacity, a new steam engine is created for the player in order to avoid soft-lock.
    """
    active_power_facilities = list(
        ActiveFacility.filter(lambda af: af.player == player and af.facility_type in power_facility_types),
    )
    if not active_power_facilities:
        eol = engine.total_t + math.ceil(
            engine.const_config["assets"][ControllableFacilityType.STEAM_ENGINE]["lifespan"]
            / engine.in_game_seconds_per_tick,
        )
        ActiveFacility(
            facility_type=ControllableFacilityType.STEAM_ENGINE,
            position=(
                player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1],
                player.tile.coordinates[1] * 0.5 * 3**0.5,
            ),
            end_of_life=eol,
            player=player,
            multipliers=technology_effects.current_multipliers(
                player,
                ControllableFacilityType.STEAM_ENGINE,
            ),
        )
        player.notify(
            "Emergency Power Generation",
            (
                "Due to the decommissioning of your last power generation facility, a new steam engine has been "
                "created for you."
            ),
        )
        engine.log(f"Emergency power steam engine created for {player.username}.")
