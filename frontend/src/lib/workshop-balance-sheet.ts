/**
 * The Round overview's balance sheet (#1008): its rows, its number formats and
 * its waterfall chart, worked out from the player's `BalanceSheet`.
 *
 * Only level-0 rows add up to the result. The rows indented under them break
 * those lines down, with a volume and a rate where the amount is one times the
 * other. Energy arrives in Wh and is shown in MWh, and fuel arrives in kg and
 * is shown in tonnes.
 */

import { KG_PER_TONNE } from "@/lib/workshop-fuel";
import type { ApiSchema } from "@/types/api-helpers";

export type BalanceSheet = ApiSchema<"BalanceSheet">;
export type PeriodSheet = ApiSchema<"PeriodSheet">;
export type SeasonSheet = ApiSchema<"SeasonSheet">;

const WH_PER_MWH = 1_000_000;

// --- Number formats --------------------------------------------------------

/** Groups thousands with an apostrophe: 9800 → "9'800". */
function group(value: number): string {
    return Math.round(value)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/**
 * Money as the statement writes it: in thousands from 10'000 up ("393k"), in
 * full below ("7'750"), with a real minus sign. No currency symbol.
 */
export function formatAmount(value: number): string {
    const sign = value < 0 && Math.round(Math.abs(value)) !== 0 ? "−" : "";
    const size = Math.abs(value);
    return sign + (size >= 10_000 ? `${group(size / 1_000)}k` : group(size));
}

/** A volume: whole numbers with thousands grouped, one decimal below 10. */
export function formatVolume(value: number): string {
    return Math.abs(value) < 10 && value % 1 !== 0
        ? value.toFixed(1)
        : group(value);
}

/** A rate: one decimal unless it is a whole number. */
export function formatRate(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    if (rounded % 1 === 0) return group(rounded);
    const [whole = "0", decimal = "0"] = Math.abs(rounded)
        .toFixed(1)
        .split(".");
    return `${rounded < 0 ? "−" : ""}${group(Number(whole))}.${decimal}`;
}

// --- Rows -----------------------------------------------------------------

/** What a row shows in one period's columns. */
export interface Cell {
    volume?: number;
    rate?: number;
    /** Null leaves the amount empty. */
    amount: number | null;
}

/** The unit column: what the volume and the rate are measured in. */
export type RowUnit = "energy" | "usage" | "fuel";

export interface Row {
    id: string;
    label: string;
    level: 0 | 1 | 2;
    kind: "line" | "subtotal" | "total" | "pending";
    unit?: RowUnit;
    /** The row's columns for a season, or for the Round so far. */
    cell: (sheet: PeriodSheet) => Cell;
    /**
     * Set for a row that belongs to the Round as a whole, such as an
     * investment: its seasons stay empty and the Round shows this.
     */
    roundAmount?: number;
}

const empty: Cell = { amount: null };

/** Energy and the money it was worth, as a volume in MWh and a rate per MWh. */
function energyCell(energy: number, money: number): Cell {
    const volume = energy / WH_PER_MWH;
    return {
        volume,
        rate: volume > 0 ? Math.abs(money) / volume : undefined,
        amount: money,
    };
}

/** The balance sheet's rows, top to bottom. */
export function balanceSheetRows(sheet: BalanceSheet): Row[] {
    const omLines = sheet.total?.om ?? [];
    const fuelLines = sheet.total?.fuel ?? [];
    const omLine = (period: PeriodSheet, facility: string) =>
        period.om.find((line) => line.facility === facility);

    const rows: Row[] = [
        {
            id: "market",
            label: "Market income",
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: p.market_income }),
        },
        {
            id: "sold",
            label: "Energy sold",
            level: 1,
            kind: "line",
            unit: "energy",
            cell: (p) => energyCell(p.energy_sold, p.sale_revenue),
        },
        {
            id: "bought",
            label: "Energy bought (storage)",
            level: 1,
            kind: "line",
            unit: "energy",
            cell: (p) => energyCell(p.energy_bought, -p.purchase_cost),
        },
        {
            id: "dump",
            label: "Dumping cost",
            level: 0,
            kind: "line",
            unit: "energy",
            cell: (p) => energyCell(p.energy_dumped, -p.dump_cost),
        },
        {
            id: "om",
            label: "Operation & maintenance",
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: -p.om_total }),
        },
    ];
    for (const line of omLines) {
        rows.push({
            id: `om-${line.facility}`,
            label: `${line.name} ×${line.count}`,
            level: 1,
            kind: "line",
            cell: (p) => ({ amount: -(omLine(p, line.facility)?.om ?? 0) }),
        });
        // A facility charged the same whatever its use has nothing to split.
        if (line.variable_full > 0) {
            rows.push(
                {
                    id: `om-${line.facility}-fixed`,
                    label: "Fixed",
                    level: 2,
                    kind: "line",
                    cell: (p) => ({
                        amount: -(omLine(p, line.facility)?.fixed ?? 0),
                    }),
                },
                {
                    id: `om-${line.facility}-variable`,
                    label: "Variable (usage × full cost)",
                    level: 2,
                    kind: "line",
                    unit: "usage",
                    cell: (p) => {
                        const season = omLine(p, line.facility);
                        if (!season) return { amount: 0 };
                        return {
                            volume: season.usage * 100,
                            rate: season.variable_full,
                            amount: -(season.om - season.fixed),
                        };
                    },
                },
            );
        }
    }
    // Still to come, each as its own level-0 row:
    // - Revenue tax (#1012), above fuel: the climate-event tax on sales, broken
    //   down as the taxable revenue times the rate in percent.
    // - Carbon tax (#1015), below operating income, which leaves it out: what
    //   was paid on the CO₂ emitted (tonnes times the price per tonne), less
    //   the share received back.
    // Fuel is paid for each season (#1009), as tonnes times the price per tonne.
    rows.push({
        id: "fuel",
        label: "Fuel cost",
        level: 0,
        kind: "line",
        cell: (p) => ({ amount: -p.fuel_total }),
    });
    for (const line of fuelLines) {
        rows.push({
            id: `fuel-${line.fuel}`,
            label: line.name,
            level: 1,
            kind: "line",
            unit: "fuel",
            cell: (p) => {
                const bought = p.fuel.find((f) => f.fuel === line.fuel);
                if (!bought) return { amount: 0 };
                return {
                    volume: bought.quantity / KG_PER_TONNE,
                    rate: bought.price * KG_PER_TONNE,
                    amount: -bought.cost,
                };
            },
        });
    }
    rows.push(
        {
            id: "operating",
            label: "Operating income",
            level: 0,
            kind: "subtotal",
            cell: (p) => ({ amount: p.operating_income }),
        },
        {
            id: "investments",
            label: "Investments",
            level: 0,
            kind: "line",
            cell: () => empty,
            roundAmount: -sheet.investment_total,
        },
        ...sheet.investments.map(
            (line): Row => ({
                id: `investment-${line.facility}`,
                label: `${line.name} ×${line.count}`,
                level: 1,
                kind: "line",
                cell: () => empty,
                roundAmount: -line.cost,
            }),
        ),
        {
            id: "net",
            label: "Net profit",
            level: 0,
            kind: "total",
            cell: () => empty,
            roundAmount: sheet.net_profit,
        },
    );
    return rows;
}

