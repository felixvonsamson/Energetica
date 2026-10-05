/**
 * PROTOTYPE — throwaway mock data for the #998 facility-card prototype.
 *
 * Values are copied from the persistent world's `config/assets.py` where the
 * facility exists there, in the backend's units (W, Wh, kg, in-game seconds).
 * Modern coal, Multi-layer PV and the unsplit pumped hydro are invented. O&M
 * per Round is invented throughout. Lifetimes and construction lags come from
 * the #975 table. Every number is a placeholder (#1145).
 */

import coalBurner from "@/assets/facilities/power/coal_burner.webp";
import combinedCycle from "@/assets/facilities/power/combined_cycle.webp";
import cspSolar from "@/assets/facilities/power/CSP_solar.webp";
import gasBurner from "@/assets/facilities/power/gas_burner.webp";
import largeWaterDam from "@/assets/facilities/power/large_water_dam.webp";
import nuclearReactor from "@/assets/facilities/power/nuclear_reactor.webp";
import nuclearReactorGen4 from "@/assets/facilities/power/nuclear_reactor_gen4.webp";
import offshoreWindTurbine from "@/assets/facilities/power/offshore_wind_turbine.webp";
import onshoreWindTurbine from "@/assets/facilities/power/onshore_wind_turbine.webp";
import pvSolar from "@/assets/facilities/power/PV_solar.webp";
import smallWaterDam from "@/assets/facilities/power/small_water_dam.webp";
import hydrogenStorage from "@/assets/facilities/storage/hydrogen_storage.webp";
import largePumpedHydro from "@/assets/facilities/storage/large_pumped_hydro.webp";
import lithiumIonBatteries from "@/assets/facilities/storage/lithium_ion_batteries.webp";
import solidStateBatteries from "@/assets/facilities/storage/solid_state_batteries.webp";

export type Category =
    | "Wind"
    | "Conventional"
    | "Hydro"
    | "Nuclear"
    | "PV"
    | "CSP"
    | "Batteries"
    | "Hydrogen storage"
    | "Pumped hydro";

export type Fuel = "coal" | "gas" | "uranium";

/** When a facility first shows up for players. Not part of the real schema. */
export type Availability = "base" | "upgrade" | "round-gate" | "full-season";

export interface Facility {
    id: string;
    name: string;
    category: Category;
    image: string;
    availability: Availability;
    base_price: number;
    /** W. For storage, the charge/discharge power. */
    base_power_generation: number;
    /** Wh, storage only. */
    base_storage_capacity?: number;
    /** 0–1, storage only. */
    base_efficiency?: number;
    construction_lag_rounds: number;
    lifetime_rounds: number;
    om_per_round: number;
    om_fixed_share: number;
    /** Kg */
    base_construction_pollution: number;
    /** Kg CO₂ per MWh */
    base_pollution: number;
    /** In-game seconds */
    ramping_time: number;
    fuel_type: Fuel | null;
}

export const CATEGORY_COLOR: Record<Category, string> = {
    Wind: "rgb(73, 160, 120)",
    Conventional: "rgb(120, 113, 108)",
    Hydro: "rgb(0, 119, 182)",
    Nuclear: "rgb(150, 180, 0)",
    PV: "rgb(234, 200, 0)",
    CSP: "rgb(255, 150, 0)",
    Batteries: "rgb(140, 105, 85)",
    "Hydrogen storage": "rgb(60, 200, 200)",
    "Pumped hydro": "rgb(2, 62, 138)",
};

export const FUEL_COLOR: Record<Fuel, string> = {
    coal: "rgb(40, 40, 40)",
    gas: "rgb(120, 150, 230)",
    uranium: "rgb(150, 180, 0)",
};

