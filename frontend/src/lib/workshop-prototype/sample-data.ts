/**
 * PROTOTYPE — Workshop Mode UI mockup (issue #992).
 *
 * Hand-written, deterministic sample data for the Workshop Mode player-facing
 * screens. Nothing here reads real state — every number is invented to make the
 * mockup screens look populated. Do not wire this into a real page: see
 * `frontend/src/routes/app/prototype/workshop/README.md` for the prototype's
 * scope and the branch it lives on.
 */

export type FacilityCategory =
    | "wind"
    | "conventional_coal"
    | "conventional_gas"
    | "hydro"
    | "nuclear"
    | "pv"
    | "csp"
    | "battery"
    | "hydrogen_storage"
    | "pumped_hydro";

export interface WorkshopCatalogFacility {
    id: string;
    name: string;
    category: FacilityCategory;
    isStorage: boolean;
    price: number;
    powerMw: number | null; // null for storage
    storageCapacityMwh: number | null;
    constructionLagRounds: number;
    lifetimeRounds: number;
    omPerRound: number;
    pollution: number; // tons CO2 / round, illustrative
    locked: boolean;
    lockedReason: string | null;
}

export const CATALOG: WorkshopCatalogFacility[] = [
    {
        id: "onshore_wind_turbine",
        name: "Onshore Wind Turbine",
        category: "wind",
        isStorage: false,
        price: 4200,
        powerMw: 3,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 2,
        omPerRound: 180,
        pollution: 0,
        locked: false,
        lockedReason: null,
    },
    {
        id: "offshore_wind_turbine",
        name: "Offshore Wind Turbine",
        category: "wind",
        isStorage: false,
        price: 7800,
        powerMw: 6,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 2,
        omPerRound: 340,
        pollution: 0,
        locked: true,
        lockedReason: "Unlocks once the room invests enough in onshore wind",
    },
    {
        id: "coal_burner",
        name: "Coal Burner",
        category: "conventional_coal",
        isStorage: false,
        price: 5600,
        powerMw: 8,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 4,
        omPerRound: 420,
        pollution: 620,
        locked: false,
        lockedReason: null,
    },
    {
        id: "gas_burner",
        name: "Gas Burner",
        category: "conventional_gas",
        isStorage: false,
        price: 4800,
        powerMw: 6,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 4,
        omPerRound: 300,
        pollution: 380,
        locked: false,
        lockedReason: null,
    },
    {
        id: "combined_cycle",
        name: "Combined Cycle Plant",
        category: "conventional_gas",
        isStorage: false,
        price: 8900,
        powerMw: 11,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 4,
        omPerRound: 410,
        pollution: 240,
        locked: true,
        lockedReason: "Unlocks once the room invests enough in gas burners",
    },
    {
        id: "water_dam",
        name: "Water Dam",
        category: "hydro",
        isStorage: false,
        price: 9200,
        powerMw: 9,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 8,
        omPerRound: 260,
        pollution: 0,
        locked: false,
        lockedReason: null,
    },
    {
        id: "nuclear_reactor",
        name: "Nuclear Reactor",
        category: "nuclear",
        isStorage: false,
        price: 26000,
        powerMw: 30,
        storageCapacityMwh: null,
        constructionLagRounds: 1,
        lifetimeRounds: 8,
        omPerRound: 900,
        pollution: 10,
        locked: false,
        lockedReason: null,
    },
    {
        id: "pv_solar",
        name: "PV Solar Array",
        category: "pv",
        isStorage: false,
        price: 3100,
        powerMw: 2,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 1,
        omPerRound: 90,
        pollution: 0,
        locked: false,
        lockedReason: null,
    },
    {
        id: "csp",
        name: "Concentrated Solar Power",
        category: "csp",
        isStorage: false,
        price: 12400,
        powerMw: 10,
        storageCapacityMwh: null,
        constructionLagRounds: 0,
        lifetimeRounds: 4,
        omPerRound: 480,
        pollution: 0,
        locked: true,
        lockedReason: "Unlocks in Round 3, regardless of investment",
    },
    {
        id: "lithium_ion_batteries",
        name: "Lithium-Ion Batteries",
        category: "battery",
        isStorage: true,
        price: 3600,
        powerMw: null,
        storageCapacityMwh: 12,
        constructionLagRounds: 0,
        lifetimeRounds: 1,
        omPerRound: 140,
        pollution: 0,
        locked: false,
        lockedReason: null,
    },
];

export interface OwnedFacility {
    id: string;
    catalogId: string;
    builtRound: number;
    remainingLifetimeRounds: number;
    status: "operating" | "under_construction";
}

