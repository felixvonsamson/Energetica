/** Browser notifications API calls. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const browserNotificationsApi = {
    /** Get the VAPID public key for push notifications. */
    getVapidKey: () =>
        apiClient.get<
            ApiResponse<"/api/v1/push-subscriptions/vapid-public-key", "get">
        >("/push-subscriptions/vapid-public-key"),

    /** Subscribe to push notifications. */
    subscribe: (
        data: ApiRequestBody<"/api/v1/push-subscriptions:subscribe", "post">,
    ) =>
        apiClient.post<
            ApiResponse<"/api/v1/push-subscriptions:subscribe", "post">
        >("/push-subscriptions:subscribe", data),

    /** Unsubscribe from push notifications. */
    unsubscribe: (
        data: ApiRequestBody<"/api/v1/push-subscriptions:unsubscribe", "post">,
    ) =>
        apiClient.post<
            ApiResponse<"/api/v1/push-subscriptions:unsubscribe", "post">
        >("/push-subscriptions:unsubscribe", data),
};
