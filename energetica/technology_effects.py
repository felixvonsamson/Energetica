"""Contains functions to calculate parameters of facilities that change with technology levels."""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np

from energetica.config.assets import warehouse_capacity_for_level
from energetica.database.ongoing_project import OngoingProject
from energetica.enums import (
    ControllableFacilityType,
    ExtractionFacilityType,
    Fuel,
    FunctionalFacilityType,
    HydroFacilityType,
    PowerFacilityType,
    ProjectType,
    Renewable,
    RenewableFacilityType,
    SolarFacilityType,
    StorageFacilityType,
    TechnologyType,
    WindFacilityType,
    WorkerType,
    power_facility_types,
    str_to_project_type,
)
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine

if TYPE_CHECKING:
    from energetica.database.map.hex_tile import HexTile
    from energetica.database.player import Player


def special_multiplier(pf: float, lvl: int) -> float:
    """Return special values to reduce exponential growth of the power production."""
    # TODO(Felix): This function is quite confusing and should be reconsidered with eventual changes to the game values.
    if pf < 1:
        return pf**lvl
    return (0.5 + 0.5 * pf) ** lvl + np.log(pf / (0.5 + 0.5 * pf)) * lvl


def special_multiplier_gain(pf: float, lvl: int) -> float:
    """Returns the value multiplier for one additional level in percent."""
    return (special_multiplier(pf, lvl) / special_multiplier(pf, lvl - 1)) * 100 - 100


def special_linear_multiplier(pf: float, lvl: int) -> float:
    """Return a linear multiplier."""
    return 1 + pf * lvl


def special_linear_multiplier_gain(pf: float, lvl: int) -> float:
    """Returns the value multiplier for one additional level in percent."""
    return (special_linear_multiplier(pf, lvl) / special_linear_multiplier(pf, lvl - 1)) * 100 - 100


def research_prevalence(technology_name: ProjectType, level: int) -> int:
    """
    Return the number of players that have researched the technology at the given level.

    :param technology: the technology to check
    :param level: the level of the technology to check
    """
    if len(engine.technology_lvls[technology_name]) > level - 1:
        return engine.technology_lvls[technology_name][level - 1]
    return 0


def knowledge_spillover_discount(times_researched: int) -> float:
    """
    Return how a technology should be discounted given the number of players that have researched it.

    :param times_researched: the number of players that have researched the technology
    :return: the discount factor. 1.0 means no discount, 0.8 means a 20% discount
    """
    return 0.92**times_researched


def price_multiplier(player: Player, project_type: ProjectType) -> float:
    """Return the price multiplier according to the technology level of the player."""
    const_config = engine.const_config["assets"]
    mlt = 1.0
    # special linear price increase for the mineral extraction technology
    if project_type in const_config[TechnologyType.MINERAL_EXTRACTION]["affected_facilities"]:
        mlt *= special_linear_multiplier(
            const_config[TechnologyType.MINERAL_EXTRACTION]["price_factor"],
            player.technology_lvl[TechnologyType.MINERAL_EXTRACTION],
        )
    # This is a list of all the facilities that affect the price of the facility
    for research in [
        TechnologyType.MECHANICAL_ENGINEERING,
        TechnologyType.PHYSICS,
        TechnologyType.MATERIALS,
        TechnologyType.CIVIL_ENGINEERING,
        TechnologyType.AERODYNAMICS,
        TechnologyType.CHEMISTRY,
        TechnologyType.NUCLEAR_ENGINEERING,
    ]:
        if project_type in const_config[research]["affected_facilities"]:
            mlt *= special_multiplier(const_config[research]["price_factor"], player.technology_lvl[research])
    # level based facilities and technologies
    if isinstance(project_type, FunctionalFacilityType | TechnologyType):
        asset_next_level = next_level(player, project_type)
        mlt *= const_config[project_type]["price_multiplier"] ** (asset_next_level - 1)
        # knowledge spilling for technologies
        if isinstance(project_type, TechnologyType):
            mlt *= knowledge_spillover_discount(research_prevalence(project_type, asset_next_level))
    return mlt


def current_multiplier(player: Player, multiplier: str, facility_type: ProjectType) -> float:
    """Get the current multiplier for the player associated with the facility."""
    if multiplier == "price_multiplier":
        return price_multiplier(player, facility_type)
    if multiplier == "power_production_multiplier":
        assert isinstance(facility_type, PowerFacilityType | StorageFacilityType)
        return power_production_multiplier(player, facility_type)
    if multiplier == "power_consumption_multiplier":
        assert isinstance(facility_type, ExtractionFacilityType)
        return power_consumption_multiplier(player, facility_type)
    if multiplier == "wind_speed_multiplier":
        assert isinstance(facility_type, WindFacilityType)
        return wind_speed_multiplier(player, facility_type)
    if multiplier == "hydro_price_multiplier":
        assert isinstance(facility_type, HydroFacilityType)
        return hydro_price_multiplier(player, facility_type)
    if multiplier == "capacity_multiplier":
        assert isinstance(facility_type, StorageFacilityType)
        return capacity_multiplier(player, facility_type)
    if multiplier == "extraction_rate_multiplier":
        assert isinstance(facility_type, ExtractionFacilityType)
        return extraction_rate_multiplier(player)
    if multiplier == "next_available_location":
        assert isinstance(facility_type, WindFacilityType | HydroFacilityType)
        return next_available_location(player, facility_type)
    if multiplier == "efficiency_multiplier":
        assert isinstance(facility_type, ControllableFacilityType | StorageFacilityType)
        return efficiency_multiplier(player, facility_type)
    if multiplier == "extraction_emissions_multiplier":
        assert isinstance(facility_type, ExtractionFacilityType)
        return extraction_emissions_multiplier(player, facility_type)
    raise GameError(GameExceptionType.INVALID_MULTIPLIER)


