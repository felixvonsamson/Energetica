/**
 * Central registry for all asset display names. This provides a single source
 * of truth for translating asset IDs to human-readable names.
 *
 * In the future, this can be extended to support multiple languages by:
 *
 * - Adding language-specific mappings (e.g., assetNames_fr, assetNames_es)
 * - Using i18n libraries like react-i18next
 * - Loading translations from external JSON files
 */

/**
 * Display name configuration for an asset. Supports both short and long display
 * forms for flexible UI rendering.
 */
export interface AssetDisplayName {
    /** Full display name (e.g., "Photovoltaics", "4th Generation Nuclear") */
    long: string;
    /** Short display name for compact contexts (e.g., "PV", "Gen4 Nuclear") */
    short: string;
}

/**
 * Power facility display names. Covers renewable (wind, solar, hydro) and
 * controllable (fossil fuel, nuclear) facilities.
 */
export const powerFacilityNames: Record<string, AssetDisplayName> = {
    // Early game - simple technologies
    steam_engine: {
        long: "Steam Engine",
        short: "Steam Engine",
    },
    windmill: {
        long: "Windmill",
        short: "Windmill",
    },
    watermill: {
        long: "Watermill",
        short: "Watermill",
    },

    // Mid game - fossil fuels
    coal_burner: {
        long: "Coal Burner",
        short: "Coal Plant",
    },
    gas_burner: {
        long: "Gas Burner",
        short: "Gas Plant",
    },
    combined_cycle: {
        long: "Combined Cycle",
        short: "CCGT",
    },

    // Mid game - renewables
    small_water_dam: {
        long: "Small Water Dam",
        short: "Small Dam",
    },
    onshore_wind_turbine: {
        long: "Onshore Wind Turbine",
        short: "Onshore Wind",
    },
    CSP_solar: {
        long: "Concentrated Solar Power",
        short: "CSP",
    },
    PV_solar: {
        long: "Photovoltaics",
        short: "PV Solar",
    },

    // Late game
    large_water_dam: {
        long: "Large Water Dam",
        short: "Large Dam",
    },
    offshore_wind_turbine: {
        long: "Offshore Wind Turbine",
        short: "Offshore Wind",
    },
    nuclear_reactor: {
        long: "Nuclear Reactor",
        short: "Nuclear",
    },
    nuclear_reactor_gen4: {
        long: "4th Generation Nuclear",
        short: "Gen4 Nuclear",
    },
};

/** Storage facility display names. */
export const storageFacilityNames: Record<string, AssetDisplayName> = {
    small_pumped_hydro: {
        long: "Small Pumped Hydro Storage",
        short: "Hydro Storage (S)",
    },
    molten_salt: {
        long: "Molten Salt",
        short: "Molten Salt",
    },
    large_pumped_hydro: {
        long: "Large Pumped Hydro Storage",
        short: "Hydro Storage (L)",
    },
    hydrogen_storage: {
        long: "Hydrogen Hydrolysis",
        short: "Hydrogen",
    },
    lithium_ion_batteries: {
        long: "Lithium-Ion Batteries",
        short: "Li-ion",
    },
    solid_state_batteries: {
        long: "Solid State Batteries",
        short: "Solid State",
    },
};

/** Extraction facility display names. */
export const extractionFacilityNames: Record<string, AssetDisplayName> = {
    coal_mine: {
        long: "Coal Mine",
        short: "Coal Mine",
    },
    gas_drilling_site: {
        long: "Gas Drilling Site",
        short: "Gas Site",
    },
    uranium_mine: {
        long: "Uranium Mine",
        short: "U Mine",
    },
};

/** Functional facility display names. */
export const functionalFacilityNames: Record<string, AssetDisplayName> = {
    laboratory: {
        long: "Laboratory",
        short: "Laboratory",
    },
    warehouse: {
        long: "Warehouse",
        short: "Warehouse",
    },
    industry: {
        long: "Industry",
        short: "Industry",
    },
    carbon_capture: {
        long: "Carbon Capture",
        short: "CC",
    },
};

