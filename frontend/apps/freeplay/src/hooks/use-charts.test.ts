import { ApiClientError } from "@energetica/core/api-client";
import { createQueryClient } from "@energetica/core/query-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildChartQueryKey } from "@/lib/charts/query-keys";

import {
    claimStaleTickRejection,
    computeRange,
    planChartFetches,
} from "./use-charts";

const config = { chartType: "revenues", resolution: 6 } as const;
const range = { startTick: 22992, count: 360 };

describe("planChartFetches", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("requests nothing after the tab slept with the socket down (#1484)", async () => {
        const queryClient = createQueryClient();
        const window = (currentTick: number) =>
            computeRange({ currentTick, resolution: 6, maxDatapoints: 360 });

        // Page load at tick 25147: the whole window is fetched and cached.
        await queryClient.fetchQuery({
            queryKey: buildChartQueryKey(config, window(25147)),
            queryFn: async () => ({ series: {} }),
        });

        // The socket drops at tick 25153 and the tab sleeps for 12 minutes.
        // The query client's cleanup empties the cache meanwhile.
        vi.advanceTimersByTime(12 * 60 * 1000);
        const range = window(25153);

        // Built from the stale tick, the request is the one the server
        // rejected in production: start_tick=22992&count=360.
        expect(
            planChartFetches({ queryClient, config, range, isTickFresh: true })
                .rangesToFetch,
        ).toEqual([{ startTick: 22992, count: 360 }]);

        // So while the tick is stale, nothing is requested.
        expect(
            planChartFetches({
                queryClient,
                config,
                range,
                isTickFresh: false,
            }),
        ).toEqual({ rangesToFetch: [], isWaitingForTick: true });
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
