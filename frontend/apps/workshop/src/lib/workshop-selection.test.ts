import { describe, expect, it } from "vitest";

import { overlapMargin, selectionStacks } from "./workshop-selection";

describe("selectionStacks", () => {
    it("stacks the copies of each facility together, in the order each was first picked", () => {
        const stacks = selectionStacks([
            "onshore_wind_turbine",
            "small_water_dam",
            "onshore_wind_turbine",
            "onshore_wind_turbine",
        ]);

        expect(stacks).toEqual([
            { facility: "onshore_wind_turbine", count: 3 },
            { facility: "small_water_dam", count: 1 },
        ]);
    });

    it("has no stacks for an empty selection", () => {
        expect(selectionStacks([])).toEqual([]);
    });
});

describe("overlapMargin", () => {
    it("leaves a gap while every stack fits side by side", () => {
        expect(overlapMargin([100, 120], 300, 10)).toBe(10);
    });

    it("overlaps the stacks just enough to fit the row", () => {
        // 3 stacks of 100 in a row of 240: each of the 2 margins takes back 30.
        expect(overlapMargin([100, 100, 100], 240, 10)).toBe(-30);
    });

    it("never makes the row wider than it is", () => {
        expect(overlapMargin([100, 100, 120], 160, 10)).toBe(-80);
    });

    it("never overlaps a single stack", () => {
        expect(overlapMargin([100], 50, 10)).toBe(10);
    });
});