export const CATALOG: Facility[] = [
    {
        id: "onshore_wind_turbine",
        name: "Onshore wind turbine",
        category: "Wind",
        image: onshoreWindTurbine,
        availability: "base",
        base_price: 270_000,
        base_power_generation: 11_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 2,
        om_per_round: 15_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 420_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "offshore_wind_turbine",
        name: "Offshore wind turbine",
        category: "Wind",
        image: offshoreWindTurbine,
        availability: "upgrade",
        base_price: 2_000_000,
        base_power_generation: 130_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 2,
        om_per_round: 120_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 4_900_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "coal_burner",
        name: "Coal burner",
        category: "Conventional",
        image: coalBurner,
        availability: "base",
        base_price: 105_000,
        base_power_generation: 21_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 4,
        om_per_round: 18_000,
        om_fixed_share: 0.2,
        base_construction_pollution: 1_100_000,
        base_pollution: 1_664,
        ramping_time: 7_200,
        fuel_type: "coal",
    },
    {
        id: "modern_coal_plant",
        name: "Modern coal power plant",
        category: "Conventional",
        image: coalBurner,
        availability: "upgrade",
        base_price: 260_000,
        base_power_generation: 60_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 4,
        om_per_round: 35_000,
        om_fixed_share: 0.2,
        base_construction_pollution: 2_500_000,
        base_pollution: 1_100,
        ramping_time: 5_400,
        fuel_type: "coal",
    },
    {
        id: "gas_burner",
        name: "Gas burner",
        category: "Conventional",
        image: gasBurner,
        availability: "base",
        base_price: 90_000,
        base_power_generation: 11_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 4,
        om_per_round: 16_000,
        om_fixed_share: 0.2,
        base_construction_pollution: 657_000,
        base_pollution: 1_006,
        ramping_time: 480,
        fuel_type: "gas",
    },
    {
        id: "combined_cycle",
        name: "Combined cycle",
        category: "Conventional",
        image: combinedCycle,
        availability: "upgrade",
        base_price: 310_000,
        base_power_generation: 54_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 4,
        om_per_round: 30_000,
        om_fixed_share: 0.2,
        base_construction_pollution: 1_500_000,
        base_pollution: 797,
        ramping_time: 4_500,
        fuel_type: "gas",
    },
    {
        id: "small_water_dam",
        name: "Small water dam",
        category: "Hydro",
        image: smallWaterDam,
        availability: "base",
        base_price: 65_000,
        base_power_generation: 14_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 8,
        om_per_round: 4_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 876_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "large_water_dam",
        name: "Large water dam",
        category: "Hydro",
        image: largeWaterDam,
        availability: "upgrade",
        base_price: 520_000,
        base_power_generation: 210_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 8,
        om_per_round: 25_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 8_760_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "nuclear_reactor",
        name: "Nuclear reactor",
        category: "Nuclear",
        image: nuclearReactor,
        availability: "base",
        base_price: 840_000,
        base_power_generation: 167_000_000,
        construction_lag_rounds: 1,
        lifetime_rounds: 8,
        om_per_round: 110_000,
        om_fixed_share: 0.5,
        base_construction_pollution: 6_800_000,
        base_pollution: 2,
        ramping_time: 46_800,
        fuel_type: "uranium",
    },
    {
        id: "nuclear_reactor_gen4",
        name: "Gen-IV nuclear reactor",
        category: "Nuclear",
        image: nuclearReactorGen4,
        availability: "upgrade",
        base_price: 1_800_000,
        base_power_generation: 335_000_000,
        construction_lag_rounds: 1,
        lifetime_rounds: 8,
        om_per_round: 200_000,
        om_fixed_share: 0.5,
        base_construction_pollution: 12_000_000,
        base_pollution: 3,
        ramping_time: 30_000,
        fuel_type: "uranium",
    },
    {
        id: "pv_solar",
        name: "PV solar",
        category: "PV",
        image: pvSolar,
        availability: "base",
        base_price: 900_000,
        base_power_generation: 59_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 1,
        om_per_round: 25_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 12_000_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "multi_layer_pv",
        name: "Multi-layer PV",
        category: "PV",
        image: pvSolar,
        availability: "upgrade",
        base_price: 1_200_000,
        base_power_generation: 95_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 1,
        om_per_round: 30_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 14_000_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "csp_solar",
        name: "Concentrated solar power",
        category: "CSP",
        image: cspSolar,
        availability: "round-gate",
        base_price: 123_000,
        base_power_generation: 38_000_000,
        construction_lag_rounds: 0,
        lifetime_rounds: 4,
        om_per_round: 20_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 1_260_000,
        base_pollution: 0,
        ramping_time: 0,
        fuel_type: null,
    },
    {
        id: "lithium_ion_batteries",
        name: "Lithium-ion batteries",
        category: "Batteries",
        image: lithiumIonBatteries,
        availability: "base",
        base_price: 660_000,
        base_power_generation: 86_000_000,
        base_storage_capacity: 3_200_000_000,
        base_efficiency: 0.69,
        construction_lag_rounds: 0,
        lifetime_rounds: 1,
        om_per_round: 8_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 8_000_000,
        base_pollution: 0,
        ramping_time: 180,
        fuel_type: null,
    },
    {
        id: "solid_state_batteries",
        name: "Solid-state batteries",
        category: "Batteries",
        image: solidStateBatteries,
        availability: "upgrade",
        base_price: 1_000_000,
        base_power_generation: 107_000_000,
        base_storage_capacity: 5_000_000_000,
        base_efficiency: 0.79,
        construction_lag_rounds: 0,
        lifetime_rounds: 1,
        om_per_round: 9_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 6_000_000,
        base_pollution: 0,
        ramping_time: 180,
        fuel_type: null,
    },
    {
        id: "hydrogen_storage",
        name: "Hydrogen storage",
        category: "Hydrogen storage",
        image: hydrogenStorage,
        availability: "full-season",
        base_price: 420_000,
        base_power_generation: 90_000_000,
        base_storage_capacity: 30_000_000_000,
        base_efficiency: 0.33,
        construction_lag_rounds: 0,
        lifetime_rounds: 3,
        om_per_round: 20_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 2_400_000,
        base_pollution: 0,
        ramping_time: 480,
        fuel_type: null,
    },
    {
        id: "pumped_hydro",
        name: "Pumped hydro",
        category: "Pumped hydro",
        image: largePumpedHydro,
        availability: "full-season",
        base_price: 120_000,
        base_power_generation: 60_000_000,
        base_storage_capacity: 4_000_000_000,
        base_efficiency: 0.78,
        construction_lag_rounds: 0,
        lifetime_rounds: 6,
        om_per_round: 10_000,
        om_fixed_share: 1.0,
        base_construction_pollution: 1_200_000,
        base_pollution: 0,
        ramping_time: 720,
        fuel_type: null,
    },
];

