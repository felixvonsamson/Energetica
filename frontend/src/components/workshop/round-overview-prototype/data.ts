/**
 * PROTOTYPE (#1008) — throwaway. Sample balance-sheet data for the Round
 * overview layout prototype. Nothing here reads the backend: the question is
 * what the page should look like, not whether the numbers are right.
 *
 * Three scenarios, picked with `?scenario=`: a Round part-way through
 * (`partial`), a finished Round (`full`) and a Round a blackout ended in autumn
 * (`blackout`).
 */

import { SEASONS, type Season } from "@/lib/workshop-timeline";

export { SEASONS, type Season };

export type Scenario = "partial" | "full" | "blackout";
export const SCENARIOS: Scenario[] = ["partial", "full", "blackout"];

/** $ per MWh paid to dump unsold renewable output (`DUMP_COST`). */
export const DUMP_PRICE = 25;
/** Sample rates for the rows that don't exist yet. */
export const REVENUE_TAX_RATE = 0.05;
export const CARBON_TAX_PER_TONNE = 40;
export const CARBON_REDISTRIBUTED_PER_SEASON = 6_000;

export interface OmLine {
    facility: string;
    count: number;
    /** O&M charged whatever the use, $ per season. */
    fixed: number;
    /** The variable part at full use, $ per season. */
    variableFull: number;
    /** Capacity factor, 0 to 1. */
    usage: number;
}

export interface SeasonFigures {
    /** MWh sold, and the volume-weighted average price in $/MWh. */
    exportVolume: number;
    exportPrice: number;
    /** MWh bought to charge storage, and its average price in $/MWh. */
    importVolume: number;
    importPrice: number;
    /** MWh of renewable output dumped unsold. */
    dumpVolume: number;
    om: OmLine[];
    /** Tonnes of CO₂ emitted. */
    emissions: number;
    /** The grid went down in this season. */
    blackout?: boolean;
}

export interface Investment {
    facility: string;
    count: number;
    unitPrice: number;
}

export type SeasonState =
    | { status: "done"; figures: SeasonFigures }
    | { status: "future" }
    | { status: "skipped" };

export interface RoundData {
    round: number;
    seasons: Record<Season, SeasonState>;
    investments: Investment[];
}

// Fleet: 2 onshore wind, 1 coal burner, 1 gas burner (new), 1 PV solar,
// 1 lithium-ion battery (new). O&M per season is a quarter of om_per_round.
function om(usage: {
    wind: number;
    coal: number;
    gas: number;
    pv: number;
    battery: number;
}): OmLine[] {
    return [
        {
            facility: "Onshore wind turbine",
            count: 2,
            fixed: 7_500,
            variableFull: 0,
            usage: usage.wind,
        },
        {
            facility: "Coal burner",
            count: 1,
            fixed: 900,
            variableFull: 3_600,
            usage: usage.coal,
        },
        {
            facility: "Gas burner",
            count: 1,
            fixed: 800,
            variableFull: 3_200,
            usage: usage.gas,
        },
        {
            facility: "PV solar",
            count: 1,
            fixed: 6_250,
            variableFull: 0,
            usage: usage.pv,
        },
        {
            facility: "Lithium-ion batteries",
            count: 1,
            fixed: 2_000,
            variableFull: 0,
            usage: usage.battery,
        },
    ];
}

const FIGURES: Record<Season, SeasonFigures> = {
    spring: {
        exportVolume: 9_800,
        exportPrice: 42.1,
        importVolume: 1_150,
        importPrice: 17.4,
        dumpVolume: 310,
        om: om({ wind: 0.34, coal: 0.55, gas: 0.18, pv: 0.21, battery: 0.12 }),
        emissions: 2_850,
    },
    summer: {
        exportVolume: 8_400,
        exportPrice: 36.8,
        importVolume: 1_640,
        importPrice: 9.2,
        dumpVolume: 920,
        om: om({ wind: 0.22, coal: 0.41, gas: 0.09, pv: 0.31, battery: 0.16 }),
        emissions: 2_120,
    },
    autumn: {
        exportVolume: 11_200,
        exportPrice: 51.5,
        importVolume: 980,
        importPrice: 22.0,
        dumpVolume: 140,
        om: om({ wind: 0.39, coal: 0.68, gas: 0.33, pv: 0.14, battery: 0.11 }),
        emissions: 3_640,
    },
    winter: {
        exportVolume: 12_900,
        exportPrice: 68.3,
        importVolume: 720,
        importPrice: 31.5,
        dumpVolume: 60,
        om: om({ wind: 0.43, coal: 0.81, gas: 0.52, pv: 0.08, battery: 0.09 }),
        emissions: 4_410,
    },
};

