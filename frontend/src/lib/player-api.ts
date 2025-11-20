/**
 * Player-related API calls.
 */

import { apiClient } from "./api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const playerApi = {
    /**
     * Get all players.
     */
    getAll: () =>
        apiClient.get<ApiResponse<"/api/v1/players", "get">>("/players"),

    /**
     * Get current player information.
     */
    getMe: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me", "get">>("/players/me"),

    /**
     * Get current player's money.
     */
    getMoney: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/money", "get">>(
            "/players/me/money",
        ),
};
