/**
 * Achievement API client. Handles fetching player's upcoming achievements and
 * their progress.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const achievementApi = {
    /**
     * Get the upcoming achievements for the current player. Returns
     * achievements that are in progress or nearly complete.
     */
    getUpcoming: () =>
        apiClient.get<ApiResponse<"/api/v1/achievements", "get">>(
            "/achievements",
        ),
};
