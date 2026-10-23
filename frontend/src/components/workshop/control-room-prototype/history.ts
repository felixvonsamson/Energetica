/**
 * PROTOTYPE (#1289) — throwaway. The mock scene for variant D, generated for a
 * session of up to 24 Trading periods and cut to how many have settled.
 *
 * With a settled count that is a multiple of 4, the session is in an Investment
 * phase. Otherwise the next Trading period's price-setting window is open.
 *
 * Every history chart shows at most the last {@link WINDOW} seasons. Fuel prices
 * always show {@link FUEL_POINTS} prices, with invented prices from before the
 * session filling the start.
 */

export const MAX_PERIODS = 24;
export const WINDOW = 8;
export const FUEL_POINTS = 9;
const PRE_SESSION = FUEL_POINTS;

const SEASON_SHORT = ["Spr", "Sum", "Aut", "Win"];
const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"];
const label = (i: number) => `R${Math.floor(i / 4) + 1} ${SEASON_SHORT[i % 4]}`;

function seeded(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    };
}
const rand = seeded(1289);

export type PriceGroup = "controllable" | "renewable" | "storage";

/**
 * The price charts, in grid order: controllable then storage on top, renewables
 * then storage below.
 */
export const PRICE_TYPES: {
    name: string;
    color: string;
    base: number;
    group: PriceGroup;
}[] = [
    {
        name: "Coal",
        color: "rgb(150, 156, 164)",
        base: 55,
        group: "controllable",
    },
    {
        name: "Gas",
        color: "rgb(141, 176, 255)",
        base: 78,
        group: "controllable",
    },
    {
        name: "Nuclear",
        color: "rgb(206, 220, 80)",
        base: 30,
        group: "controllable",
    },
    {
        name: "Storage sell",
        color: "rgb(199, 162, 133)",
        base: 120,
        group: "storage",
    },
    { name: "Hydro", color: "rgb(80, 169, 222)", base: 42, group: "renewable" },
    { name: "Wind", color: "rgb(103, 190, 150)", base: 18, group: "renewable" },
    { name: "Solar", color: "rgb(255, 244, 80)", base: 12, group: "renewable" },
    {
        name: "Storage buy",
        color: "rgb(158, 138, 126)",
        base: 35,
        group: "storage",
    },
];

export const GENERATION_SOURCES = [
    { name: "Nuclear", color: "rgb(206, 220, 80)" },
    { name: "Hydro", color: "rgb(80, 169, 222)" },
    { name: "Coal", color: "rgb(150, 156, 164)" },
    { name: "Gas", color: "rgb(141, 176, 255)" },
    { name: "Wind", color: "rgb(103, 190, 150)" },
    { name: "Solar", color: "rgb(255, 244, 80)" },
    { name: "Storage", color: "rgb(199, 162, 133)" },
];

const FUEL_DEFS = [
    {
        name: "Coal",
        unit: "/kg",
        color: "rgb(150, 156, 164)",
        catalog: 0.1,
        digits: 3,
        shockAt: -1,
    },
    {
        name: "Gas",
        unit: "/kg",
        color: "rgb(141, 176, 255)",
        catalog: 0.25,
        digits: 3,
        shockAt: PRE_SESSION + 7,
    },
    {
        name: "Uranium",
        unit: "/kg",
        color: "rgb(206, 220, 80)",
        catalog: 250,
        digits: 0,
        shockAt: -1,
    },
];

// Everything below is generated once, for the whole 24-period session.

const MARKET = Array.from({ length: MAX_PERIODS }, (_, i) => {
    const mean =
        62 +
        Math.sin(i * 1.4) * 14 +
        (i === 5 ? 38 : 0) +
        rand() * 8 +
        Math.floor(i / 4) * 3;
    return {
        mean,
        p10: mean * (0.35 + rand() * 0.15),
        p90: mean * (1.5 + rand() * 0.5),
    };
});

/**
 * Each type's [min, Q1, median, Q3, max] per period, including the one after
 * the last settled.
 */
const PLAYER_PRICES = PRICE_TYPES.map((type) =>
    Array.from({ length: MAX_PERIODS + 1 }, (_, i) => {
        const median = type.base * (1 + Math.sin(i * 0.9 + type.base) * 0.15);
        const spread = type.base * Math.max(0.15, 0.6 - i * 0.03);
        return [
            Math.max(0, median - spread * (1 + rand())),
            median - spread * (0.3 + rand() * 0.2),
            median,
            median + spread * (0.3 + rand() * 0.3),
            median +
                spread * (1.2 + rand() * (type.group === "storage" ? 3 : 1.5)),
        ];
    }),
);

