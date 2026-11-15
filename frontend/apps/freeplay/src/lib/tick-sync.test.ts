import { describe, expect, it } from "vitest";

import { INITIAL_TICK_SYNC, tickSyncReducer } from "./tick-sync";

describe("tickSyncReducer", () => {
    it("stays stale after a disconnect until the tick is re-read", () => {
        const live = tickSyncReducer(INITIAL_TICK_SYNC, {
            type: "tick",
            tick: 25153,
        });
        const asleep = tickSyncReducer(live, { type: "stale" });
        expect(asleep).toEqual({ tick: 25153, isFresh: false });

        const awake = tickSyncReducer(asleep, {
            type: "resynced",
            tick: 25205,
        });
        expect(awake).toEqual({ tick: 25205, isFresh: true });
    });

    it("keeps a newer socket tick when a slower re-read returns an older one", () => {
        const afterSocketTick = tickSyncReducer(
            { tick: 25204, isFresh: false },
            { type: "tick", tick: 25206 },
        );
        const afterLateResync = tickSyncReducer(afterSocketTick, {
            type: "resynced",
            tick: 25205,
        });
        expect(afterLateResync).toEqual({ tick: 25206, isFresh: true });
    });
});
