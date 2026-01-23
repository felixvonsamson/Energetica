/** React Query hooks for browser notifications. */

import { useMutation, useQuery } from "@tanstack/react-query";

import { browserNotificationsApi } from "@/lib/api/browser-notifications";
import { handleApiError } from "@/lib/error-utils";
import { queryKeys } from "@/lib/query-client";
import type { ApiRequestBody } from "@/types/api-helpers";

/** Query hook to get the VAPID public key. */
export function useVapidKey() {
    return useQuery({
        queryKey: queryKeys.browserNotifications.vapidKey,
        queryFn: () => browserNotificationsApi.getVapidKey(),
    });
}

/** Mutation hook to subscribe to push notifications. */
export function useSubscribeToPushNotifications() {
    return useMutation({
        mutationFn: (
            data: ApiRequestBody<
                "/api/v1/browser-notifications:subscribe",
                "post"
            >,
        ) => browserNotificationsApi.subscribe(data),
        onError: (error) => {
            handleApiError(error, "Failed to subscribe to notifications");
        },
    });
}

/** Mutation hook to unsubscribe from push notifications. */
export function useUnsubscribeFromPushNotifications() {
    return useMutation({
        mutationFn: (
            data: ApiRequestBody<
                "/api/v1/browser-notifications:unsubscribe",
                "post"
            >,
        ) => browserNotificationsApi.unsubscribe(data),
        onError: (error) => {
            handleApiError(error, "Failed to unsubscribe from notifications");
        },
    });
}
