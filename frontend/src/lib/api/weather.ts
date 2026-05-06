/** Weather-related API calls. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const weatherApi = {
    /**
     * Get current weather data including date, irradiance, wind speed, and
     * river flow speed.
     */
    getCurrent: () =>
        apiClient.get<ApiResponse<"/api/v1/weather", "get">>("/weather"),

    /** Get the player's active climate event recoveries with progress info. */
    getClimateEventRecoveries: () =>
        apiClient.get<
            ApiResponse<"/api/v1/weather/climate-event-recoveries", "get">
        >("/weather/climate-event-recoveries"),
};
