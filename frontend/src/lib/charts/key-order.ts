/**
 * Defines the display order for power generation and consumption sources. This
 * matches the order defined in energetica/static/charts/electricity.js
 */

import { ChartType } from "@/types/charts";

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

export const STORAGE_SOC_KEYS = STORAGE_LEVEL_KEYS;

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

export const RESOURCES_SOC_KEYS = RESOURCES_KEYS;

export const MARKET_CLEARING_DATA_KEYS = ["price", "quantity"] as const;

// Market exports/imports have dynamic player IDs, so no fixed order
export const MARKET_EXPORTS_KEYS = [] as const;
export const MARKET_IMPORTS_KEYS = [] as const;

// Market generation and consumption use the same keys as power generation/consumption
export const MARKET_GENERATION_KEYS = POWER_GENERATION_KEYS;
export const MARKET_CONSUMPTION_KEYS = POWER_CONSUMPTION_KEYS;

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
/**
 * Type-level mapping of chart types to their data keys. Enables type-safe chart
 * data access with proper autocomplete and compile-time checking.
 */
export type ChartDataKeys = {
    "power-sources": (typeof POWER_GENERATION_KEYS)[number];
    "power-sinks": (typeof POWER_CONSUMPTION_KEYS)[number];
    "storage-level": (typeof STORAGE_LEVEL_KEYS)[number];
    "storage-soc": (typeof STORAGE_SOC_KEYS)[number];
    revenues: (typeof REVENUES_KEYS)[number];
    "op-costs": (typeof OP_COSTS_KEYS)[number];
    emissions: (typeof EMISSIONS_KEYS)[number];
    climate: (typeof CLIMATE_KEYS)[number];
    temperature: (typeof TEMPERATURE_KEYS)[number];
    resources: (typeof RESOURCES_KEYS)[number];
    "resources-soc": (typeof RESOURCES_SOC_KEYS)[number];
    "market-clearing": (typeof MARKET_CLEARING_DATA_KEYS)[number];
    "market-exports": string; // Dynamic player IDs
    "market-imports": string; // Dynamic player IDs
    "market-generation": (typeof MARKET_GENERATION_KEYS)[number];
    "market-consumption": (typeof MARKET_CONSUMPTION_KEYS)[number];
};

/**
 * Generic chart data point type. Each chart type returns data points with a
 * tick number and values for each of its specific keys.
 *
 * @example
 *     // For market-clearing chart type:
 *     ChartDataPoint<"market-clearing"> = { tick: number; price: number; quantity: number }
 */
export type ChartDataPoint<T extends ChartType> = {
    tick: number;
} & Record<ChartDataKeys[T], number>;

/** Map chart types to their corresponding key ordering */
export const KEY_ORDER_BY_CHART_TYPE: Record<ChartType, readonly string[]> = {
    "power-sources": POWER_GENERATION_KEYS,
    "power-sinks": POWER_CONSUMPTION_KEYS,
    "storage-level": STORAGE_LEVEL_KEYS,
    "storage-soc": STORAGE_SOC_KEYS,
    revenues: REVENUES_KEYS,
    "op-costs": OP_COSTS_KEYS,
    emissions: EMISSIONS_KEYS,
    climate: CLIMATE_KEYS,
    temperature: TEMPERATURE_KEYS,
    resources: RESOURCES_KEYS,
    "resources-soc": RESOURCES_SOC_KEYS,
    "market-clearing": MARKET_CLEARING_DATA_KEYS,
    "market-exports": MARKET_EXPORTS_KEYS,
    "market-imports": MARKET_IMPORTS_KEYS,
    "market-generation": MARKET_GENERATION_KEYS,
    "market-consumption": MARKET_CONSUMPTION_KEYS,
};
