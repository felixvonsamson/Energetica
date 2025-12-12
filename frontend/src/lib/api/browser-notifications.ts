/** Browser notifications API calls. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const browserNotificationsApi = {
    /** Get the VAPID public key for push notifications. */
    getVapidKey: () =>
        apiClient.get<
            ApiResponse<"/api/v1/browser-notifications/vapid-public-key", "get">
        >("/browser-notifications/vapid-public-key"),

    /** Subscribe to push notifications. */
    subscribe: (
        data: ApiRequestBody<"/api/v1/browser-notifications:subscribe", "post">,
    ) =>
        apiClient.post<
            ApiResponse<"/api/v1/browser-notifications:subscribe", "post">
        >("/browser-notifications:subscribe", data),

    /** Unsubscribe from push notifications. */
    unsubscribe: (
        data: ApiRequestBody<
            "/api/v1/browser-notifications:unsubscribe",
            "post"
        >,
    ) =>
        apiClient.post<
            ApiResponse<"/api/v1/browser-notifications:unsubscribe", "post">
        >("/browser-notifications:unsubscribe", data),
};
