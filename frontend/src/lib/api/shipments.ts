/** Shipments-related API calls. Handles incoming resource shipments. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const shipmentsApi = {
    /** Get list of ongoing incoming shipments. */
    getShipments: () =>
        apiClient.get<ApiResponse<"/api/v1/shipments", "get">>("/shipments"),
};
