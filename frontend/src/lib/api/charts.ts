/** API client for chart data endpoints. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";
import { ChartType, Resolution, TickRange } from "@/types/charts";

interface ChartParams {
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
}

interface NetworkChartParams {
    networkId: number;
    chartType:
        | "network-data"
        | "network-exports"
        | "network-imports"
        | "network-generation"
        | "network-consumption";
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

    /** Get network chart data */
    getNetworkChartData: async ({
        networkId,
        chartType,
        resolution,
        range,
    }: NetworkChartParams) => {
        // Map frontend chart type to backend endpoint
        const endpointMap = {
            "network-data": "network_data",
            "network-exports": "exports",
            "network-imports": "imports",
            "network-generation": "generation",
            "network-consumption": "consumption",
        } as const;
        const endpoint = endpointMap[chartType];
        const response = await apiClient.get<
            ApiResponse<
                | "/api/v1/charts/networks/{network_id}/network_data/{resolution}"
                | "/api/v1/charts/networks/{network_id}/exports/{resolution}"
                | "/api/v1/charts/networks/{network_id}/imports/{resolution}"
                | "/api/v1/charts/networks/{network_id}/generation/{resolution}"
                | "/api/v1/charts/networks/{network_id}/consumption/{resolution}",
                "get"
            >
        >(`/charts/networks/${networkId}/${endpoint}/${resolution}`, {
            params: { start_tick: range.startTick, count: range.count },
        });
        return response;
    },

    /** Get market supply/demand curve data for a specific tick */
    getMarketData: async (networkId: number, tick: number) => {
        const response = await apiClient.get<
            ApiResponse<
                "/api/v1/charts/networks/{network_id}/market/{tick}",
                "get"
            >
        >(`/charts/networks/${networkId}/market/${tick}`);
        return response;
    },
};
