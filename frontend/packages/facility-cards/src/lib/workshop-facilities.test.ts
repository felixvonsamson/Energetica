import { describe, expect, it } from "vitest";

import {
    constructionLagLabel,
    formatCatalogPrice,
    formatFuelUse,
    roundsLabel,
} from "#facility-cards/lib/workshop-facilities";

describe("formatCatalogPrice", () => {
    it("shows a whole number of millions without decimals", () => {
        expect(formatCatalogPrice(8_000_000)).toBe("8M");
        expect(formatCatalogPrice(130_000_000)).toBe("130M");
    });

    it("keeps one decimal for a price between whole millions", () => {
        expect(formatCatalogPrice(7_500_000)).toBe("7.5M");
        expect(formatCatalogPrice(8_625_000)).toBe("8.6M");
    });

    it("shows a price under a million in millions too", () => {
        expect(formatCatalogPrice(500_000)).toBe("0.5M");
    });

    it("separates thousands of millions", () => {
        expect(formatCatalogPrice(1_200_000_000)).toBe("1'200M");
    });
});

describe("formatFuelUse", () => {
    it("always shows kg/MWh, however small the value", () => {
        expect(formatFuelUse(640)).toBe("640 kg/MWh");
        expect(formatFuelUse(0.044)).toBe("0.044 kg/MWh");
        expect(formatFuelUse(0.000_57)).toBe("0.00057 kg/MWh");
    });
});

describe("roundsLabel", () => {
    it("says Round for one and Rounds for more", () => {
        expect(roundsLabel(1)).toBe("1 Round");
        expect(roundsLabel(3)).toBe("3 Rounds");
    });
});

describe("constructionLagLabel", () => {
    it("says nothing for a facility that works in the Round it is built in", () => {
        expect(constructionLagLabel(0)).toBeNull();
    });

    it("says how many Rounds a facility needs to build", () => {
        expect(constructionLagLabel(1)).toBe("Needs 1 Round to build");
        expect(constructionLagLabel(2)).toBe("Needs 2 Rounds to build");
    });
});