const INVESTMENTS: Investment[] = [
    { facility: "Gas burner", count: 1, unitPrice: 90_000 },
    { facility: "Lithium-ion batteries", count: 1, unitPrice: 660_000 },
];

export function sampleRound(scenario: Scenario, round: number): RoundData {
    const done = (season: Season): SeasonState => ({
        status: "done",
        figures: FIGURES[season],
    });
    const seasons: Record<Season, SeasonState> =
        scenario === "partial"
            ? {
                  spring: done("spring"),
                  summer: done("summer"),
                  autumn: { status: "future" },
                  winter: { status: "future" },
              }
            : scenario === "full"
              ? {
                    spring: done("spring"),
                    summer: done("summer"),
                    autumn: done("autumn"),
                    winter: done("winter"),
                }
              : {
                    spring: done("spring"),
                    summer: done("summer"),
                    autumn: {
                        status: "done",
                        // The simulation stopped at the blackout, so autumn is cut short.
                        figures: {
                            ...FIGURES.autumn,
                            exportVolume: 7_300,
                            importVolume: 610,
                            emissions: 2_390,
                            blackout: true,
                        },
                    },
                    winter: { status: "skipped" },
                };
    return { round, seasons, investments: INVESTMENTS };
}

// --- Derived figures -------------------------------------------------------

export const omVariable = (line: OmLine) => line.variableFull * line.usage;
export const omTotal = (line: OmLine) => line.fixed + omVariable(line);

export interface SeasonSheet {
    exportRevenue: number;
    importCost: number;
    marketIncome: number;
    dumpCost: number;
    om: number;
    revenueTax: number;
    operatingIncome: number;
    carbonTaxPaid: number;
    carbonTaxReceived: number;
    carbonTax: number;
}

/** `future` includes the rows for features that don't exist yet. */
export function seasonSheet(f: SeasonFigures, future = true): SeasonSheet {
    const exportRevenue = f.exportVolume * f.exportPrice;
    const importCost = f.importVolume * f.importPrice;
    const marketIncome = exportRevenue - importCost;
    const dumpCost = f.dumpVolume * DUMP_PRICE;
    const omSum = f.om.reduce((sum, line) => sum + omTotal(line), 0);
    const revenueTax = future ? exportRevenue * REVENUE_TAX_RATE : 0;
    const carbonTaxPaid = future ? f.emissions * CARBON_TAX_PER_TONNE : 0;
    const carbonTaxReceived = future ? CARBON_REDISTRIBUTED_PER_SEASON : 0;
    return {
        exportRevenue,
        importCost,
        marketIncome,
        dumpCost,
        om: omSum,
        revenueTax,
        operatingIncome: marketIncome - dumpCost - omSum - revenueTax,
        carbonTaxPaid,
        carbonTaxReceived,
        carbonTax: carbonTaxPaid - carbonTaxReceived,
    };
}

export const investmentTotal = (round: RoundData) =>
    round.investments.reduce((sum, i) => sum + i.count * i.unitPrice, 0);

export function doneFigures(round: RoundData): SeasonFigures[] {
    return SEASONS.flatMap((season) => {
        const state = round.seasons[season];
        return state.status === "done" ? [state.figures] : [];
    });
}

/** The Round's figures so far, as if it were one long season. */
export function roundFigures(round: RoundData): SeasonFigures | null {
    const done = doneFigures(round);
    if (done.length === 0) return null;
    const exportVolume = sum(done, (f) => f.exportVolume);
    const importVolume = sum(done, (f) => f.importVolume);
    return {
        exportVolume,
        exportPrice:
            sum(done, (f) => f.exportVolume * f.exportPrice) / exportVolume,
        importVolume,
        importPrice:
            sum(done, (f) => f.importVolume * f.importPrice) / importVolume,
        dumpVolume: sum(done, (f) => f.dumpVolume),
        om: done[0]!.om.map((line, i) => {
            const lines = done.map((f) => f.om[i]!);
            const variableFull = sum(lines, (l) => l.variableFull);
            return {
                ...line,
                fixed: sum(lines, (l) => l.fixed),
                variableFull,
                usage:
                    variableFull === 0
                        ? sum(lines, (l) => l.usage) / lines.length
                        : sum(lines, omVariable) / variableFull,
            };
        }),
        emissions: sum(done, (f) => f.emissions),
        blackout: done.some((f) => f.blackout),
    };
}

function sum<T>(items: T[], value: (item: T) => number): number {
    return items.reduce((total, item) => total + value(item), 0);
}

/**
 * Whether each Round-total figure is final: every season has run or been
 * skipped.
 */
export const roundClosed = (round: RoundData) =>
    SEASONS.every((s) => round.seasons[s].status !== "future");
