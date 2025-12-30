/** API client for power priorities endpoints. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const powerPrioritiesApi = {
    /** Get the current power priorities list for the player. */
    getAll: () =>
        apiClient.get<ApiResponse<"/api/v1/power-priorities", "get">>(
            "/power-priorities",
        ),

    /** Update the power priorities order. */
    update: (data: ApiRequestBody<"/api/v1/power-priorities", "put">) =>
        apiClient.put<ApiResponse<"/api/v1/power-priorities", "put">>(
            "/power-priorities",
            data,
        ),
};
