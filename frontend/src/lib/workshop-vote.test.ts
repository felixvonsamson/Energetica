import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import { resultToAnnounce } from "./workshop-vote";

type WorkshopVote = ApiSchema<"WorkshopVoteOut">;

const spring = { kind: "trading_period", round: 2, season: "spring" } as const;
const vote = (overrides: Partial<WorkshopVote>): WorkshopVote => ({
    round: 2,
    held: true,
    tax_rate: 0.1,
    ballot: null,
    passed: true,
    ...overrides,
});

describe("resultToAnnounce", () => {
    it("announces a counted vote in its Round's Trading periods", () => {
        expect(resultToAnnounce(spring, vote({}), 1)).toBe(true);
        expect(resultToAnnounce(spring, vote({ passed: false }), 1)).toBe(true);
    });

    it("announces it once: not after the visitor has seen it", () => {
        expect(resultToAnnounce(spring, vote({}), 2)).toBe(false);
    });

    it("announces nothing before the vote is counted", () => {
        const investment = { kind: "investment", round: 2 } as const;
        expect(resultToAnnounce(investment, vote({ passed: null }), 1)).toBe(
            false,
        );
    });

    it("announces nothing in a Round that held no vote", () => {
        expect(
            resultToAnnounce(spring, vote({ held: false, passed: null }), 1),
        ).toBe(false);
    });

    it("waits for the vote of the Round the session is in", () => {
        // The vote is re-read after the session, so for a moment it can be
        // the last Round's.
        expect(resultToAnnounce(spring, vote({ round: 1 }), 0)).toBe(false);
    });

    it("announces nothing at the Recap", () => {
        expect(resultToAnnounce({ kind: "recap", round: 2 }, vote({}), 1)).toBe(
            false,
        );
    });
});
