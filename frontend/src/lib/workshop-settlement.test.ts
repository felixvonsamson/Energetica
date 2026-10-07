import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import { settlementLabel, withSettlementProgress } from "./workshop-settlement";

type WorkshopSession = ApiSchema<"WorkshopSessionOut">;

const SESSION: WorkshopSession = {
    checkpoint: { kind: "trading_period", round: 1, season: "spring" },
    next_checkpoint: { kind: "trading_period", round: 1, season: "summer" },
    round_count: 3,
    phase_timer: { remaining_seconds: 0 },
    players: [],
    round_format: {
        trading_format: "full_season",
        clearings_per_day: 288,
        storage: "all",
    },
    settlement: { days_done: 3, days_total: 91 },
};

describe("withSettlementProgress", () => {
    it("puts the new progress into the session and keeps the rest", () => {
        const updated = withSettlementProgress(SESSION, {
            days_done: 4,
            days_total: 91,
        });

        expect(updated).toEqual({
            ...SESSION,
            settlement: { days_done: 4, days_total: 91 },
        });
    });

    it("shows a run the cached session has not heard of yet", () => {
        const updated = withSettlementProgress(
            { ...SESSION, settlement: null },
            { days_done: 1, days_total: 91 },
        );

        expect(updated?.settlement).toEqual({ days_done: 1, days_total: 91 });
    });

    it("never moves the bar back within the same run", () => {
        expect(
            withSettlementProgress(SESSION, { days_done: 2, days_total: 91 }),
        ).toBe(SESSION);
    });

    it("leaves a session that has not loaded yet alone", () => {
        expect(
            withSettlementProgress(undefined, { days_done: 1, days_total: 1 }),
        ).toBeUndefined();
    });
});

describe("settlementLabel", () => {
    it("counts the days of a full season", () => {
        expect(settlementLabel({ days_done: 12, days_total: 91 })).toBe(
            "Simulating the season: day 12 of 91",
        );
    });

    it("names a representative day without counting it", () => {
        expect(settlementLabel({ days_done: 0, days_total: 1 })).toBe(
            "Simulating the representative day",
        );
    });
});
