/**
 * PROTOTYPE (#1289) — throwaway. Made-up figures for the control-room layout
 * prototype. Nothing here comes from the backend.
 *
 * The scene: a room of 18 players at the start of Round 3's Investment phase,
 * after two Rounds (eight settled Trading periods).
 */

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

/** Labels for the settled Trading periods, oldest first. */
export const PERIODS = [1, 2].flatMap((round) =>
    SEASONS.map((season) => `R${round} ${season.slice(0, 3)}`),
);

export const SESSION = {
    round: 3,
    roundCount: 5,
    phase: "Investment phase",
    nextSeason: "Spring",
    players: 18,
    phaseSeconds: 8 * 60,
};

/** A deterministic random generator, so every reload shows the same scene. */
function seeded(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
}
const rand = seeded(1289);

// Demand and capacity, in MW.
export const MUST_SERVE_PEAK = 2400;
export const ALL_TIERS_PEAK = MUST_SERVE_PEAK * 2.5;

export const CAPACITY_FACTORS = { hydro: 0.547, wind: 0.44, solar: 0.12 };
export const HYDRO_MINIMUM = 0.23;
export const STORAGE_HOURS = 16;

/** The room's capacity, bought plus selected. The live part drifts over time. */
export interface RoomCapacity {
    fossil: number;
    nuclear: number;
    hydro: number;
    wind: number;
    solar: number;
    storagePower: number;
    storageEnergy: number;
}

export const BASE_CAPACITY: RoomCapacity = {
    fossil: 1150,
    nuclear: 600,
    hydro: 700,
    wind: 900,
    solar: 1100,
    storagePower: 350,
    storageEnergy: 1400,
};

export type Risk = "guaranteed" | "likely" | "unlikely" | "very-unlikely";

export function blackoutRisk(c: RoomCapacity) {
    const controllable = c.fossil + c.nuclear + c.hydro * HYDRO_MINIMUM;
    const total = c.fossil + c.nuclear + c.hydro + c.wind + c.solar;
    const weighted =
        c.hydro * (CAPACITY_FACTORS.hydro - HYDRO_MINIMUM) +
        c.wind * CAPACITY_FACTORS.wind +
        c.solar * CAPACITY_FACTORS.solar;
    const storage = Math.min(c.storagePower, c.storageEnergy / STORAGE_HOURS);
    const gap = MUST_SERVE_PEAK - controllable;
    const cover = Math.sqrt(weighted * storage);
    let risk: Risk;
    if (total < MUST_SERVE_PEAK) risk = "guaranteed";
    else if (controllable >= MUST_SERVE_PEAK) risk = "very-unlikely";
    else risk = cover > gap ? "unlikely" : "likely";
    return { controllable, total, weighted, storage, gap, cover, risk };
}

export const RISK_STYLE: Record<Risk, { label: string; color: string }> = {
    guaranteed: { label: "BLACKOUT GUARANTEED", color: "#ff3b3b" },
    likely: { label: "BLACKOUT LIKELY", color: "#ff8a1f" },
    unlikely: { label: "BLACKOUT UNLIKELY", color: "#ffd21f" },
    "very-unlikely": { label: "BLACKOUT VERY UNLIKELY", color: "#2fd67b" },
};

// Fuel prices per kg, one per settled period plus the current season.
function walk(
    start: number,
    steps: number,
    volatility: number,
    shockAt?: number,
) {
    const out = [start];
    for (let i = 1; i < steps; i++) {
        const prev = out[i - 1]!;
        let next =
            prev +
            (start - prev) * 0.5 +
            (rand() - 0.5) * 2 * volatility * start;
        if (i === shockAt) next = prev * 1.6;
        out.push(next);
    }
    return out;
}

export const FUELS = [
    {
        name: "Coal",
        unit: "/kg",
        color: "rgb(150, 156, 164)",
        prices: walk(0.1, 9, 0.2),
        digits: 3,
    },
    {
        name: "Gas",
        unit: "/kg",
        color: "rgb(141, 176, 255)",
        prices: walk(0.25, 9, 0.2, 7),
        digits: 3,
    },
    {
        name: "Uranium",
        unit: "/kg",
        color: "rgb(206, 220, 80)",
        prices: walk(250, 9, 0.15),
        digits: 0,
    },
];
export const FUEL_LABELS = [...PERIODS, "R3 Spr"];

// Market prices of each settled period, per MWh.
export const MARKET_PRICES = PERIODS.map((_, i) => {
    const mean = 62 + Math.sin(i * 1.4) * 14 + (i === 5 ? 38 : 0) + rand() * 8;
    return {
        mean,
        p10: mean * (0.35 + rand() * 0.15),
        p90: mean * (1.5 + rand() * 0.5),
        max: i === 5 ? 9999 : mean * (2.2 + rand()),
    };
});

// The room's prices per facility type and period: [min, Q1, median, Q3, max].
export const PRICE_TYPES = [
    { name: "Coal", color: "rgb(150, 156, 164)", base: 55 },
    { name: "Gas", color: "rgb(141, 176, 255)", base: 78 },
    { name: "Nuclear", color: "rgb(206, 220, 80)", base: 30 },
    { name: "Hydro", color: "rgb(80, 169, 222)", base: 42 },
    { name: "Wind", color: "rgb(103, 190, 150)", base: 18 },
    { name: "Solar", color: "rgb(255, 244, 80)", base: 12 },
    { name: "Battery sell", color: "rgb(199, 162, 133)", base: 120 },
    { name: "Battery buy", color: "rgb(158, 138, 126)", base: 35 },
];

