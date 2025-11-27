/**
 * API client for chart data endpoints.
 */

import { apiClient } from "./api-client";
import type { ApiResponse } from "@/types/api-helpers";
import { Resolution } from "../types/charts";

interface ChartParams {
    resolution: Resolution;
    start_tick: number;
    count: number;
}

export const chartsApi = {
    /**
     * Get power sources chart data (generation and imports over time).
     */
    getPowerSources: async ({ resolution, start_tick, count }: ChartParams) => {
        const response = await apiClient.get<
            ApiResponse<"/api/v1/charts/power-sources/{resolution}", "get">
        >(`/charts/power-sources/${resolution}`, {
            params: { start_tick, count },
        });

        // Debug: Log what we actually received
        const seriesLengths = Object.entries(response.series || {}).map(
            ([name, values]) => `${name}: ${(values as any[]).length}`,
        );
        console.log("[API Response] Power sources returned:", {
            requested: { start_tick, count },
            received: {
                seriesCount: Object.keys(response.series || {}).length,
                seriesLengths: seriesLengths.slice(0, 3),
                firstSeriesLength: seriesLengths[0]
                    ? (
                          response.series[
                              Object.keys(response.series)[0]
                          ] as any[]
                      ).length
                    : 0,
            },
        });

        return response;
    },
};
