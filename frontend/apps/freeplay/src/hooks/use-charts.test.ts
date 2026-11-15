import { ApiClientError } from "@energetica/core/api-client";
import { createQueryClient } from "@energetica/core/query-client";
import { describe, expect, it } from "vitest";

import { buildChartQueryKey } from "@/lib/charts/query-keys";

import { claimStaleTickRejection, planChartFetches } from "./use-charts";

const config = { chartType: "revenues", resolution: 6 } as const;
// The window `computeRange` gives at tick 25153, resolution 6, 360 datapoints.
const range = { startTick: 22992, count: 360 };

describe("planChartFetches", () => {
    it("requests nothing while the tick is stale, and waits for it instead", () => {
        // #1484: the tab slept, the cache was emptied, and the socket is down.
        const plan = planChartFetches({
            queryClient: createQueryClient(),
            config,
            range,
            isTickFresh: false,
        });
        expect(plan.rangesToFetch).toEqual([]);
        expect(plan.isWaitingForTick).toBe(true);
    });

    it("requests the missing window once the tick is fresh", () => {
        const plan = planChartFetches({
            queryClient: createQueryClient(),
            config,
            range,
            isTickFresh: true,
        });
        expect(plan.rangesToFetch).toEqual([range]);
        expect(plan.isWaitingForTick).toBe(false);
    });
});

describe("claimStaleTickRejection", () => {
    const queryKey = buildChartQueryKey(config, range);

    it("reports a range the server rejected as a stale tick, once", () => {
        const reported = new Set<string>();
        const rejected = new ApiClientError("too old", 400);
        expect(
            claimStaleTickRejection({ error: rejected, queryKey, reported }),
        ).toBe(true);
        // After the tick is re-read, the same range may be requested again. If
        // it is rejected again, the error is real, not a stale tick.
        expect(
            claimStaleTickRejection({ error: rejected, queryKey, reported }),
        ).toBe(false);
    });
});
