/**
 * The one lobby read an instance serves too: the account's runs, for the
 * account menu's "Switch run" list. Every instance serves `GET
 * /api/v1/lobby/my-runs` off the shared session cookie, so the menu never talks
 * cross-origin to the lobby (ADR-0002). The lobby app has its own copy of this
 * call, typed against the lobby's schema.
 */

import type { ApiResponse } from "@/types/api-helpers";
import { apiClient } from "@energetica/core/api-client";

export type MyRunsResponse = ApiResponse<"/api/v1/lobby/my-runs", "get">;
export type MyRun = MyRunsResponse["runs"][number];
export type FacilitatedRun = MyRunsResponse["facilitated_runs"][number];

export const lobbyApi = {
    /**
     * The authenticated account's joined runs (settled or not), most recently
     * joined first.
     */
    myRuns: () => apiClient.get<MyRunsResponse>("/lobby/my-runs"),
};
