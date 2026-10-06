/**
 * Which kind of Run this instance is: the persistent world (`freeplay`) or a
 * Workshop. Both backends serve `/run`, so the app can ask before it knows
 * which page tree to show (#994).
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const runApi = {
    /** Get this instance's Run mode. Needs no session. */
    get: () => apiClient.get<ApiResponse<"/api/v1/run", "get">>("/run"),
};
