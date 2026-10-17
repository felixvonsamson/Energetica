/** Shipments-related API calls. Handles incoming resource shipments. */

import type { ApiResponse } from "@/types/api-helpers";
import { apiClient } from "@energetica/core/api-client";

export const shipmentsApi = {
    /** Get list of ongoing incoming shipments. */
    getShipments: () =>
        apiClient.get<ApiResponse<"/api/v1/shipments", "get">>("/shipments"),
};
