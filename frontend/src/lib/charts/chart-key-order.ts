/**
 * Defines the display order for power generation and consumption sources. This
 * matches the order defined in energetica/static/charts/electricity.js
 */

export const POWER_GENERATION_KEYS = [
    "watermill",
    "small_water_dam",
    "large_water_dam",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "steam_engine",
    "coal_burner",
    "gas_burner",
    "combined_cycle",
    "windmill",
    "onshore_wind_turbine",
    "offshore_wind_turbine",
    "CSP_solar",
    "PV_solar",
    "small_pumped_hydro",
    "large_pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "molten_salt",
    "hydrogen_storage",
    "imports",
] as const;

export const POWER_CONSUMPTION_KEYS = [
    "coal_mine",
    "gas_drilling_site",
    "uranium_mine",
    "industry",
    "research",
    "construction",
    "transport",
    "carbon_capture",
    "small_pumped_hydro",
    "large_pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "molten_salt",
    "hydrogen_storage",
    "exports",
    "dumping",
] as const;

export const STORAGE_LEVEL_KEYS = [
    "small_pumped_hydro",
    "large_pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "molten_salt",
    "hydrogen_storage",
] as const;

export const REVENUES_KEYS = [
    "industry",
    "exports",
    "imports",
    "dumping",
    "climate_events",
] as const;

export const OP_COSTS_KEYS = [
    // Hydro facilities
    "watermill",
    "small_water_dam",
    "large_water_dam",
    // Controllable facilities
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "steam_engine",
    "coal_burner",
    "gas_burner",
    "combined_cycle",
    // Wind facilities
    "windmill",
    "onshore_wind_turbine",
    "offshore_wind_turbine",
    // Solar facilities
    "CSP_solar",
    "PV_solar",
    // Storage facilities
    "small_pumped_hydro",
    "large_pumped_hydro",
    "lithium_ion_batteries",
    "solid_state_batteries",
    "molten_salt",
    "hydrogen_storage",
    // Extraction facilities
    "coal_mine",
    "gas_drilling_site",
    "uranium_mine",
] as const;

export const EMISSIONS_KEYS = [
    "carbon_capture",
    "steam_engine",
    "coal_burner",
    "gas_burner",
    "combined_cycle",
    "nuclear_reactor",
    "nuclear_reactor_gen4",
    "construction",
    "coal_mine",
    "gas_drilling_site",
    "uranium_mine",
] as const;

export const CLIMATE_KEYS = ["CO2"] as const;

export const TEMPERATURE_KEYS = ["deviation", "reference"] as const;

export const RESOURCES_KEYS = ["coal", "gas", "uranium"] as const;

export const NETWORK_DATA_KEYS = ["price", "quantity"] as const;

// Network exports/imports have dynamic player IDs, so no fixed order
export const NETWORK_EXPORTS_KEYS = [] as const;
export const NETWORK_IMPORTS_KEYS = [] as const;

// Network generation and consumption use the same keys as power generation/consumption
export const NETWORK_GENERATION_KEYS = POWER_GENERATION_KEYS;
export const NETWORK_CONSUMPTION_KEYS = POWER_CONSUMPTION_KEYS;

/**
 * Reorders object properties according to a specified key order. Keys not in
 * the order array are placed at the end in their original order.
 */
export function reorderObjectKeys(
    obj: Record<string, unknown>,
    keyOrder: readonly string[],
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // First, add keys in the specified order
    for (const key of keyOrder) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }

    // Then, add any remaining keys that weren't in the order
    for (const key of Object.keys(obj)) {
        if (!(key in result)) {
            result[key] = obj[key];
        }
    }

    return result;
}