const GENERATION: number[][] = (() => {
    const rows = GENERATION_SOURCES.map(() => [] as number[]);
    for (let i = 0; i < MAX_PERIODS; i++) {
        const season = i % 4;
        const round = Math.floor(i / 4);
        const demand = 4300 * 1.08 ** round * [1, 0.95, 1, 1.15][season]!;
        const nuclear = 1200 + round * 250;
        const hydro = 650 * [1.2, 0.8, 0.9, 1.1][season]!;
        const wind = (700 + round * 260) * [1, 0.7, 1.1, 1.35][season]!;
        const solar = (350 + round * 220) * [1.1, 1.5, 0.85, 0.45][season]!;
        const storage = 60 + round * 60;
        const rest = Math.max(
            0,
            demand - nuclear - hydro - wind - solar - storage,
        );
        const coal = rest * 0.55;
        const gas = rest - coal;
        [nuclear, hydro, coal, gas, wind, solar, storage].forEach((v, j) =>
            rows[j]!.push(v),
        );
    }
    return rows;
})();

const EMISSIONS = Array.from({ length: MAX_PERIODS }, (_, i) =>
    Math.max(
        80_000,
        420_000 + Math.sin(i) * 60_000 - i * 14_000 + rand() * 30_000,
    ),
);

/**
 * Each fuel's price per season: invented prices before the session, then one
 * per period.
 */
const FUEL_PRICES = FUEL_DEFS.map((fuel) => {
    const out = [fuel.catalog];
    for (let i = 1; i < PRE_SESSION + MAX_PERIODS + 1; i++) {
        const prev = out[i - 1]!;
        let next =
            prev +
            (fuel.catalog - prev) * 0.5 +
            (rand() - 0.5) * 0.4 * fuel.catalog;
        if (i === fuel.shockAt) next = prev * 1.6;
        out.push(next);
    }
    return out;
});

