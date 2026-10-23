/**
 * PROTOTYPE (#1289) — throwaway. The mock scene for variant D, cut to how many
 * Trading periods have settled (`?periods=0` to `8`), so the history charts can
 * be seen at the start of a session as well as later on.
 *
 * With a count that is a multiple of 4, the session is in an Investment phase.
 * Otherwise the next Trading period's price-setting window is open.
 */

import {
    DURATION_CURVE,
    EMISSIONS,
    FUELS,
    MARKET_PRICES,
    PERIODS,
    PLAYER_PRICES,
    SEASONS,
} from "./mock-data";

export const MAX_PERIODS = PERIODS.length;

export const PRICE_TYPES = [
    { name: "Coal", color: "rgb(150, 156, 164)" },
    { name: "Gas", color: "rgb(141, 176, 255)" },
    { name: "Nuclear", color: "rgb(206, 220, 80)" },
    { name: "Hydro", color: "rgb(80, 169, 222)" },
    { name: "Wind", color: "rgb(103, 190, 150)" },
    { name: "Solar", color: "rgb(255, 244, 80)" },
    { name: "Storage sell", color: "rgb(199, 162, 133)" },
    { name: "Storage buy", color: "rgb(158, 138, 126)" },
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

/**
 * The room's energy per source in each period, in GWh. Wind peaks in winter,
 * solar in summer.
 */
const GENERATION: number[][] = (() => {
    const rows = GENERATION_SOURCES.map(() => [] as number[]);
    PERIODS.forEach((_, i) => {
        const season = i % 4;
        const round = Math.floor(i / 4);
        const demand = 4300 * (1 + 0.08 * round) * [1, 0.95, 1, 1.15][season]!;
        const nuclear = 1200 + round * 300;
        const hydro = 650 * [1.2, 0.8, 0.9, 1.1][season]!;
        const wind = (700 + round * 250) * [1, 0.7, 1.1, 1.35][season]!;
        const solar = (350 + round * 200) * [1.1, 1.5, 0.85, 0.45][season]!;
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
    });
    return rows;
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

const ALARMS: DashboardAlarm[] = [
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
        at: 2,
        when: "R1 Sum",
        level: "warning",
        tag: "EVENT",
        text: "Cold snap: demand +6% this summer",
        short: "cold snap",
    },
];

export function scene(settled: number) {
    const round = Math.floor(settled / 4) + 1;
    const investing = settled % 4 === 0;
    const season = SEASONS[settled % 4]!;
    const roundEmissions: number[] = [];
    for (let i = 0; i < settled; i += 4) {
        roundEmissions.push(
            EMISSIONS.slice(i, Math.min(i + 4, settled)).reduce(
                (a, b) => a + b,
                0,
            ),
        );
    }
    const completedRounds = Math.floor(settled / 4);
    return {
        settled,
        round,
        roundCount: 5,
        phase: investing ? "Investment phase" : `${season} trading`,
        next: investing
            ? `Next: ${season} trading`
            : `Prices close for ${season}`,
        periods: PERIODS.slice(0, settled),
        /**
         * The labels for the price boxes: the settled periods, then the open
         * one, if any.
         */
        priceLabels: PERIODS.slice(0, settled).concat(
            investing ? [] : [`R${round} ${season.slice(0, 3)}`],
        ),
        playerPrices: PLAYER_PRICES.map((rows) =>
            rows.slice(0, investing ? settled : settled + 1),
        ),
        livePeriod: !investing,
        marketPrices: MARKET_PRICES.slice(0, settled),
        /**
         * Fuel prices are set as each period opens, so the open (or next) one
         * has a price too.
         */
        fuels: FUELS.map((fuel) => ({
            ...fuel,
            prices: fuel.prices.slice(0, settled + 1),
            labels: PERIODS.concat(["R3 Spr"]).slice(0, settled + 1),
        })),
        generation: GENERATION.map((row) => row.slice(0, settled)),
        durationCurve: settled > 0 ? DURATION_CURVE : [],
        /** Each Round's emissions, the current one partial. */
        roundEmissions,
        lastRoundEmissions:
            completedRounds > 0
                ? roundEmissions[completedRounds - 1]!
                : undefined,
        totalEmissions: EMISSIONS.slice(0, settled).reduce((a, b) => a + b, 0),
        alarms: ALARMS.filter((alarm) => alarm.at <= settled),
    };
}

export type Scene = ReturnType<typeof scene>;
