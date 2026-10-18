/**
 * Which kind of Run this instance is: the persistent world (`freeplay`) or a
 * Workshop. Both backends serve `/run`, so the app can ask before it knows
 * which page tree to show (#994).
 */

import type { ApiResponse } from "@/types/api-helpers";
import { apiClient } from "@energetica/core/api-client";

export const runApi = {
    /** Get this instance's Run mode. Needs no session. */
    get: () => apiClient.get<ApiResponse<"/api/v1/run", "get">>("/run"),
};