const DURATION_CURVE = (() => {
    const prices: number[] = [];
    for (let i = 0; i < 168 * 4; i++) {
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

export interface DashboardAlarm {
    /** How many periods must have settled for it to show. */
    at: number;
    when: string;
    level: "critical" | "warning" | "info";
    tag: string;
    text: string;
    short: string;
}

/** Newest first. */
const ALARMS: DashboardAlarm[] = [
    {
        at: 22,
        when: "R6 Aut",
        level: "warning",
        tag: "EVENT",
        text: "Hurricane: revenue tax 12% this season",
        short: "hurricane",
    },
    {
        at: 21,
        when: "R6 Sum",
        level: "critical",
        tag: "BLACKOUT",
        text: "Grid down day 160, 19:30. Back up day 161",
        short: "day 160",
    },
    {
        at: 20,
        when: "R6 Inv",
        level: "warning",
        tag: "DEMAND",
        text: "Demand grows +5% this Round",
        short: "+5%",
    },
    {
        at: 20,
        when: "R6 Inv",
        level: "info",
        tag: "UNLOCK",
        text: "Gen IV nuclear reactors can now be bought",
        short: "gen IV nuclear",
    },
    {
        at: 17,
        when: "R5 Sum",
        level: "warning",
        tag: "EVENT",
        text: "Heatwave: demand +15% this summer",
        short: "heatwave",
    },
    {
        at: 16,
        when: "R5 Inv",
        level: "warning",
        tag: "SHOCK",
        text: "Uranium mine strike: uranium price +40%",
        short: "uranium",
    },
    {
        at: 12,
        when: "R4 Inv",
        level: "info",
        tag: "UNLOCK",
        text: "Hydrogen storage can now be bought",
        short: "hydrogen storage",
    },
    {
        at: 9,
        when: "R3 Spr",
        level: "info",
        tag: "VOTE",
        text: "Carbon tax passed: 40 per tonne from now on",
        short: "tax passed",
    },
    {
        at: 8,
        when: "R3 Inv",
        level: "info",
        tag: "VOTE",
        text: "Carbon tax vote open until the Investment phase closes",
        short: "carbon tax",
    },
    {
        at: 8,
        when: "R3 Inv",
        level: "info",
        tag: "UNLOCK",
        text: "Offshore wind turbines can now be bought",
        short: "offshore wind",
    },
    {
        at: 8,
        when: "R3 Inv",
        level: "warning",
        tag: "DEMAND",
        text: "Demand grows +8% this Round",
        short: "+8%",
    },
    {
        at: 8,
        when: "R3 Inv",
        level: "warning",
        tag: "SHOCK",
        text: "Gas pipeline disruption: gas price +60%",
        short: "gas",
    },
    {
        at: 8,
        when: "R2 Win",
        level: "critical",
        tag: "BLACKOUT",
        text: "Grid down day 312, 18:45. Back up day 313",
        short: "day 312",
    },
    {
        at: 8,
        when: "R2 Win",
        level: "warning",
        tag: "RATION",
        text: "Demand rationed −10% until the end of Round 2",
        short: "−10%",
    },
    {
        at: 6,
        when: "R2 Aut",
        level: "warning",
        tag: "EVENT",
        text: "Drought: revenue tax 8% this season",
        short: "drought",
    },
    {
        at: 6,
        when: "R2 Sum",
        level: "critical",
        tag: "BLACKOUT",
        text: "Grid down day 167, 13:15. Back up day 168",
        short: "day 167",
    },
    {
        at: 5,
        when: "R2 Sum",
        level: "warning",
        tag: "EVENT",
        text: "Heatwave: demand +12% this summer",
        short: "heatwave",
    },
    {
        at: 4,
        when: "R2 Inv",
        level: "info",
        tag: "UNLOCK",
        text: "Combined cycle gas plants can now be bought",
        short: "combined cycle",
    },
    {
        at: 1,
        when: "R1 Sum",
        level: "warning",
        tag: "EVENT",
        text: "Cold snap: demand +6% this summer",
        short: "cold snap",
    },
];

/** The last {@link WINDOW} items of a list. */
const recent = <T>(items: T[], size = WINDOW) =>
    items.slice(Math.max(0, items.length - size));

export function scene(settled: number, roundCount: number) {
    const round = Math.floor(settled / 4) + 1;
    const investing = settled % 4 === 0;
    const live = !investing;
    const season = SEASON_NAMES[settled % 4]!;
    const settledIdx = Array.from({ length: settled }, (_, i) => i);
    const historyIdx = recent(settledIdx);
    // The open period's prices take one of the 8 places.
    const priceIdx = recent(live ? [...settledIdx, settled] : settledIdx);

    const roundEmissions: { label: string; value: number; partial: boolean }[] =
        [];
    for (let r = 0; r * 4 < settled; r++) {
        const value = EMISSIONS.slice(
            r * 4,
            Math.min(r * 4 + 4, settled),
        ).reduce((a, b) => a + b, 0);
        roundEmissions.push({
            label: `R${r + 1}`,
            value,
            partial: r * 4 + 4 > settled,
        });
    }
    const completed = roundEmissions.filter((r) => !r.partial);
    const carbonTax =
        settled >= 9
            ? ("in-force" as const)
            : settled === 8
              ? ("vote-open" as const)
              : ("off" as const);

    return {
        settled,
        round,
        roundCount,
        phase: investing ? "Investment phase" : `${season} trading`,
        next: investing
            ? `Next: ${season} trading`
            : `Prices close for ${season}`,
        periods: historyIdx.map(label),
        marketPrices: historyIdx.map((i) => MARKET[i]!),
        generation: GENERATION.map((row) => historyIdx.map((i) => row[i]!)),
        priceLabels: priceIdx.map(label),
        playerPrices: PLAYER_PRICES.map((rows) =>
            priceIdx.map((i) => rows[i]!),
        ),
        livePeriod: live,
        /**
         * A fuel's price is set when its period opens; before the first, it
         * shows the season to come.
         */
        fuels: FUEL_DEFS.map((fuel, f) => {
            const end = PRE_SESSION + settled + 1;
            return {
                ...fuel,
                prices: FUEL_PRICES[f]!.slice(end - FUEL_POINTS, end),
                preSession: Math.max(0, PRE_SESSION - (end - FUEL_POINTS)),
            };
        }),
        durationCurve: settled > 0 ? DURATION_CURVE : [],
        roundEmissions: recent(roundEmissions),
        lastRoundEmissions: completed.at(-1)?.value,
        totalEmissions: EMISSIONS.slice(0, settled).reduce((a, b) => a + b, 0),
        carbonTax,
        alarms: ALARMS.filter((alarm) => alarm.at <= settled),
    };
}

export type Scene = ReturnType<typeof scene>;

/** The three scenes D1 to D3 show: settled periods and Round count. */
export const SCENES: Record<string, { settled: number; roundCount: number }> = {
    D1: { settled: 1, roundCount: 5 },
    D2: { settled: 8, roundCount: 5 },
    D3: { settled: 22, roundCount: 7 },
};
