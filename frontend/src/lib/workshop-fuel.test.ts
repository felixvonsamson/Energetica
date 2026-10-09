import { describe, expect, it } from "vitest";

import {
    formatPriceChange,
    isOverStockpile,
    parseTonnes,
    stockpileSeasons,
    tonnesFieldText,
} from "./workshop-fuel";

describe("parseTonnes", () => {
    it("reads tonnes typed into the field as kg", () => {
        expect(parseTonnes("12.5")).toEqual({ ok: true, kg: 12_500 });
        expect(parseTonnes(" 0 ")).toEqual({ ok: true, kg: 0 });
    });

    it("refuses an empty field, a negative quantity and text", () => {
        expect(parseTonnes("")).toEqual({ ok: false, reason: "empty" });
        expect(parseTonnes("-1")).toEqual({ ok: false, reason: "negative" });
        expect(parseTonnes("lots")).toEqual({ ok: false, reason: "invalid" });
        expect(parseTonnes("Infinity")).toEqual({
            ok: false,
            reason: "invalid",
        });
    });
});

describe("tonnesFieldText", () => {
    it("shows kg as tonnes to the nearest kg, without trailing zeros", () => {
        expect(tonnesFieldText(50_888_784.4)).toBe("50888.784");
        expect(tonnesFieldText(417.2)).toBe("0.417");
        expect(tonnesFieldText(2_000)).toBe("2");
        expect(tonnesFieldText(0)).toBe("0");
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