def current_multipliers(player: Player, facility_type: ProjectType) -> dict[str, float]:
    """Return a dictionary of the current multipliers for the player associated with the facility."""
    multipliers = {}
    multipliers["price_multiplier"] = price_multiplier(player, facility_type)
    if isinstance(facility_type, PowerFacilityType | StorageFacilityType):
        multipliers["power_production_multiplier"] = power_production_multiplier(player, facility_type)
    if isinstance(facility_type, ExtractionFacilityType):
        multipliers["power_consumption_multiplier"] = power_consumption_multiplier(player, facility_type)
    if isinstance(facility_type, WindFacilityType):
        multipliers["wind_speed_multiplier"] = wind_speed_multiplier(player, facility_type)
    if isinstance(facility_type, HydroFacilityType):
        multipliers["hydro_price_multiplier"] = hydro_price_multiplier(player, facility_type)
    if isinstance(facility_type, StorageFacilityType):
        multipliers["capacity_multiplier"] = capacity_multiplier(player, facility_type)
    if isinstance(facility_type, ExtractionFacilityType):
        multipliers["extraction_rate_multiplier"] = extraction_rate_multiplier(player)
    if isinstance(facility_type, WindFacilityType | HydroFacilityType):
        multipliers["next_available_location"] = next_available_location(player, facility_type)
    if isinstance(facility_type, ControllableFacilityType | StorageFacilityType):
        multipliers["efficiency_multiplier"] = efficiency_multiplier(player, facility_type)
    if isinstance(facility_type, ExtractionFacilityType):
        multipliers["extraction_emissions_multiplier"] = extraction_emissions_multiplier(player, facility_type)
    return multipliers


def power_production_multiplier(player: Player, facility_type: PowerFacilityType | StorageFacilityType) -> float:
    """Return by how much the `facility`'s `base_power_generation` should be multiplied."""
    const_config = engine.const_config["assets"]
    mlt = 1.0
    # Mechanical engineering
    if facility_type in const_config["mechanical_engineering"]["affected_facilities"]:
        mlt *= special_multiplier(
            const_config["mechanical_engineering"]["prod_factor"],
            player.technology_lvl[TechnologyType.MECHANICAL_ENGINEERING],
        )
    # Physics
    if facility_type in const_config["physics"]["affected_facilities"]:
        mlt *= special_multiplier(const_config["physics"]["prod_factor"], player.technology_lvl[TechnologyType.PHYSICS])
    # Civil engineering
    if facility_type in const_config["civil_engineering"]["affected_facilities"]:
        mlt *= special_multiplier(
            const_config["civil_engineering"]["prod_factor"],
            player.technology_lvl[TechnologyType.CIVIL_ENGINEERING],
        )
    # Aerodynamics
    if facility_type in const_config["aerodynamics"]["affected_facilities"]:
        mlt *= special_multiplier(
            const_config["aerodynamics"]["prod_factor"],
            player.technology_lvl[TechnologyType.AERODYNAMICS],
        )
    # Nuclear engineering
    if facility_type in const_config["nuclear_engineering"]["affected_facilities"]:
        mlt *= special_multiplier(
            const_config["nuclear_engineering"]["prod_factor"],
            player.technology_lvl[TechnologyType.NUCLEAR_ENGINEERING],
        )
    return mlt


def power_consumption_multiplier(player: Player, extraction_facility_type: ExtractionFacilityType) -> float:
    """Return by how much an extraction facility's `base_power_consumption` should be multiplied."""
    const_config = engine.const_config["assets"]
    return special_linear_multiplier(
        const_config["mineral_extraction"]["energy_factor"],
        player.technology_lvl[TechnologyType.MINERAL_EXTRACTION],
    )


def capacity_multiplier(player: Player, storage_facility_type: StorageFacilityType) -> float:
    """Return by how much the storage facility's `base_storage_capacity` should be multiplied."""
    if storage_facility_type in [StorageFacilityType.SMALL_PUMPED_HYDRO, StorageFacilityType.LARGE_PUMPED_HYDRO]:
        # Civil engineering
        const_config = engine.const_config["assets"]
        return special_multiplier(
            const_config["civil_engineering"]["capacity_factor"],
            player.technology_lvl[TechnologyType.CIVIL_ENGINEERING],
        )
    return 1


def extraction_rate_multiplier(player: Player, *, mineral_extraction_level: int | None = None) -> float:
    """
    Return by how much the `facility`'s `base_extraction_rate_per_day` should be multiplied.

    Defined for extraction facilities.
    If `level` is not provided, the `player`'s current `mineral_extraction` level is used.
    """
    if mineral_extraction_level is None:
        mineral_extraction_level = player.technology_lvl[TechnologyType.MINERAL_EXTRACTION]
    const_config = engine.const_config["assets"]
    return special_linear_multiplier(
        const_config["mineral_extraction"]["extract_factor"],
        mineral_extraction_level,
    )