export const PLAYER_PRICES = PRICE_TYPES.map((type) =>
    [...PERIODS, "R3 Spr"].map((_, i) => {
        const drift = 1 + Math.sin(i * 0.9 + type.base) * 0.15;
        const median = type.base * drift;
        const spread = type.base * (0.6 - i * 0.04);
        return [
            Math.max(0, median - spread * (1 + rand())),
            median - spread * (0.3 + rand() * 0.2),
            median,
            median + spread * (0.3 + rand() * 0.3),
            median + spread * (1.2 + rand() * 1.5),
        ];
    }),
);

// The room's output over the last settled period's representative week, hourly, in MW.
export const MIX_SOURCES = [
    { name: "Nuclear", color: "rgb(206, 220, 80)" },
    { name: "Hydro", color: "rgb(80, 169, 222)" },
    { name: "Coal", color: "rgb(150, 156, 164)" },
    { name: "Gas", color: "rgb(141, 176, 255)" },
    { name: "Wind", color: "rgb(103, 190, 150)" },
    { name: "Solar", color: "rgb(255, 244, 80)" },
    { name: "Battery", color: "rgb(199, 162, 133)" },
];
export const MIX_HOURS = 168;
export const MIX: number[][] = (() => {
    const wind: number[] = [];
    let w = 0.4;
    for (let h = 0; h < MIX_HOURS; h++) {
        w = Math.min(0.95, Math.max(0.05, w + (rand() - 0.5) * 0.12));
        wind.push(w);
    }
    const rows = MIX_SOURCES.map(() => [] as number[]);
    for (let h = 0; h < MIX_HOURS; h++) {
        const hour = h % 24;
        const weekend = h >= 120;
        const demand =
            (1700 +
                600 * Math.exp(-((hour - 19) ** 2) / 8) +
                350 * Math.exp(-((hour - 9) ** 2) / 6)) *
            (weekend ? 0.85 : 1);
        const solar =
            Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * 1100 * 0.55;
        const windOut = wind[h]! * 900;
        const nuclear = 560;
        const hydro = 700 * 0.42;
        let rest = Math.max(0, demand - solar - windOut - nuclear - hydro);
        const battery = hour >= 18 && hour <= 21 ? Math.min(rest, 300) : 0;
        rest -= battery;
        const coal = Math.min(rest, 700);
        const gas = Math.max(0, rest - coal);
        [nuclear, hydro, coal, gas, windOut, solar, battery].forEach((v, i) =>
            rows[i]!.push(v),
        );
    }
    return rows;
})();

/** The last settled period's prices at every settlement point, highest first. */
export const DURATION_CURVE = (() => {
    const prices: number[] = [];
    for (let i = 0; i < MIX_HOURS * 4; i++) {
        const r = rand();
        prices.push(
            r < 0.02
                ? 250 + rand() * 400
                : r < 0.12
                  ? 0
                  : 20 + rand() ** 1.5 * 140,
        );
    }
    return prices.sort((a, b) => b - a);
})();

// Room emissions per period, in tonnes of CO₂.
export const EMISSIONS = PERIODS.map(
    (_, i) => 420_000 + Math.sin(i) * 60_000 - i * 18_000 + rand() * 30_000,
);
export const CARBON_TAX = {
    status: "vote-open" as "off" | "vote-open" | "in-force",
    rate: 40,
    since: undefined as number | undefined,
};

export type AlarmLevel = "critical" | "warning" | "info";
export interface Alarm {
    when: string;
    level: AlarmLevel;
    tag: string;
    text: string;
}

export const ALARMS: Alarm[] = [
    {
        when: "R3 Inv",
        level: "info",
        tag: "VOTE",
        text: "Carbon tax vote open until the Investment phase closes",
    },
    {
        when: "R3 Inv",
        level: "info",
        tag: "UNLOCK",
        text: "Offshore wind turbines can now be bought",
    },
    {
        when: "R3 Inv",
        level: "warning",
        tag: "DEMAND",
        text: "Demand grows +8% this Round",
    },
    {
        when: "R3 Inv",
        level: "warning",
        tag: "SHOCK",
        text: "Gas pipeline disruption: gas price +60%",
    },
    {
        when: "R2 Win",
        level: "critical",
        tag: "BLACKOUT",
        text: "Grid down day 312, 18:45. Back up day 313",
    },
    {
        when: "R2 Win",
        level: "warning",
        tag: "RATION",
        text: "Demand rationed −10% until the end of Round 2",
    },
    {
        when: "R2 Aut",
        level: "warning",
        tag: "EVENT",
        text: "Drought: revenue tax 8% this season",
    },
    {
        when: "R2 Sum",
        level: "critical",
        tag: "BLACKOUT",
        text: "Grid down day 167, 13:15. Back up day 168",
    },
    {
        when: "R2 Sum",
        level: "warning",
        tag: "EVENT",
        text: "Heatwave: demand +12% this summer",
    },
    {
        when: "R1 Win",
        level: "info",
        tag: "UNLOCK",
        text: "Combined cycle gas plants unlocked",
    },
];

export const ALARM_COLOR: Record<AlarmLevel, string> = {
    critical: "#ff3b3b",
    warning: "#ffb020",
    info: "#4fc3ff",
};