export const FLEET: OwnedFacility[] = [
    {
        id: "f1",
        catalogId: "onshore_wind_turbine",
        builtRound: 1,
        remainingLifetimeRounds: 0,
        status: "operating",
    },
    {
        id: "f2",
        catalogId: "onshore_wind_turbine",
        builtRound: 2,
        remainingLifetimeRounds: 1,
        status: "operating",
    },
    {
        id: "f3",
        catalogId: "coal_burner",
        builtRound: 1,
        remainingLifetimeRounds: 2,
        status: "operating",
    },
    {
        id: "f4",
        catalogId: "water_dam",
        builtRound: 1,
        remainingLifetimeRounds: 6,
        status: "operating",
    },
    {
        id: "f5",
        catalogId: "pv_solar",
        builtRound: 3,
        remainingLifetimeRounds: 1,
        status: "under_construction",
    },
    {
        id: "f6",
        catalogId: "lithium_ion_batteries",
        builtRound: 3,
        remainingLifetimeRounds: 0,
        status: "operating",
    },
];

export const FUEL_PRICES: Array<{
    fuel: "coal" | "gas" | "uranium";
    pricePerTon: number;
    trend: "up" | "down" | "flat";
}> = [
    { fuel: "coal", pricePerTon: 62, trend: "up" },
    { fuel: "gas", pricePerTon: 48, trend: "flat" },
    { fuel: "uranium", pricePerTon: 910, trend: "down" },
];

export const ACTIVE_VOTE = {
    name: "Carbon Tax",
    description:
        "A flat rate on every ton of CO₂ you emit this round, redistributed evenly across all players.",
    ratePlaceholder: "€24 / ton CO₂",
};

// ---------------------------------------------------------------------------
// Session / round chrome
// ---------------------------------------------------------------------------

// This mockup's session, frozen at "Round 4's investment window just
// opened" — Round 3 (all 4 seasons) is fully simulated and reviewable, and
// Round 3 → Round 4's recap has already been shown. The trading-period and
// price-setting screenshots reach a little further forward/backward in that
// same story (reviewing Round 3's Summer; peeking at Round 4's Spring
// price-setting) — each page passes its own `timeline` snapshot rather than
// pretending the whole app is paused on one single instant.
export const SESSION = {
    totalRounds: 5,
    currentRound: 4,
};

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

// Per-round season status, keyed by round number. "done" = simulated and
// reviewable, "current" = the one being scrubbed/reviewed right now,
// "upcoming" = not simulated yet.
export const ROUND_SEASON_STATUS: Record<
    number,
    Record<Season, "done" | "current" | "upcoming">
> = {
    1: { spring: "done", summer: "done", autumn: "done", winter: "done" },
    2: { spring: "done", summer: "done", autumn: "done", winter: "done" },
    3: { spring: "done", summer: "done", autumn: "done", winter: "done" },
    4: {
        spring: "current",
        summer: "upcoming",
        autumn: "upcoming",
        winter: "upcoming",
    },
    5: {
        spring: "upcoming",
        summer: "upcoming",
        autumn: "upcoming",
        winter: "upcoming",
    },
};

// ---------------------------------------------------------------------------
// Trading-period review: merit order + generation over the day
// ---------------------------------------------------------------------------

export interface MeritOrderOffer {
    label: string;
    category: FacilityCategory | "demand";
    priceEurPerMwh: number;
    quantityMw: number;
    isOwnBid: boolean;
}

/** One synthetic 24-tick day for the Summer trading period, hourly. */
export function buildSummerDay() {
    const hours = Array.from({ length: 24 }, (_, h) => h);

    // Base shapes (0..1) per tech, roughly matching a summer day.
    const solarShape = (h: number) =>
        Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const windShape = (h: number) => 0.35 + 0.25 * Math.sin(h / 3.2);
    const demandShape = (h: number) =>
        0.55 +
        0.25 * Math.sin(((h - 8) / 24) * 2 * Math.PI) +
        (h >= 18 && h <= 21 ? 0.2 : 0);

    const generation = hours.map((h) => {
        const pv = 5.2 * solarShape(h);
        const wind = 4.1 * windShape(h);
        const hydro = 4.6;
        const nuclear = 8.4;
        const gas = Math.max(0, 3.2 * demandShape(h) - 2.5);
        const coal = h >= 17 && h <= 22 ? 3.6 : 0.6;
        return {
            hour: h,
            pv: round1(pv),
            wind: round1(wind),
            hydro: round1(hydro),
            nuclear: round1(nuclear),
            conventional_gas: round1(gas),
            conventional_coal: round1(coal),
        };
    });

    const clearingPrice = hours.map((h) => {
        const peak = h >= 18 && h <= 21;
        const trough = h >= 2 && h <= 5;
        const base = 38 + 30 * demandShape(h);
        return round1(peak ? base + 22 : trough ? base - 14 : base);
    });

    const clearingQuantity = generation.map((g) =>
        round1(
            g.pv +
                g.wind +
                g.hydro +
                g.nuclear +
                g.conventional_gas +
                g.conventional_coal,
        ),
    );

    return { hours, generation, clearingPrice, clearingQuantity };
}

/**
 * Build a merit-order stack (supply offers + the 6-tier demand block) for one
 * hour.
 */
