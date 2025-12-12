/** Weather-related API calls. */

import { apiClient } from "../api-client";

import type { ApiResponse } from "@/types/api-helpers";

export const weatherApi = {
    /**
     * Get current weather data including date, irradiance, wind speed, and
     * river discharge.
     */
    getCurrent: () =>
        apiClient.get<ApiResponse<"/api/v1/weather", "get">>("/weather"),
};
