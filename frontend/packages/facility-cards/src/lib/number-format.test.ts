import { describe, expect, it } from "vitest";

import { formatRate, formatVolume } from "#facility-cards/lib/number-format";

describe("formats", () => {
    it("writes volumes whole and rates with one decimal unless whole", () => {
        expect(formatVolume(9_800.4)).toBe("9'800");
        expect(formatVolume(2.5)).toBe("2.5");
        expect(formatRate(42.1)).toBe("42.1");
        expect(formatRate(25)).toBe("25");
        expect(formatRate(3_600)).toBe("3'600");
        expect(formatRate(1_234.56)).toBe("1'234.6");
    });
});
