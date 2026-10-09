import { describe, expect, it } from "vitest";

import {
    type BalanceSheet,
    type PeriodSheet,
    balanceSheetRows,
    formatAmount,
    formatRate,
    formatVolume,
    initialPeriod,
    waterfallScale,
    waterfallSteps,
} from "./workshop-balance-sheet";

const SPRING: PeriodSheet = {
    energy_sold: 9_800e6,
    sale_revenue: 412_580,
    energy_bought: 1_150e6,
    purchase_cost: 20_010,
    market_income: 392_570,
    energy_dumped: 310e6,
    dump_cost: 7_750,
    om: [
        {
            facility: "onshore_wind_turbine",
            name: "Onshore wind turbine",
            count: 2,
            om: 7_500,
            fixed: 7_500,
            variable_full: 0,
            usage: 0.34,
        },
        {
            facility: "coal_burner",
            name: "Coal burner",
            count: 1,
            om: 2_880,
            fixed: 900,
            variable_full: 3_600,
            usage: 0.55,
        },
    ],
    om_total: 10_380,
    operating_income: 374_440,
};

const SHEET: BalanceSheet = {
    round: 1,
    seasons: [
        { season: "spring", status: "settled", blackout: false, sheet: SPRING },
        { season: "summer", status: "upcoming", blackout: false, sheet: null },
        { season: "autumn", status: "upcoming", blackout: false, sheet: null },
        { season: "winter", status: "upcoming", blackout: false, sheet: null },
    ],
    total: SPRING,
    investments: [
        {
            facility: "gas_burner",
            name: "Gas burner",
            count: 1,
            cost: 90_000,
        },
    ],
    investment_total: 90_000,
    net_profit: 284_440,
};

describe("formats", () => {
    it("writes amounts in thousands from 10'000 up, with a real minus sign", () => {
        expect(formatAmount(392_570)).toBe("393k");
        expect(formatAmount(-7_750)).toBe("−7'750");
        expect(formatAmount(-2_100_000)).toBe("−2'100k");
        expect(formatAmount(-0.2)).toBe("0");
    });

    it("writes volumes whole and rates with one decimal unless whole", () => {
        expect(formatVolume(9_800.4)).toBe("9'800");
        expect(formatVolume(2.5)).toBe("2.5");
        expect(formatRate(42.1)).toBe("42.1");
        expect(formatRate(25)).toBe("25");
        expect(formatRate(3_600)).toBe("3'600");
        expect(formatRate(1_234.56)).toBe("1'234.6");
    });
});

describe("balanceSheetRows", () => {
    const rows = balanceSheetRows(SHEET);
    const row = (id: string) => rows.find((r) => r.id === id)!;

    it("lists the lines in statement order", () => {
        expect(rows.map((r) => r.id)).toEqual([
            "market",
            "sold",
            "bought",
            "dump",
            "om",
            "om-onshore_wind_turbine",
            "om-coal_burner",
            "om-coal_burner-fixed",
            "om-coal_burner-variable",
            "fuel",
            "operating",
            "investments",
            "investment-gas_burner",
            "net",
        ]);
    });

    it("shows energy as volume in MWh times an average rate", () => {
        const sold = row("sold").cell(SPRING);
        expect(sold.volume).toBeCloseTo(9_800);
        expect(sold.rate! * sold.volume!).toBeCloseTo(sold.amount!);
        expect(row("bought").cell(SPRING).amount).toBe(-20_010);
        expect(row("dump").cell(SPRING).rate).toBeCloseTo(25);
    });

    it("splits variable O&M into usage times the full variable cost", () => {
        const variable = row("om-coal_burner-variable").cell(SPRING);
        expect(variable.volume).toBeCloseTo(55);
        expect(variable.rate).toBe(3_600);
        expect(variable.amount).toBe(-(2_880 - 900));
        expect(rows.some((r) => r.id === "om-onshore_wind_turbine-fixed")).toBe(
            false,
        );
    });

    it("puts investments and net profit in the Round only", () => {
        expect(row("investments").cell(SPRING).amount).toBeNull();
        expect(row("investments").roundAmount).toBe(-90_000);
        expect(row("net").roundAmount).toBe(284_440);
    });
});

describe("waterfallSteps", () => {
    it("runs a season from market income down to operating income", () => {
        const steps = waterfallSteps(SPRING);
        expect(steps.map((s) => s.label)).toEqual([
            "Market income",
            "Dumping cost",
            "O&M",
            "Fuel cost",
            "Operating income",
        ]);
        expect(steps[2]).toMatchObject({
            from: 392_570 - 7_750,
            to: 392_570 - 7_750 - 10_380,
        });
        expect(steps[4]).toMatchObject({
            kind: "subtotal",
            from: 0,
            to: 374_440,
        });
    });

    it("takes the Round on to net profit, and scales a loss below zero", () => {
        const steps = waterfallSteps(SPRING, {
            investment_total: 500_000,
            net_profit: -125_560,
        });
        expect(steps.at(-1)).toMatchObject({
            label: "Net profit",
            to: -125_560,
        });
        const at = waterfallScale(steps);
        expect(at(-125_560)).toBe(0);
        expect(at(392_570)).toBe(100);
    });
});

describe("initialPeriod", () => {
    const settledUpTo = (count: number): BalanceSheet => ({
        ...SHEET,
        seasons: SHEET.seasons.map((season, i) => ({
            ...season,
            status: i < count ? "settled" : "upcoming",
            sheet: i < count ? SPRING : null,
        })),
    });

    it("opens the active Round on its last settled season", () => {
        expect(initialPeriod(settledUpTo(3), 1)).toBe("autumn");
    });

    it("opens the active Round on the Round while nothing is settled", () => {
        expect(initialPeriod(settledUpTo(0), 1)).toBe("round");
    });

    it("opens a past Round on the Round", () => {
        expect(initialPeriod(settledUpTo(4), 2)).toBe("round");
        expect(initialPeriod(settledUpTo(4), null)).toBe("round");
    });
});
