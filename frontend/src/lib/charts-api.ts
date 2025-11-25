/**
 * API client for chart data endpoints.
 */

import { apiClient } from "./api-client";
import type { ApiResponse } from "@/types/api-helpers";

type Resolution = "1" | "6" | "36" | "216" | "1296";

interface ChartParams {
    resolution: Resolution;
    start_tick: number;
    count: number;
}

export const chartsApi = {
    /**
     * Get power sources chart data (generation and imports over time).
     */
    getPowerSources: ({ resolution, start_tick, count }: ChartParams) =>
        apiClient.get<
            ApiResponse<"/api/v1/charts/power-sources/{resolution}", "get">
        >(`/charts/power-sources/${resolution}`, {
            params: { start_tick, count },
        }),

    /**
     * Get power sinks chart data (demand by category over time).
     */
    getPowerSinks: ({ resolution, start_tick, count }: ChartParams) =>
        apiClient.get<
            ApiResponse<"/api/v1/charts/power-sinks/{resolution}", "get">
        >(`/charts/power-sinks/${resolution}`, {
            params: { start_tick, count },
        }),
};
