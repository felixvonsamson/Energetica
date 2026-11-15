import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-client";

// The keys the backend names in its `invalidate` messages, in
// src/energetica/workshop/realtime.py. A query is re-read when one of them is a
// prefix of its key.
describe("the query keys the Workshop's backend invalidates", () => {
    it("match the session's key", () => {
        expect(queryKeys.workshop.session).toEqual(["workshop", "session"]);
    });

    it("match the market prices' key", () => {
        expect(queryKeys.workshop.marketPrices).toEqual([
            "workshop",
            "session",
            "market-prices",
        ]);
    });

    it("match the control room's key", () => {
        expect(queryKeys.workshop.controlRoom).toEqual([
            "workshop",
            "session",
            "control-room",
        ]);
    });
});
