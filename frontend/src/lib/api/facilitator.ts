/** Facilitator instance-admin API calls (#1020). */

import { apiClient } from "@/lib/api-client";
import type { ApiRequestBody, ApiResponse } from "@/types/api-helpers";

export const facilitatorApi = {
    /**
     * This instance's join-link settings — lazily generates the join token on
     * first read.
     */
    getAccess: () =>
        apiClient.get<ApiResponse<"/api/v1/facilitator/access", "get">>(
            "/facilitator/access",
        ),

    /** Flip whether the join link currently admits new accounts. */
    updateAccess: (
        data: ApiRequestBody<"/api/v1/facilitator/access", "patch">,
    ) => apiClient.patch<void>("/facilitator/access", data),
};
