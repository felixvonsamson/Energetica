/**
 * Resource market API calls. Handles buying and selling resources on the
 * market.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const resourceMarketApi = {
    /** Get all asks (resource listings) in the market. */
    getAsks: () =>
        apiClient.get<ApiResponse<"/api/v1/resource-market/asks", "get">>(
            "/resource-market/asks",
        ),

    /** Create a new ask (list resources for sale). */
    createAsk: (data: ApiRequestBody<"/api/v1/resource-market/asks", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/resource-market/asks", "post">>(
            "/resource-market/asks",
            data,
        ),

    /** Purchase resources from an ask. Omit quantity to purchase all available. */
    purchaseAsk: (params: { askId: number; quantity?: number }) =>
        apiClient.post<
            ApiResponse<
                "/api/v1/resource-market/asks/{ask_id}:purchase",
                "post"
            >
        >(`/resource-market/asks/${params.askId}:purchase`, {
            quantity: params.quantity,
        }),

    /** Update an existing ask. */
    updateAsk: (params: {
        askId: number;
        data: ApiRequestBody<"/api/v1/resource-market/asks/{ask_id}", "patch">;
    }) =>
        apiClient.patch<
            ApiResponse<"/api/v1/resource-market/asks/{ask_id}", "patch">
        >(`/resource-market/asks/${params.askId}`, params.data),

    /** Delete an ask. */
    deleteAsk: (askId: number) =>
        apiClient.delete<void>(`/resource-market/asks/${askId}`),

    /** Calculate delivery time for a specific ask. */
    calculateDeliveryTime: (askId: number) =>
        apiClient.post<
            ApiResponse<
                "/api/v1/resource-market/asks/{ask_id}:calculate-delivery",
                "post"
            >
        >(`/resource-market/asks/${askId}:calculate-delivery`, {}),
};