def hydro_price_multiplier(player: Player, hydro_facility_type: HydroFacilityType) -> float:
    """
    Return by how much the hydro facility's `base_price` should be multiplied.

    This is determined by the tile's hydro potential, and the number of hydro facilities / the next available location.
    """
    return hydro_price_function(
        next_available_location(player, hydro_facility_type),
        player.tile.potentials[Renewable.HYDRO],
    )


def wind_speed_multiplier(player: Player, wind_facility_type: WindFacilityType) -> float:
    """
    Return by how much the wind at the `facility`'s location should be multiplied.

    Defined for wind power facilities.
    Depends on the `player`'s current number of wind facilities and wind potential.
    """
    # calculating the wind speed multiplier linked to the number of wind turbines
    return wind_speed_function(
        next_available_location(player, wind_facility_type),
        player.tile.potentials[Renewable.WIND],
    )


def efficiency_multiplier(player: Player, facility_type: ProjectType) -> float:
    """
    Return by how much the `facility`'s `base_efficiency` should be multiplied.

    Defined for storage facilities.
    For power facilities, returns by how much the `facility`'s `base_pollution` should be multiplied, according to the
    technology level of the `player`.
    """
    if isinstance(facility_type, ControllableFacilityType):
        return efficiency_multiplier_for_controllable_facilities(player, facility_type)
    if isinstance(facility_type, StorageFacilityType):
        return efficiency_multiplier_for_storage_facilities(player, facility_type)
    return 1


def efficiency_multiplier_for_controllable_facilities(
    player: Player,
    controllable_facility_type: ControllableFacilityType,
    thermodynamics_level: int | None = None,
) -> float:
    """
    Return by how much the controllable power facility's `base_efficiency` should be multiplied.

    If `thermodynamics_level` is not provided, the `player`'s current `thermodynamics` level is used.
    """
    const_config = engine.const_config["assets"]
    if controllable_facility_type not in const_config["thermodynamics"]["affected_facilities"]:
        return 1
    if thermodynamics_level is None:
        thermodynamics_level = player.technology_lvl[TechnologyType.THERMODYNAMICS]
    return const_config["thermodynamics"]["efficiency_factor"] ** thermodynamics_level


def efficiency_multiplier_for_storage_facilities(
    player: Player,
    storage_facility_type: StorageFacilityType,
    *,
    chemistry_level: int | None = None,
    thermodynamics_level: int | None = None,
) -> float:
    """Return by how much the storage facility's `base_efficiency` should be multiplied."""
    const_config = engine.const_config["assets"]
    if storage_facility_type in engine.const_config["assets"]["chemistry"]["affected_facilities"]:
        if chemistry_level is None:
            chemistry_level = player.technology_lvl[TechnologyType.THERMODYNAMICS]
        chemistry_factor = const_config["chemistry"]["inefficiency_factor"] ** chemistry_level
        if storage_facility_type == StorageFacilityType.HYDROGEN_STORAGE:
            return (
                0.65 / const_config[storage_facility_type]["base_efficiency"] * (1 - chemistry_factor)
                + chemistry_factor
            )
        return 1 / const_config[storage_facility_type]["base_efficiency"] * (1 - chemistry_factor) + chemistry_factor
    if storage_facility_type == StorageFacilityType.MOLTEN_SALT:
        if thermodynamics_level is None:
            thermodynamics_level = player.technology_lvl[TechnologyType.THERMODYNAMICS]
        thermodynamic_factor = const_config["thermodynamics"]["efficiency_factor"] ** thermodynamics_level
        return (
            1 / const_config[storage_facility_type]["base_efficiency"] * (1 - 1 / thermodynamic_factor)
            + 1 / thermodynamic_factor
        )
    return 1


def extraction_emissions_multiplier(player: Player, extraction_facility_type: ExtractionFacilityType) -> float:
    """Return by how much the `facility`'s `base_pollution` should be multiplied."""
    # TODO(Felix): The if is is redundant no, this function is always called for extraction facilities.
    const_config = engine.const_config["assets"]
    if extraction_facility_type in const_config["mineral_extraction"]["affected_facilities"]:
        return special_linear_multiplier(
            const_config["mineral_extraction"]["pollution_factor"],
            player.technology_lvl[TechnologyType.MINERAL_EXTRACTION],
        )
    return 1


def next_available_location(player: Player, facility_type: HydroFacilityType | WindFacilityType) -> int:
    """Return the next available location for a hydro and wind facilities."""
    from energetica.database.active_facility import ActiveFacility

    active_facilities = ActiveFacility.filter_by(
        facility_type=facility_type,
        player=player,
    )
    under_construction = OngoingProject.filter_by(
        project_type=facility_type,
        player=player,
    )
    # Create a set of used locations
    used_locations = {af.multipliers["next_available_location"] for af in active_facilities}
    used_locations.update(uc.multipliers["next_available_location"] for uc in under_construction)
    i = 0
    while i in used_locations:
        i += 1
    return i


def construction_price(player: Player, project_type: ProjectType) -> float:
    """
    Return the construction price of the `facility` for the `player`.

    Returns the (real) cost of the construction of `facility` for `player`; be it power, storage, extraction,
    functional facility, or technology; for functional facilities and technologies: be it for the immediate next level
    when no other levels are queued, or or a level far in advance when many levels are already in progress and queued
    """
    const_config_assets = engine.const_config["assets"]
    return (
        const_config_assets[project_type]["base_price"]
        * price_multiplier(player, project_type)
        * (hydro_price_multiplier(player, project_type) if isinstance(project_type, HydroFacilityType) else 1)
    )


