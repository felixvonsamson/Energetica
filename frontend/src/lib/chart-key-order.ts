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

/**
 * Reorders object properties according to a specified key order. Keys not in
 * the order array are placed at the end in their original order.
 */
export function reorderObjectKeys(
    obj: Record<string, any>,
    keyOrder: readonly string[],
): Record<string, any> {
    const result: Record<string, any> = {};

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
