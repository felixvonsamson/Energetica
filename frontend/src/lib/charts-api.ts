/** API client for chart data endpoints. */

import { apiClient } from "./api-client";
import type { ApiResponse } from "@/types/api-helpers";
import { ChartType, Resolution, TickRange } from "../types/charts";

interface ChartParams {
    chartType: ChartType;
    resolution: Resolution;
    range: TickRange;
}

export const chartsApi = {
    /** Get chart data */
    getChartData: async ({ resolution, range }: ChartParams) => {
        const response = await apiClient.get<
            ApiResponse<"/api/v1/charts/power-sources/{resolution}", "get">
        >(`/charts/power-sources/${resolution}`, {
            params: { start_tick: range.startTick, count: range.count },
        });
        return response;
    },
};