def construction_time(player: Player, project_type: ProjectType) -> float:
    """Return the construction time in ticks."""
    const_config = engine.const_config["assets"]
    # transforming in game seconds in ticks
    duration = const_config[project_type]["base_construction_time"] / engine.in_game_seconds_per_tick
    # construction time increases with higher levels
    if isinstance(project_type, FunctionalFacilityType | TechnologyType):
        level_with_constructions = OngoingProject.count_when(
            player=player,
            project_type=project_type,
        ) + player.get_level(project_type)
        duration *= const_config[project_type]["price_multiplier"] ** (0.6 * level_with_constructions)
        # knowledge spillover and laboratory time reduction
        if isinstance(project_type, TechnologyType):
            duration *= 0.92 ** research_prevalence(project_type, next_level(player, project_type))
            duration *= (
                const_config["laboratory"]["time_factor"]
                ** player.functional_facility_lvl[FunctionalFacilityType.LABORATORY]
            )
    # building technology time reduction
    if isinstance(
        project_type,
        StorageFacilityType
        | ControllableFacilityType
        | RenewableFacilityType
        | ExtractionFacilityType
        | FunctionalFacilityType,
    ):
        duration *= (
            const_config["building_technology"]["time_factor"]
            ** player.technology_lvl[TechnologyType.BUILDING_TECHNOLOGY]
        )
    return duration


def construction_power(player: Player, project_type: ProjectType) -> float:
    """Return the construction power in W according to the technology level of the player."""
    const_config = engine.const_config["assets"]
    bt_factor = (
        const_config["building_technology"]["time_factor"] ** player.technology_lvl[TechnologyType.BUILDING_TECHNOLOGY]
    )
    # construction power in relation of facilities characteristics
    if isinstance(project_type, PowerFacilityType):
        # Materials (in this case it is the energy consumption for construction)
        mlt = 1
        if project_type in const_config["materials"]["affected_facilities"]:
            mlt *= (
                const_config["materials"]["construction_energy_factor"]
                ** player.technology_lvl[TechnologyType.MATERIALS]
            )
        return (
            const_config[project_type]["base_power_generation"]
            * const_config[project_type]["construction_power_factor"]
            * power_production_multiplier(player, project_type)
            * mlt
            / bt_factor
        )
    if isinstance(project_type, ExtractionFacilityType):
        return (
            const_config[project_type]["base_power_consumption"]
            * const_config[project_type]["construction_power_factor"]
            * power_consumption_multiplier(player, project_type)
            / bt_factor
        )
    if isinstance(project_type, StorageFacilityType):
        return (
            const_config[project_type]["base_storage_capacity"]
            * const_config[project_type]["construction_power_factor"]
            * capacity_multiplier(player, project_type)
            / bt_factor
        )
    power = (
        const_config[project_type]["base_construction_energy"]
        / construction_time(player, project_type)
        / engine.in_game_seconds_per_tick
        * 3600
    )
    # construction power increases with higher levels
    if isinstance(project_type, FunctionalFacilityType | TechnologyType):
        facility_next_level = next_level(player, project_type)
        power *= const_config[project_type]["price_multiplier"] ** (facility_next_level - 1)
    return power


def construction_pollution_per_tick(player: Player, project_type: ProjectType) -> float:
    """Return the construction pollution per tick according to the technology level of the player."""
    const_config = engine.const_config["assets"]
    if isinstance(project_type, TechnologyType):
        return 0
    pollution = const_config[project_type]["base_construction_pollution"] / construction_time(player, project_type)
    # construction pollution increases with higher levels for functional facilities
    if isinstance(project_type, FunctionalFacilityType):
        pollution *= const_config[project_type]["price_multiplier"] ** player.get_level(project_type)
    return pollution


def hydro_price_function(count: int, potential: float) -> float:
    """Return the hydro price multiplier coefficient, for the `count`th hydro facility, given the hydro potential."""
    return 0.6 + (math.e ** (0.6 * (count + 1 - 3 * potential) / (0.3 + potential)))


def wind_speed_function(count: int, potential: float) -> float:
    """Return the wind speed multiplier, for the `count`th wind facility, given the wind potential."""
    return 1.3 / (math.log(math.e + (count * (1 / (9 * potential + 1))) ** 2))


def project_requirements(player: Player, project_type: ProjectType) -> list[dict[str, str | int]]:
    """Return the list of requirements (name, level, and satisfaction status) for the specified asset."""
    const_config = engine.const_config["assets"]
    requirements = const_config[project_type]["requirements"]
    level_offset = 0
    if isinstance(project_type, FunctionalFacilityType | TechnologyType):
        level_offset = next_level(player, project_type) - 1
    return [
        {
            "name": requirement,
            "display_name": const_config[requirement]["name"],
            "level": level + level_offset,
            "status": (
                "satisfied"
                if player.get_level(str_to_project_type[requirement]) >= level + level_offset
                else "queued"
                if next_level(player, str_to_project_type[requirement]) - 1 >= level + level_offset
                and const_config[project_type]["type"] == "Technology"
                and const_config[requirement]["type"] == "Technology"
                else "unsatisfied"
            ),
        }
        for requirement, level in requirements.items()
        if level + level_offset > 0
    ]


