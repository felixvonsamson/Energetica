import { describe, expect, it } from "vitest";

import {
    type BalanceSheet,
    type PeriodSheet,
    balanceSheetRows,
    financingLabel,
    formatAmount,
    formatRate,
    formatFuelVolume,
    formatVolume,
    initialPeriod,
    waterfallScale,
    waterfallSteps,
} from "./workshop-balance-sheet";

const SPRING: PeriodSheet = {
    energy_sold: 9_800e6,
    sale_revenue: 412_580,
    sold: [
        {
            facility: "onshore_wind_turbine",
            name: "Onshore wind turbine",
            energy: 3_800e6,
            amount: 152_580,
        },
        {
            facility: "coal_burner",
            name: "Coal burner",
            energy: 6_000e6,
            amount: 260_000,
        },
    ],
    energy_bought: 1_150e6,
    purchase_cost: 20_010,
    bought: [
        {
            facility: "lithium_ion_batteries",
            name: "Lithium-ion batteries",
            energy: 1_150e6,
            amount: 20_010,
        },
    ],
    market_income: 392_570,
    energy_dumped: 310e6,
    dump_cost: 7_750,
    dumped: [
        {
            facility: "onshore_wind_turbine",
            name: "Onshore wind turbine",
            energy: 310e6,
            amount: 7_750,
        },
    ],
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
        {
            facility: "lithium_ion_batteries",
            name: "Lithium-ion batteries",
            count: 1,
            om: 0,
            fixed: 0,
            variable_full: 0,
            usage: 0.2,
        },
    ],
    om_total: 10_380,
    fuel: [
        {
            fuel: "coal",
            name: "Coal",
            quantity: 8_000,
            price: 0.5,
            cost: 4_000,
        },
    ],
    fuel_total: 4_000,
    // The coal burner burned 6 t of the 8 t bought: 2 t went into stock.
    facility_fuel: [
        {
            facility: "coal_burner",
            name: "Coal burner",
            fuel: "coal",
            quantity: 6_000,
            cost: 3_000,
        },
    ],
    excess_fuel: [
        {
            fuel: "coal",
            name: "Coal",
            quantity: 2_000,
            price: 0.5,
            cost: 1_000,
        },
    ],
    revenue_tax: 0,
    taxable_revenue: 0,
    revenue_tax_rate: 0,
    operating_income: 370_440,
    construction_emissions: 0,
    construction_carbon_tax: 0,
    taxed_emissions: 0,
    emitted_carbon_tax: 0,
    carbon_tax_rate: 0,
    carbon_tax_share: 0,
    carbon_tax: 0,
};

const TAXED: PeriodSheet = {
    ...SPRING,
    revenue_tax: 28_880.6,
    taxable_revenue: 412_580,
    revenue_tax_rate: 0.07,
    operating_income: 370_440 - 28_880.6,
};

// A carbon tax at 0.1 per kg: 100 per tonne.
const CARBON: PeriodSheet = {
    ...SPRING,
    construction_emissions: 5_000,
    construction_carbon_tax: 500,
    taxed_emissions: 40_000,
    emitted_carbon_tax: 4_000,
    carbon_tax_rate: 0.1,
    carbon_tax_share: 3_000,
    carbon_tax: 1_500,
};

