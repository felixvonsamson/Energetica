/** API client for chart data endpoints. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";
import { ChartType, Resolution, TickRange } from "@/types/charts";

interface ChartParams {
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
}

interface MarketChartParams {
    marketId: number;
    chartType:
        | "market-clearing-data"
        | "market-exports"
        | "market-imports"
        | "market-generation"
        | "market-consumption";
    resolution: Resolution;
    range: TickRange;
}

export const chartsApi = {
    /** Get chart data */
    getChartData: async ({ chartType, resolution, range }: ChartParams) => {
        const response = await apiClient.get<
            ApiResponse<"/api/v1/charts/power-sources/{resolution}", "get">
        >(`/charts/${chartType}/${resolution}`, {
            params: { start_tick: range.startTick, count: range.count },
        });
        return response;
    },

    /** Get market chart data */
    getMarketChartData: async ({
        marketId,
        chartType,
        resolution,
        range,
    }: MarketChartParams) => {
        // Map frontend chart type to backend endpoint
        const endpointMap = {
            "market-clearing-data": "network_data",
            "market-exports": "exports",
            "market-imports": "imports",
            "market-generation": "generation",
            "market-consumption": "consumption",
        } as const;
        const endpoint = endpointMap[chartType];
        const response = await apiClient.get<
            ApiResponse<
                | "/api/v1/charts/markets/{market_id}/network_data/{resolution}"
                | "/api/v1/charts/markets/{market_id}/exports/{resolution}"
                | "/api/v1/charts/markets/{market_id}/imports/{resolution}"
                | "/api/v1/charts/markets/{market_id}/generation/{resolution}"
                | "/api/v1/charts/markets/{market_id}/consumption/{resolution}",
                "get"
            >
        >(`/charts/markets/${marketId}/${endpoint}/${resolution}`, {
            params: { start_tick: range.startTick, count: range.count },
        });
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