def requirements_status(player: Player, project_type: ProjectType, requirements: list) -> str:
    """
    Return the satisfaction status of the requirements for the specified asset.

    Returns either "satisfied", "queued", or "unsatisfied".
    For facilities, returns "satisfied" if all requirements are "satisfied", otherwise returns "unsatisfied"
    For technologies, returns "satisfied" if all requirements are "satisfied", otherwise if all requirements are either
    "satisfied" or "queued", returns "queued", otherwise returns "unsatisfied".
    """
    # TODO(mglst): this method, and the others about requirements should be revised, as they are unclear
    if all(requirement["status"] == "satisfied" for requirement in requirements):
        if isinstance(project_type, TechnologyType) and OngoingProject.filter_by(
            project_type=project_type,
            player=player,
        ):
            return "queued"
        return "satisfied"
    if project_type.worker_type == WorkerType.RESEARCH and all(
        requirement["status"] != "unsatisfied" for requirement in requirements
    ):
        return "queued"
    return "unsatisfied"


def project_requirements_and_requirements_status(player: Player, project_type: ProjectType) -> dict:
    """Return a dictionary with the list of requirements and the requirements_status."""
    requirements = project_requirements(player, project_type)
    return {
        "requirements": requirements,
        "requirements_status": requirements_status(player, project_type, requirements),
    }


def power_facility_resource_consumption(player: Player, power_facility_type: ProjectType) -> float:
    """Return a dictionary of the resources consumed by the power_facility for this player."""
    # TODO(mglst): perhaps rejig how this information is packaged.
    # Namely, switch from a dictionary with the system resource name as a key and a float for the amount as a value
    # to an array of dictionaries with keys ranging in "name", "display_name", "amount"
    consumed_resources = engine.const_config["assets"][power_facility_type]["consumed_resource"].copy()
    multiplier = efficiency_multiplier(player, power_facility_type)
    if multiplier == 0:
        multiplier = 1
    for resource in consumed_resources:
        consumed_resources[resource] /= multiplier
    return consumed_resources


def _package_project_base(player: Player, project_type: ProjectType) -> dict:
    """Package data shared between power, storage, extraction, functional facilities, and technologies."""
    const_config_assets = engine.const_config["assets"]
    return {
        "name": project_type,
        "display_name": const_config_assets[project_type]["name"],
        "description": const_config_assets[project_type]["description"],
        "wikipedia_link": const_config_assets[project_type]["wikipedia_link"],
        "price": construction_price(player, project_type),
        "construction_power": construction_power(player, project_type),
        "construction_time": construction_time(player, project_type),
    } | project_requirements_and_requirements_status(player, project_type)


def _package_power_generating_facility_base(
    player: Player,
    power_facility_type: PowerFacilityType | StorageFacilityType,
) -> dict:
    """Package data shared by power and storage facilities."""
    const_config_assets = engine.const_config["assets"]
    return (
        {
            "power_generation": const_config_assets[power_facility_type]["base_power_generation"]
            * power_production_multiplier(player, power_facility_type),
        }
        | (
            {
                "ramping_time": const_config_assets[power_facility_type]["ramping_time"],
                "ramping_speed": const_config_assets[power_facility_type]["base_power_generation"]
                * power_production_multiplier(player, power_facility_type)
                / const_config_assets[power_facility_type]["ramping_time"]
                * 60,
            }
            if const_config_assets[power_facility_type]["ramping_time"] != 0
            and const_config_assets[power_facility_type]["ramping_time"] > engine.in_game_seconds_per_tick
            else {}
        )
        | _capacity_factors(player, power_facility_type)
    )


def _capacity_factors(player: Player, renewable_power_facility_type: ProjectType) -> dict:
    """
    Get the capacity factors for renewable power facilities.

    !!! The capacity factor function is an approximation of the empirical data and has to be updated whenever a change
    in the wind simulation is made. !!!
    """
    if isinstance(renewable_power_facility_type, WindFacilityType):

        def capacity_factor_wind(wind_speed: float) -> float:
            """Fit of empirical data for wind speeds."""
            return 0.5280542813 - 0.5374832237 * np.exp(-2.226120465 * wind_speed**2.38728403)

        capacity_factor = capacity_factor_wind(wind_speed_multiplier(player, renewable_power_facility_type))
        return {
            "capacity_factor": f"{100 * capacity_factor:.0f}%",
        }
    if isinstance(renewable_power_facility_type, HydroFacilityType):
        return {
            "capacity_factor": "55%",
        }
    if isinstance(renewable_power_facility_type, SolarFacilityType):

        def capacity_factor_solar(latitude: int) -> float:
            """Empirical data for solar irradiations."""
            capacity_factors = {
                -10: 0.04570392892744975,
                -9: 0.04953853380224557,
                -8: 0.0552307507143072,
                -7: 0.0616075608151737,
                -6: 0.0691017943274717,
                -5: 0.07694332287540502,
                -4: 0.08576754217435902,
                -3: 0.09568159153558595,
                -2: 0.10480652239799751,
                -1: 0.1138650637123792,
                0: 0.12333395771455334,
                1: 0.13156905148715073,
                2: 0.1395413876995135,
                3: 0.14761487032350845,
                4: 0.15344212817008468,
                5: 0.15888008299556167,
                6: 0.1636592290228465,
                7: 0.16726951063638576,
                8: 0.16926758996324479,
                9: 0.17223583407685103,
                10: 0.17121678504734636,
            }
            return capacity_factors[latitude]

        return {
            "capacity_factor": f"{100 * capacity_factor_solar(player.tile.coordinates[1]):.0f}%",
        }
    return {}


