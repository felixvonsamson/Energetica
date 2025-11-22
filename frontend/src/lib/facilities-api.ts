/**
 * API client for facilities endpoints.
 */

import { apiClient } from "./api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const facilitiesApi = {
    /**
     * Get all active facilities for the current player.
     */
    getAll: () =>
        apiClient.get<ApiResponse<"/api/v1/facilities", "get">>(
            "/facilities"
        ),

    /**
     * Upgrade a single facility by ID.
     */
    upgrade: (facilityId: number) =>
        apiClient.post<ApiResponse<"/api/v1/facilities/{facility_id}:upgrade", "post">>(
            `/facilities/${facilityId}:upgrade`
        ),

    /**
     * Upgrade all facilities of a certain type.
     */
    upgradeAll: (facilityType: string) =>
        apiClient.post<ApiResponse<"/api/v1/facilities:upgrade-all", "post">>(
            "/facilities:upgrade-all",
            undefined,
            { params: { facility_type: facilityType } }
        ),

    /**
     * Dismantle a single facility by ID.
     */
    dismantle: (facilityId: number) =>
        apiClient.post<ApiResponse<"/api/v1/facilities/{facility_id}:dismantle", "post">>(
            `/facilities/${facilityId}:dismantle`
        ),

    /**
     * Dismantle all facilities of a certain type.
     */
    dismantleAll: (facilityType: string) =>
        apiClient.post<ApiResponse<"/api/v1/facilities:dismantle-all", "post">>(
            "/facilities:dismantle-all",
            undefined,
            { params: { facility_type: facilityType } }
        ),
};
