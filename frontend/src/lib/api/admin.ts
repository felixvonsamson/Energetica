/** Admin-related API calls. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const adminApi = {
    /** Get all players for the admin dashboard. */
    getPlayers: () =>
        apiClient.get<ApiResponse<"/api/v1/admin/players", "get">>(
            "/admin/players",
        ),

    /** Permanently ban a player by ID. */
    banPlayer: (playerId: number) =>
        apiClient.post<void>(`/admin/players/${playerId}/ban`),
};