def _package_power_storage_extraction_facility_base(player: Player, facility_type: ProjectType) -> dict:
    """Package data shared by power, storage, and extraction facilities."""
    const_config_assets = engine.const_config["assets"]
    return {
        "operating_costs": const_config_assets[facility_type]["base_price"]
        * price_multiplier(player, facility_type)
        * (hydro_price_multiplier(player, facility_type) if isinstance(facility_type, HydroFacilityType) else 1.0)
        * const_config_assets[facility_type]["O&M_factor_per_day"]
        / 24,
        "lifespan": const_config_assets[facility_type]["lifespan"] / engine.in_game_seconds_per_tick,
    } | (
        {"construction_pollution": const_config_assets[facility_type]["base_construction_pollution"]}
        if player.discovered_greenhouse_gas_effect()
        else {}
    )


def package_power_facilities(player: Player) -> list[dict]:
    """Package data relevant for the power_facilities frontend."""
    const_config_assets = engine.const_config["assets"]
    return [
        _package_project_base(player, power_facility)
        | _package_power_generating_facility_base(player, power_facility)
        | _package_power_storage_extraction_facility_base(player, power_facility)
        | {
            "consumed_resources": power_facility_resource_consumption(player, power_facility),
        }
        | (
            {
                "pollution": const_config_assets[power_facility]["base_pollution"]
                / efficiency_multiplier(player, power_facility),
            }
            if isinstance(power_facility, ControllableFacilityType | StorageFacilityType)
            else {}
        )
        | (
            {
                "high_hydro_cost": hydro_price_multiplier(player, power_facility) >= 13.0,
                "hydro_potential": player.tile.potentials[Renewable.HYDRO],
            }
            if isinstance(power_facility, HydroFacilityType)
            else {}
        )
        | (
            {
                "low_wind_speed": wind_speed_multiplier(player, power_facility) <= 0.55,
                "wind_potential": player.tile.potentials[Renewable.WIND],
            }
            if isinstance(power_facility, WindFacilityType)
            else {}
        )
        | (
            {"solar_potential": player.tile.potentials[Renewable.SOLAR]}
            if isinstance(power_facility, SolarFacilityType)
            else {}
        )
        for power_facility in power_facility_types
    ]


def package_storage_facilities(player: Player) -> list[dict]:
    """Package data relevant for the storage_facilities frontend."""
    const_config_assets = engine.const_config["assets"]
    return [
        _package_project_base(player, storage_facility)
        | _package_power_generating_facility_base(player, storage_facility)
        | _package_power_storage_extraction_facility_base(player, storage_facility)
        | {
            "storage_capacity": const_config_assets[storage_facility]["base_storage_capacity"]
            * capacity_multiplier(player, storage_facility),
            "efficiency": const_config_assets[storage_facility]["base_efficiency"]
            * efficiency_multiplier(player, storage_facility)
            * 100,
        }
        for storage_facility in StorageFacilityType
    ]


def package_extraction_facilities(player: Player) -> list[dict]:
    """Package data relevant for the extraction_facilities frontend."""
    const_config_assets = engine.const_config["assets"]

    def production_will_be_poor(tile: HexTile, fuel: Fuel) -> bool:
        """Return whether extracting the resource will be poor."""
        limits = {
            Fuel.COAL: 500_000_000,
            Fuel.GAS: 180_000_000,
            Fuel.URANIUM: 2_400_000,
        }
        return tile.fuel_reserves[fuel] < limits[fuel]

    return [
        _package_project_base(player, extraction_facility)
        | _package_power_storage_extraction_facility_base(player, extraction_facility)
        | {
            "power_consumption": const_config_assets[extraction_facility]["base_power_consumption"]
            * power_consumption_multiplier(player, extraction_facility),
            "pollution": const_config_assets[extraction_facility]["base_pollution"]
            * 1000
            * extraction_emissions_multiplier(player, extraction_facility),
            # TODO(mglst): remove this, let the frontend compute it (since tile resource can change often)
            "resource_production": {
                "name": extraction_facility.associated_fuel,
                "rate": const_config_assets[extraction_facility]["base_extraction_rate_per_day"]
                * extraction_rate_multiplier(player)
                * player.tile.fuel_reserves[extraction_facility.associated_fuel]
                # * tile_resource_amount(player.tile, facility_to_resource[extraction_facility])
                / 24,
            },
            "poor_resource_production": production_will_be_poor(player.tile, extraction_facility.associated_fuel),
        }
        for extraction_facility in ExtractionFacilityType
    ]


def project_is_hidden(player: Player, project_type: ProjectType) -> bool:
    """
    Return true if the facility is hidden to the player due to lack of achievements.

    Such facilities should not be shown on the frontend.
    """
    return project_type == FunctionalFacilityType.CARBON_CAPTURE and not player.discovered_greenhouse_gas_effect()


def next_level(player: Player, facility_or_technology: ProjectType) -> int:
    """Return the level of the next `facility_or_technology` upgrade, e.g. current level + # ongoing upgrades + one."""
    return (
        player.get_level(facility_or_technology)
        + len(
            list(
                OngoingProject.filter(
                    lambda construction: construction.player == player
                    and construction.project_type == facility_or_technology,
                ),
            ),
        )
        + 1
    )


def package_change(current: float | None, upgraded: float | None) -> dict | None:
    """
    Package a change between two values.

    `current` can be `None` to represent a new ability rather than an upgrade.
    If both values are the same, e.g. lab workers, there is no change, so returns None.
    """
    if current == upgraded:
        return None
    return {"current": current, "upgraded": upgraded}


