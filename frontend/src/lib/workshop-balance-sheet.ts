/**
 * The Round overview's balance sheet (#1008): its rows, its number formats and
 * its waterfall chart, worked out from the player's `BalanceSheet`.
 *
 * Only level-0 rows add up to the result. The rows indented under them break
 * those lines down, with a volume and a rate where the amount is one times the
 * other. Energy arrives in Wh and is shown in MWh, and fuel and CO₂ arrive in
 * kg and are shown in tonnes.
 *
 * The simple view adds up operating income by kind: market income, dumping, O&M
 * and fuel. The detailed view adds it up by facility type instead, so each
 * type's row is what it earned, with its sales, dumping, O&M and fuel under it.
 * Fuel bought beyond what was burned went into stock, and has its own row.
 */

import { KG_PER_TONNE } from "@/lib/workshop-fuel";
import type { ApiSchema } from "@/types/api-helpers";

export type BalanceSheet = ApiSchema<"BalanceSheet">;
export type PeriodSheet = ApiSchema<"PeriodSheet">;
export type SeasonSheet = ApiSchema<"SeasonSheet">;
export type FinancingLine = ApiSchema<"FinancingLine">;
type OmLine = ApiSchema<"OmLine">;
type FacilityFuelLine = ApiSchema<"FacilityFuelLine">;

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

/**
 * Fuel in tonnes: like a volume, but to the nearest kg below 10 t, since a
 * season's uranium can be a few kg.
 */
export function formatFuelVolume(tonnes: number): string {
    const rounded = Number(tonnes.toFixed(3));
    return Math.abs(rounded) < 10 ? String(rounded) : group(tonnes);
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
export type RowUnit = "energy" | "usage" | "fuel" | "tax" | "co2";

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

/** CO₂ taxed, as tonnes times the price per tonne. */
function co2Cell(emissions: number, ratePerKg: number, tax: number): Cell {
    return {
        volume: emissions / KG_PER_TONNE,
        rate: ratePerKg * KG_PER_TONNE,
        amount: -tax,
    };
}

/** Fuel as tonnes times the price per tonne. */
function fuelCell(quantity: number, cost: number): Cell {
    return {
        volume: quantity / KG_PER_TONNE,
        rate: quantity > 0 ? (cost / quantity) * KG_PER_TONNE : undefined,
        amount: -cost,
    };
}

/**
 * A climate event's revenue tax (#1012), only in a Round a disaster hit: the
 * taxable revenue times the rate in percent. Over the Round, that is the
 * revenue of the seasons it taxed, at their average rate.
 */
function revenueTaxRows(sheet: BalanceSheet): Row[] {
    if ((sheet.total?.revenue_tax ?? 0) <= 0) return [];
    return [
        {
            id: "revenue-tax",
            label: "Revenue tax",
            level: 0,
            kind: "line",
            unit: "tax",
            cell: (p) =>
                p.revenue_tax > 0
                    ? {
                          volume: p.taxable_revenue,
                          rate: p.revenue_tax_rate * 100,
                          amount: -p.revenue_tax,
                      }
                    : { amount: 0 },
        },
    ];
}

/** Operating income by kind, as the simple view adds it up. */
function rowsByKind(sheet: BalanceSheet): Row[] {
    return [
        {
            id: "market",
            label: "Market income",
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: p.market_income }),
        },
        {
            id: "dump",
            label: "Dumping cost",
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: -p.dump_cost }),
        },
        {
            id: "om",
            label: "Operation & maintenance",
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: -p.om_total }),
        },
        ...revenueTaxRows(sheet),
        // Fuel is paid for each season (#1009).
        {
            id: "fuel",
            label: "Fuel cost",
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: -p.fuel_total }),
        },
    ];
}

/** What one facility type earned over a period, after its own costs. */
function facilityResult(p: PeriodSheet, facility: string): number {
    const amount = (lines: { facility: string; amount: number }[]) =>
        lines.find((line) => line.facility === facility)?.amount ?? 0;
    const om = p.om.find((line) => line.facility === facility)?.om ?? 0;
    const fuel =
        p.facility_fuel.find((line) => line.facility === facility)?.cost ?? 0;
    return amount(p.sold) - amount(p.bought) - amount(p.dumped) - om - fuel;
}

/**
 * One facility type's rows: its result, with what it sold, bought, dumped, paid
 * in O&M and burned under it. A line the type has none of over the Round is
 * left out, and a season it had none in shows zero.
 */
