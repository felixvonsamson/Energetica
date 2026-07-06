/**
 * Lobby picker API calls, served by the lobby backend (not an instance). The
 * lobby reuses the game's generated types: its endpoints mirror existing game
 * paths exactly (`energetica/schemas/lobby.py`), so `api.generated.ts` covers
 * them without a lobby-specific schema export.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export type MyRunsResponse = ApiResponse<"/api/v1/lobby/my-runs", "get">;
export type MyRun = MyRunsResponse["runs"][number];

export const lobbyApi = {
    /** The authenticated account's settled runs, most recently settled first. */
    myRuns: () => apiClient.get<MyRunsResponse>("/lobby/my-runs"),
};