def package_functional_facilities(player: Player) -> list[dict]:
    """Package data relevant for the functional_facilities frontend."""
    const_config_assets = engine.const_config["assets"]

    def industry_average_consumption_for_level(level: int) -> float:
        return (
            const_config_assets["industry"]["base_power_consumption"]
            * const_config_assets["industry"]["power_factor"] ** level
        )

    def industry_hourly_revenues_for_level(level: int) -> float:
        return (
            const_config_assets["industry"]["base_income_per_day"]
            * const_config_assets["industry"]["income_factor"] ** level
            + const_config_assets["industry"]["universal_income_per_day"]
        ) / 24

    def carbon_capture_power_consumption_for_level(level: int) -> float | None:
        if level == 0:
            return None
        return (
            const_config_assets["carbon_capture"]["base_power_consumption"]
            * const_config_assets["carbon_capture"]["power_factor"] ** level
        )

    def carbon_capture_absorption(level: int) -> float | None:
        if level == 0:
            return None
        return (
            const_config_assets["carbon_capture"]["base_absorption_per_day"]
            * const_config_assets["carbon_capture"]["absorption_factor"] ** level
            * engine.current_climate_data.get_co2()  # TODO(mglst): make this part be a client side computation
            / 24
        )

    next_industry_level = next_level(player, FunctionalFacilityType.INDUSTRY)
    next_laboratory_level = next_level(player, FunctionalFacilityType.LABORATORY)
    next_warehouse_level = next_level(player, FunctionalFacilityType.WAREHOUSE)
    next_carbon_capture_level = next_level(player, FunctionalFacilityType.CARBON_CAPTURE)

    special_keys = {
        "industry": {
            "level": next_industry_level,
            "average_consumption": package_change(
                current=industry_average_consumption_for_level(next_industry_level - 1),
                upgraded=industry_average_consumption_for_level(next_industry_level),
            ),
            "revenue_generation": package_change(
                current=industry_hourly_revenues_for_level(next_industry_level - 1),
                upgraded=industry_hourly_revenues_for_level(next_industry_level),
            ),
        },
        "laboratory": {
            "level": next_laboratory_level,
            "lab_workers": package_change(
                current=WorkerType.lab_workers_for_level(next_laboratory_level - 1),
                upgraded=WorkerType.lab_workers_for_level(next_laboratory_level),
            ),
        }
        | (
            {
                "research_speed_bonus": 100 - const_config_assets["laboratory"]["time_factor"] * 100,
            }
            if next_laboratory_level > 1  # Don't show for research_speed_bonus 0 -> 1, only for 1 -> 2 onwards
            else {}
        ),
        "warehouse": {
            "level": next_warehouse_level,
            "warehouse_capacities": {
                fuel: package_change(
                    current=warehouse_capacity_for_level(next_warehouse_level - 1, fuel),
                    upgraded=warehouse_capacity_for_level(next_warehouse_level, fuel),
                )
                for fuel in Fuel
            },
        },
        "carbon_capture": {
            "level": next_carbon_capture_level,
            "power_consumption": package_change(
                current=carbon_capture_power_consumption_for_level(next_carbon_capture_level - 1),
                upgraded=carbon_capture_power_consumption_for_level(next_carbon_capture_level),
            ),
            "co2_absorption": package_change(
                current=carbon_capture_absorption(next_carbon_capture_level - 1),
                upgraded=carbon_capture_absorption(next_carbon_capture_level),
            ),
        },
    }
    return [
        _package_project_base(player, functional_facility)
        | (
            {
                "construction_pollution": const_config_assets[functional_facility]["base_construction_pollution"]
                * const_config_assets[functional_facility]["price_multiplier"]
                ** player.functional_facility_lvl[FunctionalFacilityType.INDUSTRY],
            }
            if player.discovered_greenhouse_gas_effect()
            else {}
        )
        | special_keys[functional_facility]
        for functional_facility in FunctionalFacilityType
        if not project_is_hidden(player, functional_facility)  # Hide carbon capture if not discovered
    ]


def package_constructions_page_data(player: Player) -> dict[str, list[dict]]:
    """
    Package data for all facilities.

    Gets cost, emissions, max power, etc data for constructions.
    Takes into account base config prices and multipliers for the specified player.
    Returns a dictionary with the relevant data for constructions.
    """
    return {
        "power_facilities": package_power_facilities(player),
        "storage_facilities": package_storage_facilities(player),
        "extraction_facilities": package_extraction_facilities(player),
        "functional_facilities": package_functional_facilities(player),
    }


