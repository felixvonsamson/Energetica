import { describe, expect, it } from "vitest";

import { nextBuyRound } from "./workshop-metrics";

describe("nextBuyRound", () => {
    it("is the current Round while its Investment phase is open", () => {
        expect(nextBuyRound({ kind: "investment", round: 2 }, 4)).toBe(2);
    });

    it("is the next Round once the Investment phase has closed", () => {
        expect(
            nextBuyRound(
                { kind: "trading_period", round: 2, season: "spring" },
                4,
            ),
        ).toBe(3);
        expect(nextBuyRound({ kind: "recap", round: 2 }, 4)).toBe(3);
    });

    it("is Round 1 before the session starts", () => {
        expect(nextBuyRound({ kind: "not_started" }, 4)).toBe(1);
    });

    it("is null once no Round is left to buy in", () => {
        expect(nextBuyRound({ kind: "recap", round: 4 }, 4)).toBeNull();
        expect(nextBuyRound({ kind: "finished" }, 4)).toBeNull();
    });
});