// --- Waterfall ------------------------------------------------------------

/** What the waterfall shows: one season, or the Round as a whole. */
export type Period = SeasonSheet["season"] | "round";

/**
 * The period the waterfall opens on. For the Round the session is in, that is
 * its last settled season, so the newest result is in view. For a past Round,
 * or one with nothing settled yet, it is the Round as a whole.
 */
export function initialPeriod(
    sheet: BalanceSheet,
    activeRound: number | null,
): Period {
    if (sheet.round !== activeRound) return "round";
    const settled = sheet.seasons.filter((s) => s.status === "settled");
    return settled.at(-1)?.season ?? "round";
}

export interface WaterfallStep {
    label: string;
    /** The change it makes, or the total it shows. Null while pending. */
    value: number | null;
    kind: "change" | "subtotal" | "pending";
    /** Where its bar starts and ends on the running total. */
    from: number;
    to: number;
}

/**
 * The waterfall from market income down to a period's result: operating income
 * for a season, and net profit for the Round, which also takes off its
 * investments. Each change runs from the running total; a subtotal is drawn
 * from zero and resets it.
 */
export function waterfallSteps(
    period: PeriodSheet,
    round?: Pick<BalanceSheet, "investment_total" | "net_profit">,
): WaterfallStep[] {
    const steps: WaterfallStep[] = [];
    let running = 0;
    const change = (label: string, value: number) => {
        steps.push({
            label,
            value,
            kind: "change",
            from: running,
            to: running + value,
        });
        running += value;
    };
    const subtotal = (label: string, value: number) => {
        steps.push({ label, value, kind: "subtotal", from: 0, to: value });
        running = value;
    };
    change("Market income", period.market_income);
    change("Dumping cost", -period.dump_cost);
    change("O&M", -period.om_total);
    // The revenue tax (#1012) goes here, and the carbon tax (#1015) after
    // operating income, followed by a season's result.
    change("Fuel cost", -period.fuel_total);
    subtotal("Operating income", period.operating_income);
    if (round) {
        change("Investments", -round.investment_total);
        subtotal("Net profit", round.net_profit);
    }
    return steps;
}

/** Where on the bar track, from 0 to 100, a value sits. */
export function waterfallScale(
    steps: WaterfallStep[],
): (value: number) => number {
    const ends = steps.flatMap((step) => [step.from, step.to]);
    const low = Math.min(0, ...ends);
    const high = Math.max(0, ...ends);
    const span = high - low || 1;
    return (value) => ((value - low) / span) * 100;
}