def package_available_technologies(player: Player) -> list[dict]:
    """Package data relevant for the frontend for technologies."""
    # TODO(mglst): Check all invoked functions and rename facility to asset if needed
    # Because these methods are common to both facilities and technologies, hence should use the name "asset"
    const_config_assets = engine.const_config["assets"]
    levels: dict[str, int] = {technology: next_level(player, technology) for technology in TechnologyType}
    return [
        _package_project_base(player, technology)
        | {
            "level": levels[technology],
            "affected_facilities": [
                const_config_assets[facility]["name"]
                for facility in const_config_assets[technology]["affected_facilities"]
            ],
        }
        | (
            {
                "discount": knowledge_spillover_discount(research_prevalence(technology, levels[technology])),
                "prevalence": research_prevalence(technology, levels[technology]),
            }
            if research_prevalence(technology, levels[technology]) > 0
            else {}
        )
        | (
            {
                "power_generation_bonus": special_multiplier_gain(
                    const_config_assets[technology]["prod_factor"],
                    levels[technology],
                ),
                "price_penalty": special_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.MECHANICAL_ENGINEERING
            else {}
        )
        | (
            {
                "fuel_use_reduction_bonus": (const_config_assets[technology]["efficiency_factor"] - 1)
                / const_config_assets[technology]["efficiency_factor"]
                * 100,
                "co2_emissions_reduction_bonus": (const_config_assets[technology]["efficiency_factor"] - 1)
                / const_config_assets[technology]["efficiency_factor"]
                * 100,
                "molten_salt_efficiency_bonus": (
                    (1 - 1 / const_config_assets[technology]["efficiency_factor"])
                    * (
                        1
                        - engine.const_config["assets"]["molten_salt"]["base_efficiency"]
                        * efficiency_multiplier_for_storage_facilities(
                            player,
                            StorageFacilityType.MOLTEN_SALT,
                            thermodynamics_level=levels[technology] - 1,
                        )
                    )
                    * 100
                ),
            }
            if technology == TechnologyType.THERMODYNAMICS
            else {}
        )
        | (
            {
                "price_penalty": special_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
                "power_generation_bonus": special_multiplier_gain(
                    const_config_assets[technology]["prod_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.PHYSICS
            else {}
        )
        | (
            {
                "construction_time_reduction_bonus": (100 - const_config_assets[technology]["time_factor"] * 100),
                "construction_workers": package_change(
                    WorkerType.construction_workers_for_level(levels[technology] - 1),
                    WorkerType.construction_workers_for_level(levels[technology]),
                ),
            }
            if technology == TechnologyType.BUILDING_TECHNOLOGY
            else {}
        )
        | (
            {
                "extraction_speed_bonus": special_linear_multiplier_gain(
                    const_config_assets[technology]["extract_factor"],
                    levels[technology],
                ),
                "power_consumption_penalty": special_linear_multiplier_gain(
                    const_config_assets[technology]["energy_factor"],
                    levels[technology],
                ),
                "co2_emissions_penalty": special_linear_multiplier_gain(
                    const_config_assets[technology]["pollution_factor"],
                    levels[technology],
                ),
                "price_penalty": special_linear_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.MINERAL_EXTRACTION
            else {}
        )
        | (
            {
                "shipment_time_reduction_bonus": 100 - const_config_assets[technology]["time_factor"] * 100,
                "power_consumption_reduction_bonus": (
                    const_config_assets[technology]["energy_factor"] / const_config_assets[technology]["time_factor"]
                    - 1
                )
                * 100,
            }
            if technology == TechnologyType.TRANSPORT_TECHNOLOGY
            else {}
        )
        | (
            {
                "price_reduction_bonus": (const_config_assets[technology]["price_factor"] * 100 - 100),
                "construction_power_reduction_bonus": 100
                - const_config_assets[technology]["construction_energy_factor"] * 100,
            }
            if technology == TechnologyType.MATERIALS
            else {}
        )
        | (
            {
                "storage_capacity_bonus": special_multiplier_gain(
                    const_config_assets[technology]["capacity_factor"],
                    levels[technology],
                ),
                "power_generation_bonus": special_multiplier_gain(
                    const_config_assets[technology]["prod_factor"],
                    levels[technology],
                ),
                "price_penalty": special_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.CIVIL_ENGINEERING
            else {}
        )
        | (
            {
                "power_generation_bonus": special_multiplier_gain(
                    const_config_assets[technology]["prod_factor"],
                    levels[technology],
                ),
                "price_penalty": special_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.AERODYNAMICS
            else {}
        )
        | (
            {
                "hydrogen_efficiency_bonus": (1 - const_config_assets[technology]["inefficiency_factor"])
                * (
                    0.65
                    - engine.const_config["assets"]["hydrogen_storage"]["base_efficiency"]
                    * efficiency_multiplier_for_storage_facilities(
                        player,
                        StorageFacilityType.HYDROGEN_STORAGE,
                        chemistry_level=levels[technology] - 1,
                    )
                )
                * 100,
                "lithium_ion_efficiency_bonus": (1 - const_config_assets[technology]["inefficiency_factor"])
                * (
                    1
                    - engine.const_config["assets"]["lithium_ion_batteries"]["base_efficiency"]
                    * efficiency_multiplier_for_storage_facilities(
                        player,
                        StorageFacilityType.LITHIUM_ION_BATTERIES,
                        chemistry_level=levels[technology] - 1,
                    )
                )
                * 100,
                "solid_state_efficiency_bonus": (1 - const_config_assets[technology]["inefficiency_factor"])
                * (
                    1
                    - engine.const_config["assets"]["solid_state_batteries"]["base_efficiency"]
                    * efficiency_multiplier_for_storage_facilities(
                        player,
                        StorageFacilityType.SOLID_STATE_BATTERIES,
                        chemistry_level=levels[technology] - 1,
                    )
                )
                * 100,
                "price_penalty": special_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.CHEMISTRY
            else {}
        )
        | (
            {
                "power_generation_bonus": special_multiplier_gain(
                    const_config_assets[technology]["prod_factor"],
                    levels[technology],
                ),
                "price_penalty": special_multiplier_gain(
                    const_config_assets[technology]["price_factor"],
                    levels[technology],
                ),
            }
            if technology == TechnologyType.NUCLEAR_ENGINEERING
            else {}
        )
        # price_reduction_bonus
        for technology in TechnologyType
    ]
