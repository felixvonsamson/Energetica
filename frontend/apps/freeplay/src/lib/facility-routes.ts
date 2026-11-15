/**
 * Utility for mapping facility names to their catalog page routes. Based on
 * backend facility type enums.
 */

type FacilityType = "power" | "storage" | "extraction" | "functional";

const POWER_FACILITIES = [
    "steam_engine",
    "coal_burner",
    "gas_burner",
    "combined_cycle",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "windmill",
    "onshore_wind_turbine",
    "offshore_wind_turbine",
    "watermill",
    "small_water_dam",
    "large_water_dam",
    "CSP_solar",
    "PV_solar",
] as const;

const STORAGE_FACILITIES = [
    "small_pumped_hydro",
    "molten_salt",
    "large_pumped_hydro",
    "hydrogen_storage",
    "lithium_ion_batteries",
    "solid_state_batteries",
] as const;

const EXTRACTION_FACILITIES = [
    "coal_mine",
    "gas_drilling_site",
    "uranium_mine",
] as const;

const FUNCTIONAL_FACILITIES = [
    "industry",
    "laboratory",
    "warehouse",
    "carbon_capture",
] as const;

const TECHNOLOGIES = [
    "mathematics",
    "mechanical_engineering",
    "thermodynamics",
    "physics",
    "building_technology",
    "mineral_extraction",
    "transport_technology",
    "materials",
    "civil_engineering",
    "aerodynamics",
    "chemistry",
    "nuclear_engineering",
] as const;

/**
 * Get the facility type (power/storage/extraction/functional) for a given
 * facility name.
 */
export function getFacilityType(facilityName: string): FacilityType | null {
    if ((POWER_FACILITIES as readonly string[]).includes(facilityName))
        return "power";
    if ((STORAGE_FACILITIES as readonly string[]).includes(facilityName))
        return "storage";
    if ((EXTRACTION_FACILITIES as readonly string[]).includes(facilityName))
        return "extraction";
    if ((FUNCTIONAL_FACILITIES as readonly string[]).includes(facilityName))
        return "functional";
    return null;
}

/** Check if a given name is a technology (not a facility). */
export function isTechnology(name: string): boolean {
    return (TECHNOLOGIES as readonly string[]).includes(name);
}

/**
 * Get the catalog page route for a given facility name. Returns the full path
 * with query parameter.
 *
 * @example
 *     getFacilityRoute("steam_engine"); // "/app/facilities/power?facility=steam_engine"
 */
export function getFacilityRoute(facilityName: string): string | null {
    const type = getFacilityType(facilityName);
    if (!type) return null;
    return `/app/facilities/${type}?facility=${facilityName}`;
}

/**
 * Get the technology catalog page route with query parameter.
 *
 * @example
 *     getTechnologyRoute("wind_power"); // "/app/facilities/technology?technology=wind_power"
 */
export function getTechnologyRoute(technologyName: string): string {
    return `/app/facilities/technology?technology=${technologyName}`;
}
