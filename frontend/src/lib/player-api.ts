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

    /**
     * Get current player's workers.
     */
    getWorkers: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/workers", "get">>(
            "/players/me/workers",
        ),

    /**
     * Get current player's resources.
     */
    getResources: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/resources", "get">>(
            "/players/me/resources",
        ),

    /**
     * Get current player's complete profile.
     */
    getProfile: () =>
        apiClient.get<ApiResponse<"/api/v1/players/me/profile", "get">>(
            "/players/me/profile",
        ),

    /**
     * Get the scoreboard data.
     */
    getScoreboard: () =>
        apiClient.get<ApiResponse<"/api/v1/scoreboard", "get">>("/scoreboard"),
};
