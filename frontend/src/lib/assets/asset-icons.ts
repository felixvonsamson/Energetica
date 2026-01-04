/**
 * Central registry for all asset icons. This provides a single source of truth
 * for mapping asset IDs to Lucide icons.
 *
 * Follows the same pattern as asset-names.ts for consistency.
 */

import {
    Factory,
    Wind,
    Sun,
    Droplets,
    Flame,
    Zap,
    Atom,
    Battery,
    BatteryCharging,
    Mountain,
    Pickaxe,
    FlaskConical,
    Warehouse,
    Filter,
    Calculator,
    Cog,
    Gauge,
    Hammer,
    Truck,
    Box,
    Building2,
    Plane,
    Trash2,
    Send,
    TrendingUp,
    Target,
    Cloud,
    DollarSign,
    Hash,
    ArrowDownRight,
    Thermometer,
    type LucideIcon,
} from "lucide-react";

/**
 * Power facility icons. Covers renewable (wind, solar, hydro) and controllable
 * (fossil fuel, nuclear) facilities.
 */
export const powerFacilityIcons: Record<string, LucideIcon> = {
    // Early game - simple technologies
    steam_engine: Factory,
    windmill: Wind,
    watermill: Droplets,

    // Mid game - fossil fuels
    coal_burner: Flame,
    gas_burner: Flame,
    combined_cycle: Zap,

    // Mid game - renewables
    small_water_dam: Droplets,
    onshore_wind_turbine: Wind,
    CSP_solar: Sun,
    PV_solar: Sun,

    // Late game
    large_water_dam: Droplets,
    offshore_wind_turbine: Wind,
    nuclear_reactor: Atom,
    nuclear_reactor_gen4: Atom,
};

/** Storage facility icons. */
export const storageFacilityIcons: Record<string, LucideIcon> = {
    small_pumped_hydro: Battery,
    molten_salt: FlaskConical,
    large_pumped_hydro: Battery,
    hydrogen_storage: FlaskConical,
    lithium_ion_batteries: BatteryCharging,
    solid_state_batteries: Battery,
};

/** Extraction facility icons. */
export const extractionFacilityIcons: Record<string, LucideIcon> = {
    coal_mine: Mountain,
    gas_drilling_site: Pickaxe,
    uranium_mine: Mountain,
};

/** Functional facility icons. */
export const functionalFacilityIcons: Record<string, LucideIcon> = {
    laboratory: FlaskConical,
    warehouse: Warehouse,
    industry: Factory,
    carbon_capture: Filter,
};

/** Technology icons. */
export const technologyIcons: Record<string, LucideIcon> = {
    mathematics: Calculator,
    mechanical_engineering: Cog,
    thermodynamics: Gauge,
    physics: Atom,
    building_technology: Hammer,
    mineral_extraction: Pickaxe,
    transport_technology: Truck,
    materials: Box,
    civil_engineering: Building2,
    aerodynamics: Plane,
    chemistry: FlaskConical,
    nuclear_engineering: Atom,
};

/** Resource icons. */
export const resourceIcons: Record<string, LucideIcon> = {
    coal: Mountain,
    gas: Flame,
    uranium: Atom,
};

/** Special facility icons. */
export const specialIcons: Record<string, LucideIcon> = {
    transport: Truck,
    construction: Hammer,
    research: FlaskConical,
    // Chart and overview special keys
    dumping: Trash2,
    exports: Send,
    imports: ArrowDownRight,
    "net-profit": TrendingUp,
    reference: Target,
    CO2: Cloud,
    price: DollarSign,
    quantity: Hash,
    temperature: Thermometer,
};

/** Combined registry of all asset icons. */
export const allAssetIcons: Record<string, LucideIcon> = {
    ...powerFacilityIcons,
    ...storageFacilityIcons,
    ...extractionFacilityIcons,
    ...functionalFacilityIcons,
    ...technologyIcons,
    ...resourceIcons,
    ...specialIcons,
};

/**
 * Get the icon component for an asset ID. Returns undefined if not found.
 *
 * @example
 *     const Icon = getAssetIcon("PV_solar");
 *     if (Icon) return <Icon className="w-5 h-5" />;
 *
 * @param assetId - The asset identifier (e.g., "PV_solar", "coal_burner")
 * @returns LucideIcon component or undefined
 */
export function getAssetIcon(assetId: string): LucideIcon | undefined {
    return allAssetIcons[assetId];
}
