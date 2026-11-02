import { describe, expect, it } from "vitest";

import {
    constructionLagLabel,
    constructionLagWarning,
    fleetStacks,
    lifetimeRangeLabel,
} from "./workshop-fleet";

const wind = (built_round: number, rounds_left: number) => ({
    facility: "onshore_wind_turbine" as const,
    built_round,
    rounds_left,
    under_construction: false,
});

describe("fleetStacks", () => {
    it("stacks the copies of each facility together", () => {
        const dam = {
            facility: "small_water_dam" as const,
            built_round: 1,
            rounds_left: 7,
            under_construction: false,
        };

        const stacks = fleetStacks([wind(1, 1), dam, wind(2, 2)]);

        expect(stacks.map((stack) => stack.facility)).toEqual([
            "onshore_wind_turbine",
            "small_water_dam",
        ]);
        expect(stacks[0]!.copies).toHaveLength(2);
        expect(stacks[1]!.copies).toEqual([dam]);
    });

    it("puts the copy with the most lifetime left on top", () => {
        const stacks = fleetStacks([wind(1, 1), wind(3, 2), wind(2, 1)]);

        expect(stacks[0]!.copies.map((copy) => copy.rounds_left)).toEqual([
            2, 1, 1,
        ]);
    });

    it("has no stacks for an empty fleet", () => {
        expect(fleetStacks([])).toEqual([]);
    });
});

describe("lifetimeRangeLabel", () => {
    it("shows the longest and shortest lifetime left in a stack", () => {
        expect(lifetimeRangeLabel([wind(3, 2), wind(2, 1)])).toBe("2–1 Rounds");
    });

    it("shows one figure when every copy has the same lifetime left", () => {
        expect(lifetimeRangeLabel([wind(2, 2), wind(2, 2)])).toBe("2 Rounds");
        expect(lifetimeRangeLabel([wind(2, 1)])).toBe("1 Round");
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

describe("constructionLagWarning", () => {
    it("says a facility built in one Round produces nothing this year", () => {
        expect(constructionLagWarning("Nuclear reactor", 1)).toBe(
            "A nuclear reactor needs 1 Round, one year, to build. If you buy it now, it will not produce any power this Round. It starts working next Round.",
        );
    });

    it("counts the Rounds of a longer build", () => {
        expect(constructionLagWarning("Gen-IV nuclear reactor", 2)).toBe(
            "A Gen-IV nuclear reactor needs 2 Rounds, 2 years, to build. If you buy it now, it will not produce any power this Round or the next. It starts working in 2 Rounds.",
        );
    });
});