const SHEET: BalanceSheet = {
    round: 1,
    seasons: [
        {
            season: "spring",
            status: "settled",
            blackout_count: 0,
            sheet: SPRING,
        },
        {
            season: "summer",
            status: "upcoming",
            blackout_count: 0,
            sheet: null,
        },
        {
            season: "autumn",
            status: "upcoming",
            blackout_count: 0,
            sheet: null,
        },
        {
            season: "winter",
            status: "upcoming",
            blackout_count: 0,
            sheet: null,
        },
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
    blackout_cost_share: 0,
    blackout_cost: 0,
    net_profit: 280_440,
    financing: [],
    financing_total: 0,
};

describe("formats", () => {
    it("writes amounts in thousands from 10'000 up, with a real minus sign", () => {
        expect(formatAmount(392_570)).toBe("393k");
        expect(formatAmount(-7_750)).toBe("−7'750");
        expect(formatAmount(-2_100_000)).toBe("−2'100k");
        expect(formatAmount(-0.2)).toBe("0");
    });

    it("writes fuel in tonnes to the nearest kg below 10 t, so a few kg of uranium shows", () => {
        expect(formatFuelVolume(0.002)).toBe("0.002");
        expect(formatFuelVolume(2.5)).toBe("2.5");
        expect(formatFuelVolume(9.9996)).toBe("10");
        expect(formatFuelVolume(88_058.88)).toBe("88'059");
        expect(formatFuelVolume(0)).toBe("0");
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
    const rows = balanceSheetRows(SHEET, true);
    const row = (id: string) => rows.find((r) => r.id === id)!;
    const amount = (id: string, period: PeriodSheet = SPRING) =>
        row(id).cell(period).amount!;

    it("adds up the simple view by kind", () => {
        expect(balanceSheetRows(SHEET, false).map((r) => r.id)).toEqual([
            "market",
            "dump",
            "om",
            "fuel",
            "operating",
            "investments",
            "net",
        ]);
    });

    it("groups the detailed view by facility type, in statement order", () => {
        expect(rows.map((r) => r.id)).toEqual([
            "facility-onshore_wind_turbine",
            "onshore_wind_turbine-sold",
            "onshore_wind_turbine-dumped",
            "onshore_wind_turbine-om",
            "facility-coal_burner",
            "coal_burner-sold",
            "coal_burner-om",
            "coal_burner-om-fixed",
            "coal_burner-om-variable",
            "coal_burner-fuel",
            "facility-lithium_ion_batteries",
            "lithium_ion_batteries-bought",
            "lithium_ion_batteries-om",
            "excess-fuel",
            "excess-fuel-coal",
            "operating",
            "investments",
            "investment-gas_burner",
            "net",
        ]);
        expect(row("facility-onshore_wind_turbine").label).toBe(
            "Onshore wind turbine ×2",
        );
    });

    it("gives each facility type what it earned after its own costs", () => {
        expect(amount("facility-onshore_wind_turbine")).toBe(
            152_580 - 7_750 - 7_500,
        );
        expect(amount("facility-coal_burner")).toBe(260_000 - 2_880 - 3_000);
        expect(amount("facility-lithium_ion_batteries")).toBe(-20_010);
    });

    it("adds the facility types and the excess fuel up to the operating income", () => {
        const level0 = rows.slice(
            0,
            rows.findIndex((r) => r.id === "operating"),
        );
        const sum = level0
            .filter((r) => r.level === 0)
            .reduce((total, r) => total + r.cell(SPRING).amount!, 0);
        expect(sum).toBeCloseTo(SPRING.operating_income);
    });

    it("shows energy as volume in MWh times an average rate", () => {
        const sold = row("onshore_wind_turbine-sold").cell(SPRING);
        expect(sold.volume).toBeCloseTo(3_800);
        expect(sold.rate! * sold.volume!).toBeCloseTo(sold.amount!);
        expect(amount("lithium_ion_batteries-bought")).toBe(-20_010);
        const dumped = row("onshore_wind_turbine-dumped").cell(SPRING);
        expect(dumped.rate).toBeCloseTo(25);
        expect(dumped.amount).toBe(-7_750);
    });

    it("shows zero for a facility type a season did not sell from", () => {
        const summer = { ...SPRING, sold: SPRING.sold.slice(1) };
        expect(row("onshore_wind_turbine-sold").cell(summer)).toEqual({
            amount: 0,
        });
    });

    it("splits variable O&M into usage times the full variable cost", () => {
        const variable = row("coal_burner-om-variable").cell(SPRING);
        expect(variable.volume).toBeCloseTo(55);
        expect(variable.rate).toBe(3_600);
        expect(variable.amount).toBe(-(2_880 - 900));
        expect(rows.some((r) => r.id === "onshore_wind_turbine-om-fixed")).toBe(
            false,
        );
    });

    it("shows the fuel a facility type burned as tonnes times the price per tonne", () => {
        const coal = row("coal_burner-fuel");
        expect(coal).toMatchObject({ label: "Fuel (Coal)", unit: "fuel" });
        expect(coal.cell(SPRING)).toEqual({
            volume: 6,
            rate: 500,
            amount: -3_000,
        });
    });

    it("shows the fuel bought beyond what was burned as excess, by fuel", () => {
        expect(amount("excess-fuel")).toBe(-1_000);
        expect(row("excess-fuel-coal").cell(SPRING)).toEqual({
            volume: 2,
            rate: 500,
            amount: -1_000,
        });
        const summer = { ...SPRING, excess_fuel: [] };
        expect(row("excess-fuel").cell(summer).amount).toBe(-0);
        expect(row("excess-fuel-coal").cell(summer)).toEqual({ amount: 0 });
    });

    it("has no excess fuel row in a Round that burned all it bought", () => {
        const burnedAll = balanceSheetRows(
            { ...SHEET, total: { ...SPRING, excess_fuel: [] } },
            true,
        );
        expect(burnedAll.some((r) => r.id.startsWith("excess-fuel"))).toBe(
            false,
        );
    });

    it("adds up by kind in both views before any season is settled", () => {
        const unsettled = { ...SHEET, total: null };
        const aboveOperating = (detailed: boolean) => {
            const ids = balanceSheetRows(unsettled, detailed).map((r) => r.id);
            return ids.slice(0, ids.indexOf("operating"));
        };
        expect(aboveOperating(true)).toEqual(aboveOperating(false));
    });

    it("has no revenue tax line in a Round no disaster hit", () => {
        expect(rows.some((r) => r.id === "revenue-tax")).toBe(false);
    });

    it("shows a revenue tax above fuel, or after the facility types in detail", () => {
        const simple = balanceSheetRows({ ...SHEET, total: TAXED }, false);
        const ids = simple.map((r) => r.id);
        expect(ids.indexOf("revenue-tax")).toBe(ids.indexOf("fuel") - 1);
        const detailed = balanceSheetRows({ ...SHEET, total: TAXED }, true);
        const detailedIds = detailed.map((r) => r.id);
        expect(detailedIds.indexOf("revenue-tax")).toBe(
            detailedIds.indexOf("excess-fuel") - 1,
        );
        const tax = detailed.find((r) => r.id === "revenue-tax")!;
        expect(tax.unit).toBe("tax");
        expect(tax.cell(TAXED)).toEqual({
            volume: 412_580,
            rate: expect.closeTo(7),
            amount: -28_880.6,
        });
        expect(tax.cell(SPRING)).toEqual({ amount: 0 });
    });

    it("has no carbon tax lines before the tax is in force", () => {
        expect(rows.some((r) => r.id.startsWith("carbon-tax"))).toBe(false);
    });

    it("breaks a carbon tax down below operating income", () => {
        const taxed = balanceSheetRows({ ...SHEET, total: CARBON }, true);
        const ids = taxed.map((r) => r.id);
        expect(
            ids.slice(ids.indexOf("operating"), ids.indexOf("investments")),
        ).toEqual([
            "operating",
            "carbon-tax",
            "carbon-tax-construction",
            "carbon-tax-emitted",
            "carbon-tax-share",
        ]);
        const cell = (id: string, period: PeriodSheet) =>
            taxed.find((r) => r.id === id)!.cell(period);
        expect(cell("carbon-tax", CARBON).amount).toBe(-1_500);
        expect(cell("carbon-tax-construction", CARBON)).toEqual({
            volume: 5,
            rate: 100,
            amount: -500,
        });
        expect(cell("carbon-tax-emitted", CARBON)).toEqual({
            volume: 40,
            rate: 100,
            amount: -4_000,
        });
        expect(cell("carbon-tax-share", CARBON).amount).toBe(3_000);
    });

    it("leaves the construction tax empty in the seasons that do not charge it", () => {
        const taxed = balanceSheetRows({ ...SHEET, total: CARBON }, true);
        const summer = {
            ...CARBON,
            construction_emissions: 0,
            construction_carbon_tax: 0,
        };
        expect(
            taxed.find((r) => r.id === "carbon-tax-construction")!.cell(summer),
        ).toEqual({ amount: null });
    });

    it("puts investments and net profit in the Round only", () => {
        expect(row("investments").cell(SPRING).amount).toBeNull();
        expect(row("investments").roundAmount).toBe(-90_000);
        expect(row("net").roundAmount).toBe(280_440);
    });

    it("has no blackout cost line in a Round the grid held", () => {
        expect(rows.some((r) => r.id === "blackout-cost")).toBe(false);
    });

    it("shows the blackout cost below operating income, in the Round only", () => {
        const blackedOut = balanceSheetRows(
            { ...SHEET, blackout_cost_share: 0.6, blackout_cost: 222_264 },
            true,
        );
        const ids = blackedOut.map((r) => r.id);
        expect(
            ids.slice(ids.indexOf("operating"), ids.indexOf("operating") + 3),
        ).toEqual(["operating", "blackout-cost", "investments"]);
        const cost = blackedOut.find((r) => r.id === "blackout-cost")!;
        expect(cost.label).toBe(
            "Blackout cost (60% of operating income so far)",
        );
        const final = balanceSheetRows(
            {
                ...SHEET,
                seasons: SHEET.seasons.map((s) => ({
                    ...s,
                    status: "settled",
                })),
                blackout_cost_share: 0.6,
                blackout_cost: 222_264,
            },
            true,
        );
        expect(final.find((r) => r.id === "blackout-cost")!.label).toBe(
            "Blackout cost (60% of operating income)",
        );
        expect(cost.roundAmount).toBe(-222_264);
        expect(cost.cell(SPRING).amount).toBeNull();
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
        expect(steps[3]).toMatchObject({
            kind: "change",
            value: -4_000,
            to: 370_440,
        });
        expect(steps[2]).toMatchObject({
            from: 392_570 - 7_750,
            to: 392_570 - 7_750 - 10_380,
        });
        expect(steps[4]).toMatchObject({
            kind: "subtotal",
            from: 0,
            to: 370_440,
        });
    });

    it("takes a revenue tax off before fuel", () => {
        const steps = waterfallSteps(TAXED);
        expect(steps.map((s) => s.label)).toEqual([
            "Market income",
            "Dumping cost",
            "O&M",
            "Revenue tax",
            "Fuel cost",
            "Operating income",
        ]);
        expect(steps[4]).toMatchObject({ to: 370_440 - 28_880.6 });
    });

    it("takes a season on to its result after the carbon tax", () => {
        const steps = waterfallSteps(CARBON);
        expect(steps.slice(-3)).toEqual([
            expect.objectContaining({ label: "Operating income", to: 370_440 }),
            expect.objectContaining({ label: "Carbon tax", value: -1_500 }),
            expect.objectContaining({
                label: "Season result",
                kind: "subtotal",
                to: 370_440 - 1_500,
            }),
        ]);
    });

    it("takes the Round's carbon tax off before its investments", () => {
        const steps = waterfallSteps(CARBON, {
            investment_total: 90_000,
            blackout_cost: 0,
            net_profit: 370_440 - 1_500 - 90_000,
        });
        expect(steps.slice(-3).map((s) => s.label)).toEqual([
            "Carbon tax",
            "Investments",
            "Net profit",
        ]);
    });

    it("takes the Round's blackout cost off before its investments", () => {
        const steps = waterfallSteps(SPRING, {
            investment_total: 90_000,
            blackout_cost: 222_264,
            net_profit: 370_440 - 222_264 - 90_000,
        });
        expect(steps.slice(-3)).toEqual([
            expect.objectContaining({
                label: "Blackout cost",
                value: -222_264,
            }),
            expect.objectContaining({ label: "Investments" }),
            expect.objectContaining({ label: "Net profit" }),
        ]);
    });

    it("takes the Round on to net profit, and scales a loss below zero", () => {
        const steps = waterfallSteps(SPRING, {
            investment_total: 500_000,
            blackout_cost: 0,
            net_profit: -129_560,
        });
        expect(steps.at(-1)).toMatchObject({
            label: "Net profit",
            to: -129_560,
        });
        const at = waterfallScale(steps);
        expect(at(-129_560)).toBe(0);
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

describe("financing", () => {
    const withLoan: BalanceSheet = {
        ...SHEET,
        financing: [
            {
                kind: "loan",
                amount: 1_000_000,
                payment: null,
                payment_count: 2,
                at_session_end: false,
            },
            {
                kind: "loan_payment",
                amount: -600_000,
                payment: 2,
                payment_count: 2,
                at_session_end: true,
            },
        ],
        financing_total: 400_000,
    };

    it("shows the loan below net profit, in the Round only", () => {
        const ids = balanceSheetRows(withLoan, true).map((r) => r.id);
        expect(ids.slice(ids.indexOf("net"))).toEqual([
            "net",
            "financing",
            "financing-0",
            "financing-1",
        ]);
        const financing = balanceSheetRows(withLoan, true).find(
            (r) => r.id === "financing",
        )!;
        expect(financing.roundAmount).toBe(400_000);
        expect(financing.cell(SPRING).amount).toBeNull();
    });

    it("names the loan and each payment", () => {
        expect(withLoan.financing.map(financingLabel)).toEqual([
            "Loan",
            "Loan payment 2 of 2 (session end)",
        ]);
    });

    it("has no financing rows without a loan", () => {
        expect(
            balanceSheetRows(SHEET, true).some((r) => r.id === "financing"),
        ).toBe(false);
    });
});