export function isStorage(f: Facility): boolean {
    return f.base_storage_capacity !== undefined;
}

/** One owned copy of a facility. */
export interface OwnedFacility {
    facilityId: string;
    builtRound: number;
    /** Rounds left before automatic retirement. */
    remainingRounds: number;
    /** True while a construction lag is still running (nuclear). */
    underConstruction?: boolean;
}

/** A mock fleet, as seen in Round 3. */
export const FLEET: OwnedFacility[] = [
    { facilityId: "onshore_wind_turbine", builtRound: 2, remainingRounds: 1 },
    { facilityId: "onshore_wind_turbine", builtRound: 3, remainingRounds: 2 },
    { facilityId: "onshore_wind_turbine", builtRound: 2, remainingRounds: 1 },
    { facilityId: "onshore_wind_turbine", builtRound: 3, remainingRounds: 2 },
    { facilityId: "coal_burner", builtRound: 1, remainingRounds: 2 },
    { facilityId: "gas_burner", builtRound: 1, remainingRounds: 2 },
    { facilityId: "gas_burner", builtRound: 3, remainingRounds: 4 },
    { facilityId: "small_water_dam", builtRound: 1, remainingRounds: 6 },
    { facilityId: "small_water_dam", builtRound: 2, remainingRounds: 7 },
    { facilityId: "small_water_dam", builtRound: 3, remainingRounds: 8 },
    {
        facilityId: "nuclear_reactor",
        builtRound: 3,
        remainingRounds: 8,
        underConstruction: true,
    },
    { facilityId: "pv_solar", builtRound: 3, remainingRounds: 1 },
    { facilityId: "pv_solar", builtRound: 3, remainingRounds: 1 },
    { facilityId: "lithium_ion_batteries", builtRound: 3, remainingRounds: 1 },
];

/** Groups the fleet into stacks, one per facility type, in catalog order. */
export function fleetStacks(): {
    facility: Facility;
    copies: OwnedFacility[];
}[] {
    return CATALOG.flatMap((facility) => {
        const copies = FLEET.filter((o) => o.facilityId === facility.id).sort(
            (a, b) => b.remainingRounds - a.remainingRounds,
        );
        return copies.length > 0 ? [{ facility, copies }] : [];
    });
}

export type Reveal = "base" | "upgrades" | "everything";

/** What the player sees, given how far the mock session has unlocked. */
export function visibleCatalog(reveal: Reveal): Facility[] {
    return CATALOG.filter((f) => {
        if (f.availability === "base") return true;
        if (reveal === "base") return false;
        if (reveal === "upgrades") return f.availability === "upgrade";
        return true;
    });
}

export function formatRamping(seconds: number): string {
    if (seconds === 0) return "Instant";
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    const hours = seconds / 3600;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export function lifetimeRange(copies: OwnedFacility[]): string {
    const values = copies.map((c) => c.remainingRounds);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const unit = max === 1 ? "Round" : "Rounds";
    return max === min ? `${max} ${unit}` : `${max}–${min} ${unit}`;
}
