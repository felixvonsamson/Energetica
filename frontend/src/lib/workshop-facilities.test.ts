import { describe, expect, it } from "vitest";

import { formatCatalogPrice, formatFuelUse } from "./workshop-facilities";

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