export function buildMeritOrderForHour(
    hour: number,
    generationAtHour: {
        pv: number;
        wind: number;
        hydro: number;
        nuclear: number;
        conventional_gas: number;
        conventional_coal: number;
    },
): { offers: MeritOrderOffer[]; clearingPrice: number } {
    const allSupplyOffers: MeritOrderOffer[] = [
        {
            label: "PV Solar Array",
            category: "pv",
            priceEurPerMwh: 4,
            quantityMw: generationAtHour.pv,
            isOwnBid: true,
        },
        {
            label: "Onshore Wind (fleet)",
            category: "wind",
            priceEurPerMwh: 6,
            quantityMw: generationAtHour.wind,
            isOwnBid: true,
        },
        {
            label: "Water Dam",
            category: "hydro",
            priceEurPerMwh: 12,
            quantityMw: generationAtHour.hydro,
            isOwnBid: false,
        },
        {
            label: "Nuclear Reactor",
            category: "nuclear",
            priceEurPerMwh: 18,
            quantityMw: generationAtHour.nuclear,
            isOwnBid: false,
        },
        {
            label: "Gas Burner",
            category: "conventional_gas",
            priceEurPerMwh: 52,
            quantityMw: generationAtHour.conventional_gas,
            isOwnBid: false,
        },
        {
            label: "Coal Burner",
            category: "conventional_coal",
            priceEurPerMwh: 68,
            quantityMw: generationAtHour.conventional_coal,
            isOwnBid: true,
        },
    ];
    const supplyOffers = allSupplyOffers.filter((o) => o.quantityMw > 0);

    const totalSupply = supplyOffers.reduce((s, o) => s + o.quantityMw, 0);
    // Nominal demand roughly tracks total dispatched supply in this mockup.
    const nominalDemand = totalSupply * 0.97;
    const tiers: MeritOrderOffer[] = [
        {
            label: "Must-serve demand",
            category: "demand",
            priceEurPerMwh: Infinity,
            quantityMw: round1(nominalDemand * 0.8),
            isOwnBid: false,
        },
        {
            label: "Low-flex demand",
            category: "demand",
            priceEurPerMwh: 480,
            quantityMw: round1(nominalDemand * 0.1),
            isOwnBid: false,
        },
        {
            label: "Medium-flex demand",
            category: "demand",
            priceEurPerMwh: 240,
            quantityMw: round1(nominalDemand * 0.15),
            isOwnBid: false,
        },
        {
            label: "High-flex demand",
            category: "demand",
            priceEurPerMwh: 120,
            quantityMw: round1(nominalDemand * 0.2),
            isOwnBid: false,
        },
    ];

    const peak = hour >= 18 && hour <= 21;
    const trough = hour >= 2 && hour <= 5;
    const base =
        38 + 30 * (0.55 + 0.25 * Math.sin(((hour - 8) / 24) * 2 * Math.PI));
    const clearingPrice = round1(peak ? base + 22 : trough ? base - 14 : base);

    return { offers: [...supplyOffers, ...tiers], clearingPrice };
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Round overview: season revenue strip + facility performance table
// ---------------------------------------------------------------------------

export const SEASON_REVENUE: Array<{
    season: Season;
    status: "done" | "current" | "upcoming";
    revenue: number | null;
    cost: number | null;
}> = [
    { season: "spring", status: "done", revenue: 8420, cost: 3100 },
    { season: "summer", status: "current", revenue: null, cost: null },
    { season: "autumn", status: "upcoming", revenue: null, cost: null },
    { season: "winter", status: "upcoming", revenue: null, cost: null },
];

export const FACILITY_PERFORMANCE: Array<{
    catalogId: string;
    generatedMwh: number;
    omCost: number;
    capacityFactor: number;
}> = [
    {
        catalogId: "onshore_wind_turbine",
        generatedMwh: 3120,
        omCost: 360,
        capacityFactor: 0.34,
    },
    {
        catalogId: "coal_burner",
        generatedMwh: 2180,
        omCost: 420,
        capacityFactor: 0.31,
    },
    {
        catalogId: "water_dam",
        generatedMwh: 4960,
        omCost: 260,
        capacityFactor: 0.63,
    },
    {
        catalogId: "pv_solar",
        generatedMwh: 640,
        omCost: 90,
        capacityFactor: 0.15,
    },
];

// ---------------------------------------------------------------------------
// Round-transition recap
// ---------------------------------------------------------------------------

export type RecapEventCategory =
    | "climate"
    | "price_shock_geopolitical"
    | "demand_shift"
    | "tech_unlock";

export interface RecapEvent {
    category: RecapEventCategory;
    severity: string;
    headline: string;
    detail: string;
}

export const RECAP_EVENTS: RecapEvent[] = [
    {
        category: "climate",
        severity: "moderate",
        headline: "A heatwave grips the region",
        detail: "Demand amplitude +12% for the rest of the session.",
    },
    {
        category: "price_shock_geopolitical",
        severity: "major",
        headline: "War disrupts the wind-turbine supply chain",
        detail: "Wind turbine capex ×1.35 starting next round.",
    },
    {
        category: "tech_unlock",
        severity: "base",
        headline: "Offshore turbines roll off the production line",
        detail: "The room's combined investment in onshore wind has crossed the threshold — Offshore Wind Turbine is purchasable from Round 4.",
    },
];

export const RECAP_ROUND_JUST_ENDED = 3;
export const RECAP_ROUND_NEXT = 4;
