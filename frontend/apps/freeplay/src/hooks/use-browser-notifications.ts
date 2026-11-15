/** React Query hooks for browser notifications. */

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { browserNotificationsApi } from "@/lib/api/push-subscriptions";
import { resolveErrorMessage } from "@/lib/game-messages";
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
                "/api/v1/push-subscriptions:subscribe",
                "post"
            >,
        ) => browserNotificationsApi.subscribe(data),
    });
}

/** Mutation hook to unsubscribe from push notifications. */
export function useUnsubscribeFromPushNotifications() {
    return useMutation({
        mutationFn: (
            data: ApiRequestBody<
                "/api/v1/push-subscriptions:unsubscribe",
                "post"
            >,
        ) => browserNotificationsApi.unsubscribe(data),
        onSuccess: () => {
            toast.success("Push notifications disabled");
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}
