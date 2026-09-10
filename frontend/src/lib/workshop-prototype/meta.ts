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
