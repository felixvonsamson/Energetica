/**
 * Public join-link API calls (#1021) — the visitor-facing counterpart to
 * `lib/api/facilitator.ts`.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const joinApi = {
    /**
     * What this join link offers, and whether the visitor already has a session
     * to join with.
     */
    getLink: (token: string) =>
        apiClient.get<ApiResponse<"/api/v1/join/{token}", "get">>(
            `/join/${encodeURIComponent(token)}`,
        ),

    /**
     * Confirm joining: append the signed-in visitor's username to the
     * allowlist.
     */
    confirm: (token: string) =>
        apiClient.post<void>(`/join/${encodeURIComponent(token)}`),
};
