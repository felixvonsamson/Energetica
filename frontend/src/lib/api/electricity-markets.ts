/** API client for electricity markets endpoints. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const electricityMarketsApi = {
    /** Get the list of existing electricity markets. */
    getAll: () =>
        apiClient.get<ApiResponse<"/api/v1/electricity-markets", "get">>(
            "/electricity-markets",
        ),

    /** Join an electricity market. */
    join: (networkId: number) =>
        apiClient.post<
            ApiResponse<"/api/v1/electricity-markets/{network_id}:join", "post">
        >(`/electricity-markets/${networkId}:join`),

    /** Leave the current electricity market. */
    leave: (networkId: number) =>
        apiClient.post<
            ApiResponse<
                "/api/v1/electricity-markets/{network_id}:leave",
                "post"
            >
        >(`/electricity-markets/${networkId}:leave`),

    /** Create a new electricity market. */
    create: (data: ApiRequestBody<"/api/v1/electricity-markets", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/electricity-markets", "post">>(
            "/electricity-markets",
            data,
        ),

    /**
     * Update the asking prices and bid prices for the player's electricity
     * market.
     */
    changePrices: (
        data: ApiRequestBody<"/api/v1/electricity-markets/prices", "patch">,
    ) =>
        apiClient.patch<
            ApiResponse<"/api/v1/electricity-markets/prices", "patch">
        >("/electricity-markets/prices", data),
};
