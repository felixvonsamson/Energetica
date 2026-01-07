/**
 * Central registry for all asset icons. This provides a single source of truth
 * for mapping asset IDs to Lucide icons.
 *
 * Follows the same pattern as asset-names.ts for consistency.
 */

import { windmill } from "@lucide/lab";
import {
    createLucideIcon,
    Factory,
    Wind,
    Sun,
    Droplets,
    Flame,
    Zap,
    Atom,
    BatteryCharging,
    Pickaxe,
    FlaskConical,
    Warehouse,
    Filter,
    CirclePile,
    Hammer,
    Truck,
    Box,
    Plane,
    Trash2,
    TrendingUp,
    Target,
    Cloud,
    DollarSign,
    Hash,
    ArrowDownRight,
    Thermometer,
    type LucideIcon,
    Radical,
    Omega,
    DraftingCompass,
    Wrench,
    Microscope,
    Heading2,
    BatteryPlus,
    Dam,
    SolarPanel,
    Stone,
    CloudRain,
    ArrowUpRight,
} from "lucide-react";

// Create React components from @lucide/lab icon data
const Windmill = createLucideIcon("Windmill", windmill);

/**
 * Power facility icons. Covers renewable (wind, solar, hydro) and controllable
 * (fossil fuel, nuclear) facilities.
 */
export const powerFacilityIcons: Record<string, LucideIcon> = {
    // Early game - simple technologies
    steam_engine: CloudRain,
    windmill: Windmill,
    watermill: Droplets,

    // Mid game - fossil fuels
    coal_burner: Stone,
    gas_burner: Flame,
    combined_cycle: Zap,

    // Mid game - renewables
    small_water_dam: Dam,
    onshore_wind_turbine: Wind,
    CSP_solar: Sun,
    PV_solar: SolarPanel,

    // Late game
    large_water_dam: Dam,
    offshore_wind_turbine: Wind,
    nuclear_reactor: Atom,
    nuclear_reactor_gen4: Atom,
};

/** Storage facility icons. */
export const storageFacilityIcons: Record<string, LucideIcon> = {
    small_pumped_hydro: Dam,
    molten_salt: CirclePile,
    large_pumped_hydro: Dam,
    hydrogen_storage: Heading2,
    lithium_ion_batteries: BatteryCharging,
    solid_state_batteries: BatteryPlus,
};

/** Extraction facility icons. */
export const extractionFacilityIcons: Record<string, LucideIcon> = {
    coal_mine: Stone,
    gas_drilling_site: Flame,
    uranium_mine: Atom,
};

/** Functional facility icons. */
export const functionalFacilityIcons: Record<string, LucideIcon> = {
    laboratory: Microscope,
    warehouse: Warehouse,
    industry: Factory,
    carbon_capture: Filter,
};

/** Technology icons. */
export const technologyIcons: Record<string, LucideIcon> = {
    mathematics: Radical,
    mechanical_engineering: DraftingCompass,
    thermodynamics: Thermometer,
    physics: Omega,
    building_technology: Hammer,
    mineral_extraction: Pickaxe,
    transport_technology: Truck,
    materials: Box,
    civil_engineering: Wrench,
    aerodynamics: Plane,
    chemistry: FlaskConical,
    nuclear_engineering: Atom,
};

/** Resource icons. */
export const resourceIcons: Record<string, LucideIcon> = {
    coal: Stone,
    gas: Flame,
    uranium: Atom,
};

/** Special facility icons. */
export const specialIcons: Record<string, LucideIcon> = {
    transport: Truck,
    construction: Hammer,
    research: Microscope,
    // Chart and overview special keys
    dumping: Trash2,
    exports: ArrowUpRight,
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
