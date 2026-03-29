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

    /** Move a single item one step up (increase-priority) or down (decrease-priority). */
    bump: ({
        side,
        type,
        direction,
    }: {
        side: string;
        type: string;
        direction: "increase" | "decrease";
    }) =>
        apiClient.post<ApiResponse<"/api/v1/power-priorities", "get">>(
            `/power-priorities/${side}/${type}:${direction}-priority`,
        ),
};
