import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import { carriedNote, carriedRounds, consoleRound } from "./workshop-console";

type RoundPlan = ApiSchema<"WorkshopRoundPlanOut">;

function plan(round: number, overrides: Partial<RoundPlan> = {}): RoundPlan {
    return {
        round,
        locked: false,
        levers: {
            round_format: {
                trading_format: "representative_week",
                clearings_per_day: 24,
                storage: "batteries",
            },
            fuel_procurement: "automatic",
            carbon_tax_vote: false,
        },
        events: [],
        ...overrides,
    };
}

function plans(lockedRounds: number, roundCount: number) {
    return {
        rounds: Array.from({ length: roundCount }, (_, index) =>
            plan(index + 1, { locked: index < lockedRounds }),
        ),
    };
}

describe("consoleRound", () => {
    it("opens on the Round after the one being played", () => {
        // During Round 2, Rounds 1 and 2 are locked.
        expect(consoleRound(plans(2, 5))).toBe(3);
    });

    it("opens on the Round two ahead from a Recap", () => {
        // From Recap 2, Round 3 is locked too.
        expect(consoleRound(plans(3, 5))).toBe(4);
    });

    it("opens on the last Round once every Round is locked", () => {
        expect(consoleRound(plans(5, 5))).toBe(5);
    });
});

describe("carriedRounds", () => {
    const fullSeason = (round: number) =>
        plan(round, {
            levers: {
                ...plan(round).levers,
                round_format: {
                    ...plan(round).levers.round_format,
                    trading_format: "full_season",
                },
            },
        });

    it("lists each later Round whose levers the change also changed", () => {
        const before = { rounds: [1, 2, 3, 4, 5].map((r) => plan(r)) };
        const after = {
            rounds: [
                plan(1),
                plan(2),
                fullSeason(3),
                fullSeason(4),
                fullSeason(5),
            ],
        };

        expect(carriedRounds(before, after, 3)).toEqual([4, 5]);
    });

    it("leaves out a later Round that already held the new value", () => {
        const before = {
            rounds: [plan(1), plan(2), fullSeason(3), plan(4)],
        };
        const after = {
            rounds: [plan(1), fullSeason(2), fullSeason(3), fullSeason(4)],
        };

        expect(carriedRounds(before, after, 2)).toEqual([4]);
    });

    it("is empty when only the Round itself changed", () => {
        const before = { rounds: [plan(1), plan(2)] };
        const after = { rounds: [plan(1), fullSeason(2)] };

        expect(carriedRounds(before, after, 2)).toEqual([]);
    });
});

describe("carriedNote", () => {
    it("names a single Round", () => {
        expect(carriedNote([4])).toBe("Also applied to Round 4.");
    });

    it("joins consecutive Rounds into a range", () => {
        expect(carriedNote([4, 5, 6])).toBe("Also applied to Rounds 4–6.");
    });

    it("lists Rounds that are not consecutive", () => {
        expect(carriedNote([3, 5, 6])).toBe("Also applied to Rounds 3, 5–6.");
        expect(carriedNote([3, 5])).toBe("Also applied to Rounds 3, 5.");
    });

    it("says nothing when no other Round changed", () => {
        expect(carriedNote([])).toBeNull();
    });
});
