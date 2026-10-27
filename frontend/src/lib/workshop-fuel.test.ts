import { describe, expect, it } from "vitest";

import {
    formatFuelAmount,
    formatPriceChange,
    fieldPrice,
    fuelFieldText,
    fuelFieldUnit,
    shownQuantity,
    isOverStockpile,
    orderCost,
    parseFuelQuantity,
    stockpileSeasons,
} from "./workshop-fuel";

describe("fuelFieldUnit", () => {
    it("counts gas and coal in kilotonnes and uranium in kg", () => {
        expect(fuelFieldUnit("gas")).toBe("kt");
        expect(fuelFieldUnit("coal")).toBe("kt");
        expect(fuelFieldUnit("uranium")).toBe("kg");
    });
});

describe("parseFuelQuantity", () => {
    it("reads kilotonnes of gas and coal as kg", () => {
        expect(parseFuelQuantity("12.5", "gas")).toEqual({
            ok: true,
            kg: 12_500_000,
        });
        expect(parseFuelQuantity("0.25", "coal")).toEqual({
            ok: true,
            kg: 250_000,
        });
        expect(parseFuelQuantity(" 0 ", "coal")).toEqual({ ok: true, kg: 0 });
    });

    it("reads uranium in kg, to the nearest kg", () => {
        expect(parseFuelQuantity("12.4", "uranium")).toEqual({
            ok: true,
            kg: 12,
        });
    });

    it("ignores thousands separators, as an apostrophe or a space", () => {
        expect(parseFuelQuantity("88'059", "uranium")).toEqual({
            ok: true,
            kg: 88_059,
        });
        expect(parseFuelQuantity("1 234.5", "gas")).toEqual({
            ok: true,
            kg: 1_234_500_000,
        });
    });

    it("refuses an empty field, a negative quantity and text", () => {
        expect(parseFuelQuantity("", "gas")).toEqual({
            ok: false,
            reason: "empty",
        });
        expect(parseFuelQuantity("-1", "gas")).toEqual({
            ok: false,
            reason: "negative",
        });
        expect(parseFuelQuantity("lots", "coal")).toEqual({
            ok: false,
            reason: "invalid",
        });
        expect(parseFuelQuantity("Infinity", "uranium")).toEqual({
            ok: false,
            reason: "invalid",
        });
    });
});

describe("fuelFieldText", () => {
    it("shows gas and coal as kilotonnes to the nearest tonne, without trailing zeros", () => {
        expect(fuelFieldText(417_200.4, "gas")).toBe("0.417");
        expect(fuelFieldText(2_000_000, "coal")).toBe("2");
        expect(fuelFieldText(0, "gas")).toBe("0");
    });

    it("shows uranium in kg to the nearest kg", () => {
        expect(fuelFieldText(417.2, "uranium")).toBe("417");
        expect(fuelFieldText(2_000, "uranium")).toBe("2'000");
    });

    it("separates thousands with an apostrophe", () => {
        expect(fuelFieldText(50_888_784_400, "gas")).toBe("50'888.784");
        expect(fuelFieldText(88_059, "uranium")).toBe("88'059");
        expect(fuelFieldText(1_234_567_000_000, "coal")).toBe("1'234'567");
    });

    it("reads back as the quantity it shows", () => {
        const text = fuelFieldText(88_059_000, "coal");
        expect(text).toBe("88.059");
        expect(parseFuelQuantity(text, "coal")).toEqual({
            ok: true,
            kg: 88_059_000,
        });
    });
});

describe("shownQuantity", () => {
    it("rounds kg to what the field shows, so retyping it changes nothing", () => {
        expect(shownQuantity(12_345_678.9, "gas")).toBe(12_346_000);
        expect(shownQuantity(417.2, "uranium")).toBe(417);
    });
});

describe("fieldPrice", () => {
    it("is the price per unit of the order field", () => {
        expect(fieldPrice({ fuel: "gas", price: 0.08 })).toBeCloseTo(80_000);
        expect(fieldPrice({ fuel: "uranium", price: 250 })).toBe(250);
    });
});

describe("formatFuelAmount", () => {
    it("always shows gas and coal in kilotonnes and uranium in kg", () => {
        expect(formatFuelAmount(34_000, "coal")).toBe("0.03 kt");
        expect(formatFuelAmount(34_000_000_000, "gas")).toBe("34'000 kt");
        expect(formatFuelAmount(34_000, "uranium")).toBe("34'000 kg");
    });

    it("gives smaller numbers more decimals", () => {
        expect(formatFuelAmount(3_456_000, "coal")).toBe("3.46 kt");
        expect(formatFuelAmount(34_560_000, "coal")).toBe("34.6 kt");
        expect(formatFuelAmount(345_600_000, "coal")).toBe("346 kt");
        expect(formatFuelAmount(4.172, "uranium")).toBe("4.17 kg");
        expect(formatFuelAmount(417.2, "uranium")).toBe("417 kg");
    });

    it("shows nothing as a plain zero", () => {
        expect(formatFuelAmount(0, "gas")).toBe("0 kt");
        expect(formatFuelAmount(0, "uranium")).toBe("0 kg");
    });
});

describe("stockpileSeasons", () => {
    it("is the stockpile limit as a number of season needs", () => {
        expect(
            stockpileSeasons({ season_need: 50, stockpile_limit: 150 }),
        ).toBe(3);
        expect(stockpileSeasons({ season_need: 0, stockpile_limit: 0 })).toBe(
            0,
        );
    });
});

describe("formatPriceChange", () => {
    it("shows the change since last season as a signed percentage", () => {
        expect(formatPriceChange(0.15)).toBe("+15%");
        expect(formatPriceChange(-0.084)).toBe("−8%");
        expect(formatPriceChange(0.001)).toBe("0%");
    });

    it("shows nothing in the first season", () => {
        expect(formatPriceChange(null)).toBeNull();
    });
});

describe("isOverStockpile", () => {
    const line = { stock: 100_000, stockpile_limit: 300_000 };

    it("is true when the order would take the stock over the limit", () => {
        expect(isOverStockpile(200_001, line)).toBe(true);
    });

    it("is false up to the limit", () => {
        expect(isOverStockpile(200_000, line)).toBe(false);
        expect(isOverStockpile(0, line)).toBe(false);
    });

    it("is true for any order once the stock is over the limit", () => {
        expect(
            isOverStockpile(1, { stock: 400_000, stockpile_limit: 300_000 }),
        ).toBe(true);
    });
});

describe("orderCost", () => {
    const line = { price: 0.06, stock: 100_000, stockpile_limit: 300_000 };

    it("is the quantity at the season's price per kg", () => {
        expect(orderCost(50_000, line)).toBeCloseTo(3_000);
        expect(orderCost(0, line)).toBe(0);
    });

    it("counts only what fits under the stockpile limit, as the server cuts the order down", () => {
        expect(orderCost(500_000, line)).toBeCloseTo(12_000);
        expect(
            orderCost(1, {
                price: 0.06,
                stock: 400_000,
                stockpile_limit: 300_000,
            }),
        ).toBe(0);
    });
});
