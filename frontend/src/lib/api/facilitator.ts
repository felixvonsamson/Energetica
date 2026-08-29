/** Facilitator instance-admin API calls (#1020, #1022). */

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

    /** This instance's roster, split into joined vs invited-not-yet-joined. */
    getRoster: () =>
        apiClient.get<ApiResponse<"/api/v1/facilitator/roster", "get">>(
            "/facilitator/roster",
        ),

    /**
     * Existing accounts whose username starts with `prefix` — the add control's
     * lookup.
     */
    searchRosterCandidates: (prefix: string) =>
        apiClient.get<
            ApiResponse<"/api/v1/facilitator/roster/candidates", "get">
        >("/facilitator/roster/candidates", { params: { prefix } }),

    /** Add an existing account to the roster. */
    addToRoster: (data: ApiRequestBody<"/api/v1/facilitator/roster", "post">) =>
        apiClient.post<void>("/facilitator/roster", data),

    /** Ban/remove a username from the roster. */
    removeFromRoster: (username: string) =>
        apiClient.delete<void>(
            `/facilitator/roster/${encodeURIComponent(username)}`,
        ),
};
