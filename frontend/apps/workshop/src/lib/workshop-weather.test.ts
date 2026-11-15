import { describe, expect, it } from "vitest";

import { weatherLine } from "./workshop-weather";

describe("weatherLine", () => {
    it("tells wind and sunshine against a normal season", () => {
        expect(weatherLine({ wind: 0.08, solar: -0.03 })).toBe(
            "Wind 8% above normal, sunshine 3% below.",
        );
    });

    it("rounds to whole percentages", () => {
        expect(weatherLine({ wind: -0.124, solar: 0.016 })).toBe(
            "Wind 12% below normal, sunshine 2% above.",
        );
    });

    it("calls a change that rounds to nothing normal", () => {
        expect(weatherLine({ wind: 0.004, solar: 0.05 })).toBe(
            "Wind normal, sunshine 5% above normal.",
        );
        expect(weatherLine({ wind: 0.05, solar: -0.004 })).toBe(
            "Wind 5% above normal, sunshine normal.",
        );
        expect(weatherLine({ wind: 0, solar: 0 })).toBe(
            "Wind and sunshine normal.",
        );
    });
});
