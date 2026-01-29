/** API client for chart data endpoints. */

import { apiClient } from "@/lib/api-client";
import { ChartIdentifier } from "@/lib/charts/query-keys";
import type { ApiResponse } from "@/types/api-helpers";
import { Resolution, TickRange } from "@/types/charts";

export const chartsApi = {
    /** Get chart data */
    getChartData: async ({
        identifier,
        resolution,
        range,
    }: {
        identifier: ChartIdentifier;
        resolution: Resolution;
        range: TickRange;
    }) => {
        const params = { start_tick: range.startTick, count: range.count };

        // TypeScript narrows here!
        if ("marketId" in identifier) {
            // Build market endpoint
            const endpointMap = {
                "market-clearing": "clearing",
                "market-exports": "exports",
                "market-imports": "imports",
                "market-generation": "generation",
                "market-consumption": "consumption",
            } as const;
            const endpointSubtype = endpointMap[identifier.chartType];
            const response = await apiClient.get(
                `/charts/markets/${identifier.marketId}/${endpointSubtype}/${resolution}`,
                { params },
            );
            return response;
        }

        // Build regular endpoint
        const response = await apiClient.get(
            `/charts/${identifier.chartType}/${resolution}`,
            { params },
        );
        return response;
    },

    /** Get market supply/demand curve data for a specific tick */
    getMarketData: async (marketId: number, tick: number) => {
        const response = await apiClient.get<
            ApiResponse<
                "/api/v1/charts/markets/{market_id}/market/{tick}",
                "get"
            >
        >(`/charts/markets/${marketId}/market/${tick}`);
        return response;
    },
};
