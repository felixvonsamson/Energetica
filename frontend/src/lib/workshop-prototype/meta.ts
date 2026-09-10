/**
 * PROTOTYPE — Workshop Mode UI mockup (issue #992). Icon/label lookups shared
 * across mockup pages.
 */

import {
    Atom,
    Battery,
    Cloud,
    Droplets,
    Flame,
    LucideIcon,
    Snowflake,
    Sun,
    Waves,
    Wind,
} from "lucide-react";

import type {
    FacilityCategory,
    Season,
} from "@/lib/workshop-prototype/sample-data";

export const CATEGORY_META: Record<
    FacilityCategory,
    { label: string; icon: LucideIcon }
> = {
    wind: { label: "Wind", icon: Wind },
    conventional_coal: { label: "Coal", icon: Flame },
    conventional_gas: { label: "Gas", icon: Flame },
    hydro: { label: "Hydro", icon: Waves },
    nuclear: { label: "Nuclear", icon: Atom },
    pv: { label: "Solar PV", icon: Sun },
    csp: { label: "Concentrated Solar", icon: Sun },
    battery: { label: "Battery", icon: Battery },
    hydrogen_storage: { label: "Hydrogen Storage", icon: Droplets },
    pumped_hydro: { label: "Pumped Hydro", icon: Waves },
};

export const SEASON_META: Record<Season, { label: string; icon: LucideIcon }> =
    {
        spring: { label: "Spring", icon: Cloud },
        summer: { label: "Summer", icon: Sun },
        autumn: { label: "Autumn", icon: Wind },
        winter: { label: "Winter", icon: Snowflake },
    };

/**
 * Catalog id → the closest existing persistent-world facility image, served by
 * the backend at `/static/images/...` (proxied by the Vite dev server — see
 * `vite.config.ts`). Workshop's catalog is hand-authored and doesn't reuse
 * `assets.py` (spec §5), but its facilities are close enough to real ones that
 * borrowing the artwork beats a blank card for this mockup. Two catalog entries
 * are net-new content with no existing art ("modern coal power plant",
 * "Multi-layer PV") and just reuse their base tier's image.
 */
export const CATALOG_IMAGE: Record<string, string> = {
    onshore_wind_turbine:
        "/static/images/power_facilities/onshore_wind_turbine.png",
    offshore_wind_turbine:
        "/static/images/power_facilities/offshore_wind_turbine.png",
    coal_burner: "/static/images/power_facilities/coal_burner.png",
    gas_burner: "/static/images/power_facilities/gas_burner.png",
    combined_cycle: "/static/images/power_facilities/combined_cycle.png",
    water_dam: "/static/images/power_facilities/small_water_dam.png",
    nuclear_reactor: "/static/images/power_facilities/nuclear_reactor.png",
    pv_solar: "/static/images/power_facilities/PV_solar.png",
    csp: "/static/images/power_facilities/CSP_solar.png",
    lithium_ion_batteries:
        "/static/images/storage_facilities/lithium_ion_batteries.png",
};