/** Technology display names. */
export const technologyNames: Record<string, AssetDisplayName> = {
    mathematics: {
        long: "Mathematics",
        short: "Math",
    },
    mechanical_engineering: {
        long: "Mechanical Engineering",
        short: "Mech Eng",
    },
    thermodynamics: {
        long: "Thermodynamics",
        short: "Thermo",
    },
    physics: {
        long: "Physics",
        short: "Physics",
    },
    building_technology: {
        long: "Building Technology",
        short: "Building",
    },
    mineral_extraction: {
        long: "Mineral Extraction",
        short: "Mining",
    },
    transport_technology: {
        long: "Transport Technology",
        short: "Transport",
    },
    materials: {
        long: "Materials",
        short: "Materials",
    },
    civil_engineering: {
        long: "Civil Engineering",
        short: "Civil Eng",
    },
    aerodynamics: {
        long: "Aerodynamics",
        short: "Aero",
    },
    chemistry: {
        long: "Chemistry",
        short: "Chemistry",
    },
    nuclear_engineering: {
        long: "Nuclear Engineering",
        short: "Nuclear Eng",
    },
};

/** Resource display names. */
export const resourceNames: Record<string, AssetDisplayName> = {
    coal: {
        long: "Coal",
        short: "Coal",
    },
    gas: {
        long: "Gas",
        short: "Gas",
    },
    uranium: {
        long: "Uranium",
        short: "U",
    },
};

/** Special facility display names */
export const specialNames: Record<string, AssetDisplayName> = {
    transport: {
        long: "Shipments",
        short: "Shipments",
    },
    construction: {
        long: "Construction",
        short: "Construction",
    },
    research: {
        long: "Research",
        short: "Research",
    },
    // Chart and overview special keys
    reference: {
        long: "Reference",
        short: "Ref",
    },
    CO2: {
        long: "CO₂ Emissions",
        short: "CO₂",
    },
    exports: {
        long: "Exports",
        short: "Exports",
    },
    imports: {
        long: "Imports",
        short: "Imports",
    },
    dumping: {
        long: "Dumping",
        short: "Dumping",
    },
    "net-profit": {
        long: "Net Profit",
        short: "Net Profit",
    },
    price: {
        long: "Price",
        short: "Price",
    },
    quantity: {
        long: "Quantity",
        short: "Qty",
    },
    temperature: {
        long: "Temperature",
        short: "Temp",
    },
    baseline: {
        long: "Baseline",
        short: "Baseline",
    },
    profit: {
        long: "Profit",
        short: "Profit",
    },
};

/** Combined registry of all asset names. */
export const allAssetNames: Record<string, AssetDisplayName> = {
    ...powerFacilityNames,
    ...storageFacilityNames,
    ...extractionFacilityNames,
    ...functionalFacilityNames,
    ...technologyNames,
    ...resourceNames,
    ...specialNames,
};

/**
 * Get the display name for an asset ID. Returns both long and short forms, or
 * undefined if not found.
 *
 * @example
 *     const name = getAssetName("PV_solar");
 *     console.log(name?.long); // "Photovoltaics"
 *     console.log(name?.short); // "PV Solar"
 *
 * @param assetId - The asset identifier (e.g., "PV_solar", "coal_burner")
 * @returns AssetDisplayName or undefined
 */
export function getAssetName(assetId: string): AssetDisplayName | undefined {
    return allAssetNames[assetId];
}

/**
 * Get the long display name for an asset, with fallback to the ID.
 *
 * @example
 *     getAssetLongName("PV_solar"); // "Photovoltaics"
 *     getAssetLongName("unknown"); // "unknown"
 *
 * @param assetId - The asset identifier
 * @returns The long display name, or the asset ID if not found
 */
export function getAssetLongName(assetId: string): string {
    return allAssetNames[assetId]?.long ?? assetId;
}

/**
 * Get the short display name for an asset, with fallback to the ID.
 *
 * @example
 *     getAssetShortName("PV_solar"); // "PV Solar"
 *     getAssetShortName("unknown"); // "unknown"
 *
 * @param assetId - The asset identifier
 * @returns The short display name, or the asset ID if not found
 */
export function getAssetShortName(assetId: string): string {
    return allAssetNames[assetId]?.short ?? assetId;
}