function facilityRows(total: PeriodSheet, type: OmLine): Row[] {
    const id = type.facility;
    const has = (lines: { facility: string }[]) =>
        lines.some((line) => line.facility === id);
    const energyRow = (
        key: "sold" | "bought" | "dumped",
        label: string,
        sign: 1 | -1,
    ): Row[] =>
        has(total[key])
            ? [
                  {
                      id: `${id}-${key}`,
                      label,
                      level: 1,
                      kind: "line",
                      unit: "energy",
                      cell: (p) => {
                          const line = p[key].find((l) => l.facility === id);
                          if (!line) return { amount: 0 };
                          return energyCell(line.energy, sign * line.amount);
                      },
                  },
              ]
            : [];
    const omLine = (p: PeriodSheet) =>
        p.om.find((line) => line.facility === id);
    const rows: Row[] = [
        {
            id: `facility-${id}`,
            label: `${type.name} ×${type.count}`,
            level: 0,
            kind: "line",
            cell: (p) => ({ amount: facilityResult(p, id) }),
        },
        ...energyRow("sold", "Energy sold", 1),
        ...energyRow("bought", "Energy bought (storage)", -1),
        ...energyRow("dumped", "Dumping cost", -1),
        {
            id: `${id}-om`,
            label: "Operation & maintenance",
            level: 1,
            kind: "line",
            cell: (p) => ({ amount: -(omLine(p)?.om ?? 0) }),
        },
    ];
    // A facility charged the same whatever its use has nothing to split.
    if (type.variable_full > 0) {
        rows.push(
            {
                id: `${id}-om-fixed`,
                label: "Fixed",
                level: 2,
                kind: "line",
                cell: (p) => ({ amount: -(omLine(p)?.fixed ?? 0) }),
            },
            {
                id: `${id}-om-variable`,
                label: "Variable (usage × full cost)",
                level: 2,
                kind: "line",
                unit: "usage",
                cell: (p) => {
                    const season = omLine(p);
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
    const fuel = total.facility_fuel.find((line) => line.facility === id);
    if (fuel) rows.push(...facilityFuelRows(id, fuel));
    return rows;
}

/**
 * The fuel a facility type burned, in tonnes. If it burned any from stock over
 * the Round, it breaks down into the fuel bought in the period, at its price,
 * and the fuel from stock, which costs nothing: it was charged as excess fuel
 * when it was bought.
 */
function facilityFuelRows(id: string, fuel: FacilityFuelLine): Row[] {
    const season = (p: PeriodSheet) =>
        p.facility_fuel.find((line) => line.facility === id);
    // The fuel's name as the server writes it: "gas" is "Gas".
    const name = fuel.fuel.charAt(0).toUpperCase() + fuel.fuel.slice(1);
    if (fuel.from_stock <= 0) {
        return [
            {
                id: `${id}-fuel`,
                label: `Fuel (${name})`,
                level: 1,
                kind: "line",
                unit: "fuel",
                cell: (p) => {
                    const line = season(p);
                    if (!line) return { amount: 0 };
                    return fuelCell(line.quantity, line.cost);
                },
            },
        ];
    }
    return [
        {
            id: `${id}-fuel`,
            label: `Fuel (${name})`,
            level: 1,
            kind: "line",
            unit: "fuel",
            cell: (p) => {
                const line = season(p);
                if (!line) return { amount: 0 };
                return {
                    volume: (line.quantity + line.from_stock) / KG_PER_TONNE,
                    amount: -line.cost,
                };
            },
        },
        {
            id: `${id}-fuel-bought`,
            label: "Bought fuel",
            level: 2,
            kind: "line",
            unit: "fuel",
            cell: (p) => {
                const line = season(p);
                if (!line) return { amount: 0 };
                return fuelCell(line.quantity, line.cost);
            },
        },
        {
            id: `${id}-fuel-stock`,
            label: "Fuel from stock",
            level: 2,
            kind: "line",
            unit: "fuel",
            cell: (p) => {
                const line = season(p);
                if (!line) return { amount: 0 };
                return {
                    volume: line.from_stock / KG_PER_TONNE,
                    rate: 0,
                    amount: 0,
                };
            },
        },
    ];
}

/** Fuel paid for beyond what was burned, which went into stock, by fuel. */
function excessFuelRows(total: PeriodSheet): Row[] {
    if (total.excess_fuel.length === 0) return [];
    return [
        {
            id: "excess-fuel",
            label: "Excess fuel (stocked)",
            level: 0,
            kind: "line",
            cell: (p) => ({
                amount: -p.excess_fuel.reduce(
                    (sum, line) => sum + line.cost,
                    0,
                ),
            }),
        },
        ...total.excess_fuel.map(
            (fuel): Row => ({
                id: `excess-fuel-${fuel.fuel}`,
                label: fuel.name,
                level: 1,
                kind: "line",
                unit: "fuel",
                cell: (p) => {
                    const line = p.excess_fuel.find(
                        (l) => l.fuel === fuel.fuel,
                    );
                    if (!line) return { amount: 0 };
                    return fuelCell(line.quantity, line.cost);
                },
            }),
        ),
    ];
}

/** Operating income by facility type, as the detailed view adds it up. */
function rowsByFacility(sheet: BalanceSheet, total: PeriodSheet): Row[] {
    return [
        ...total.om.flatMap((type) => facilityRows(total, type)),
        ...revenueTaxRows(sheet),
        ...excessFuelRows(total),
    ];
}

/**
 * The balance sheet's rows, top to bottom. The simple view has the level-0 rows
 * only. Before any season is settled there is nothing to group by facility
 * type, so both views add up by kind.
 */
export function balanceSheetRows(
    sheet: BalanceSheet,
    detailed: boolean,
): Row[] {
    const rows: Row[] =
        detailed && sheet.total
            ? rowsByFacility(sheet, sheet.total)
            : rowsByKind(sheet);
    rows.push({
        id: "operating",
        label: "Operating income",
        level: 0,
        kind: "subtotal",
        cell: (p) => ({ amount: p.operating_income }),
    });
    // The carbon tax (#1015), once it is in force: below operating income, which
    // leaves it out. It is paid on the CO₂ emitted building the Round's
    // investments, charged in its first season only, and on the CO₂ emitted
    // generating, each as tonnes times the price per tonne. The player's share
    // of what everyone paid comes back.
    if ((sheet.total?.carbon_tax_rate ?? 0) > 0) {
        rows.push(
            {
                id: "carbon-tax",
                label: "Carbon tax",
                level: 0,
                kind: "line",
                cell: (p) => ({ amount: -p.carbon_tax }),
            },
            {
                id: "carbon-tax-construction",
                label: "Tax on construction CO₂",
                level: 1,
                kind: "line",
                unit: "co2",
                cell: (p) =>
                    p.construction_emissions > 0
                        ? co2Cell(
                              p.construction_emissions,
                              p.carbon_tax_rate,
                              p.construction_carbon_tax,
                          )
                        : empty,
            },
            {
                id: "carbon-tax-emitted",
                label: "Tax on emitted CO₂",
                level: 1,
                kind: "line",
                unit: "co2",
                cell: (p) =>
                    co2Cell(
                        p.taxed_emissions,
                        p.carbon_tax_rate,
                        p.emitted_carbon_tax,
                    ),
            },
            {
                id: "carbon-tax-share",
                label: "Shared payback",
                level: 1,
                kind: "line",
                cell: (p) => ({ amount: p.carbon_tax_share }),
            },
        );
    }
    // The blackout cost (#1286): a share of the Round's operating income, for
    // the Round as a whole. Until the Round's last season is settled it is
    // worked out on the operating income so far.
    if (sheet.blackout_cost_share > 0) {
        const share = Math.round(sheet.blackout_cost_share * 100);
        const final = sheet.seasons.every((s) => s.status === "settled");
        rows.push({
            id: "blackout-cost",
            label: `Blackout cost (${share}% of operating income${final ? "" : " so far"})`,
            level: 0,
            kind: "line",
            cell: () => empty,
            roundAmount: -sheet.blackout_cost,
        });
    }
    rows.push(
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
    // The loan and its payments (#1225), below net profit and apart from it:
    // borrowing money is not a profit.
    if (sheet.financing.length > 0) {
        rows.push(
            {
                id: "financing",
                label: "Financing",
                level: 0,
                kind: "line",
                cell: () => empty,
                roundAmount: sheet.financing_total,
            },
            ...sheet.financing.map(
                (line, index): Row => ({
                    id: `financing-${index}`,
                    label: financingLabel(line),
                    level: 1,
                    kind: "line",
                    cell: () => empty,
                    roundAmount: line.amount,
                }),
            ),
        );
    }
    return detailed ? rows : rows.filter((row) => row.level === 0);
}

/** "Loan", or "Loan payment 1 of 2", noting a payment taken at the session end. */
export function financingLabel(line: FinancingLine): string {
    if (line.kind === "loan") return "Loan";
    const label = `Loan payment ${line.payment} of ${line.payment_count}`;
    return line.at_session_end ? `${label} (session end)` : label;
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
 * investments and any blackout cost. Once a carbon tax is in force, it comes
 * after operating income, as one step: what was paid minus the share that came
 * back. A season then ends on its result after it. Each change runs from the
 * running total; a subtotal is drawn from zero and resets it.
 */
export function waterfallSteps(
    period: PeriodSheet,
    round?: Pick<
        BalanceSheet,
        "investment_total" | "blackout_cost" | "net_profit"
    >,
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
    if (period.revenue_tax > 0) change("Revenue tax", -period.revenue_tax);
    change("Fuel cost", -period.fuel_total);
    subtotal("Operating income", period.operating_income);
    const carbonTax = period.carbon_tax_rate > 0;
    if (carbonTax) change("Carbon tax", -period.carbon_tax);
    if (round) {
        if (round.blackout_cost > 0)
            change("Blackout cost", -round.blackout_cost);
        change("Investments", -round.investment_total);
        subtotal("Net profit", round.net_profit);
    } else if (carbonTax) {
        subtotal("Season result", period.operating_income - period.carbon_tax);
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
